using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using SOE.BuildingBlocks.Application.Abstractions;
using SOE.BuildingBlocks.Web;
using SOE.BuildingBlocks.Web.Authentication;
using SOE.Identity.Api.Endpoints;
using SOE.Identity.Application;
using SOE.Identity.Infrastructure;
using SOE.Identity.Infrastructure.Persistence;
using SOE.Identity.Infrastructure.Security;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service.name", "soe-identity"));

// Lớp Application + Infrastructure (Clean Architecture: Api chỉ nối dây, không chứa nghiệp vụ)
builder.Services.AddIdentityApplication();
builder.Services.AddIdentityInfrastructure(builder.Configuration);

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IUserContext, HttpUserContext>();

// Identity tự phát hành token nên xác minh trực tiếp bằng khóa của chính nó (không gọi JWKS qua mạng).
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();

        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            ValidateIssuerSigningKey = true,
            RequireSignedTokens = true,
            RequireExpirationTime = true,
            ValidAlgorithms = new[] { SecurityAlgorithms.RsaSha256 },
            NameClaimType = "name",
            RoleClaimType = ClaimTypes.Role
        };

        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                // Token phát hành trước lần đổi mật khẩu gần nhất bị từ chối (BR-IDN-004).
                var pwdAt = context.Principal?.FindFirst(SoeClaims.PasswordChangedAt)?.Value;
                if (!long.TryParse(pwdAt, out _))
                {
                    context.Fail("Token thiếu claim pwd_at.");
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<RsaKeyProvider>((options, keys) =>
        options.TokenValidationParameters.IssuerSigningKey = keys.SigningKey);

builder.Services.AddSoeAuthorization();

// Rate limit đăng nhập: 5 lần/phút/IP (FR-GW-004, NFR-SEC-006).
// M1 dùng bộ đếm trong tiến trình; M2 chuyển sang Redis để dùng chung giữa các replica.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        }));

    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "60";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            type = "https://docs.soe.local/errors/SOE-GW-429",
            title = "Quá nhiều yêu cầu",
            status = 429,
            detail = "Bạn thử quá nhiều lần. Vui lòng đợi 60 giây rồi thử lại.",
            code = "SOE-GW-429"
        }, token);
    };
});

builder.Services.AddHealthChecks()
    .AddDbContextCheck<IdentityDbContext>("database", tags: ["ready"]);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseSoeRequestPipeline();

// Swagger chỉ bật ở môi trường phát triển (OWASP API8, TC-GW-SEC-018).
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapUserEndpoints();
app.MapDiscoveryEndpoints();

app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous();
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
}).AllowAnonymous();

// Dev: tự áp dụng migration + seed admin. Production dùng Job migration riêng (docs §4 data_architecture).
if (app.Environment.IsDevelopment() ||
    app.Configuration.GetValue<bool>("Identity:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
    await context.Database.MigrateAsync();

    var seeder = scope.ServiceProvider.GetRequiredService<IdentityDbSeeder>();
    await seeder.SeedAsync(app.Configuration["Identity:InitialAdminPassword"]);
}

await app.RunAsync();

/// <summary>Điểm vào của Identity API — public để WebApplicationFactory dùng trong test tích hợp.</summary>
public partial class Program;
