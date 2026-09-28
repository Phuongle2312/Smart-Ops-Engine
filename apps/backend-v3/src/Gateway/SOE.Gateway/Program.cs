using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Serilog;
using SOE.BuildingBlocks.Web;
using SOE.BuildingBlocks.Web.Authentication;
using Yarp.ReverseProxy.Transforms;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service.name", "soe-gateway"));

const string CorsPolicy = "soe-spa";

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                     ?? ["http://localhost:5173"];

builder.Services.AddCors(options => options.AddPolicy(CorsPolicy, policy => policy
    .WithOrigins(allowedOrigins)
    .AllowCredentials()
    .WithHeaders("Authorization", "Content-Type", "X-Correlation-Id", "Idempotency-Key")
    .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
    .WithExposedHeaders("X-Correlation-Id", "Retry-After")));

builder.Services.AddSoeJwtAuthentication(builder.Configuration, !builder.Environment.IsDevelopment());
builder.Services.AddSoeAuthorization();

// Giới hạn tần suất theo nhóm route (docs §9 api_gateway_security).
// M1: bộ đếm trong tiến trình; M2 chuyển sang Redis để dùng chung giữa các replica (TC-GW-SEC-012).
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(
        ClientIp(context),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    options.AddPolicy("per-user-read", context => RateLimitPartition.GetTokenBucketLimiter(
        UserKey(context),
        _ => new TokenBucketRateLimiterOptions
        {
            TokenLimit = 360,
            TokensPerPeriod = 300,
            ReplenishmentPeriod = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        }));

    options.AddPolicy("per-user-write", context => RateLimitPartition.GetTokenBucketLimiter(
        UserKey(context),
        _ => new TokenBucketRateLimiterOptions
        {
            TokenLimit = 70,
            TokensPerPeriod = 60,
            ReplenishmentPeriod = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        }));

    options.AddPolicy("expensive", context => RateLimitPartition.GetFixedWindowLimiter(
        UserKey(context),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "60";
        context.HttpContext.Response.ContentType = "application/problem+json";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            type = "https://docs.soe.local/errors/SOE-GW-429",
            title = "Quá nhiều yêu cầu",
            status = 429,
            detail = "Bạn thao tác quá nhanh. Vui lòng đợi ít phút rồi thử lại.",
            code = "SOE-GW-429",
            correlationId = context.HttpContext.TraceIdentifier
        }, token);
    };
});

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))
    .AddTransforms(context =>
    {
        // Xóa mọi header nhận dạng do client tự gắn rồi mới gắn giá trị lấy từ JWT (FR-GW-006).
        context.AddRequestTransform(transform =>
        {
            transform.ProxyRequest.Headers.Remove("X-User-Id");
            transform.ProxyRequest.Headers.Remove("X-User-Role");
            transform.ProxyRequest.Headers.Remove("X-User-Name");

            var user = transform.HttpContext.User;
            if (user.Identity?.IsAuthenticated == true)
            {
                var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
                if (!string.IsNullOrEmpty(userId))
                {
                    transform.ProxyRequest.Headers.TryAddWithoutValidation("X-User-Id", userId);
                }

                var role = user.FindFirstValue(ClaimTypes.Role);
                if (!string.IsNullOrEmpty(role))
                {
                    transform.ProxyRequest.Headers.TryAddWithoutValidation("X-User-Role", role);
                }
            }

            transform.ProxyRequest.Headers.TryAddWithoutValidation(
                "X-Correlation-Id", transform.HttpContext.TraceIdentifier);

            return ValueTask.CompletedTask;
        });
    });

builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseSoeRequestPipeline();
app.UseCors(CorsPolicy);
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health/live").AllowAnonymous();
app.MapHealthChecks("/health/ready").AllowAnonymous();

// Route không khai báo trong cấu hình sẽ không được proxy → trả 404 (deny by default, FR-GW-001).
app.MapReverseProxy();

await app.RunAsync();

static string ClientIp(HttpContext context) =>
    context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

static string UserKey(HttpContext context) =>
    context.User.FindFirstValue(ClaimTypes.NameIdentifier)
    ?? context.User.FindFirstValue("sub")
    ?? ClientIp(context);
