using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace SOE.BuildingBlocks.Web.Authentication;

/// <summary>Tên vai trò dùng chung (docs §4 api_gateway_security).</summary>
public static class SoeRoles
{
    public const string Admin = "ADMIN";
    public const string Operator = "OPERATOR";
    public const string Viewer = "VIEWER";
}

/// <summary>Tên policy phân quyền dùng chung cho mọi service.</summary>
public static class SoePolicies
{
    public const string ViewerOrAbove = "ViewerOrAbove";
    public const string OperatorOrAbove = "OperatorOrAbove";
    public const string AdminOnly = "AdminOnly";
}

/// <summary>Claim riêng của SOE.</summary>
public static class SoeClaims
{
    /// <summary>Thời điểm đổi mật khẩu gần nhất (epoch giây) — token cũ hơn mốc này bị từ chối (BR-IDN-004).</summary>
    public const string PasswordChangedAt = "pwd_at";

    /// <summary>Định danh phiên đăng nhập.</summary>
    public const string SessionId = "sid";
}

public static class SoeAuthenticationExtensions
{
    /// <summary>
    /// Cấu hình xác thực JWT RS256 theo JWKS của Identity. Chặn alg=none và HS256 confusion
    /// (TC-GW-SEC-003, TC-GW-SEC-004).
    /// </summary>
    public static IServiceCollection AddSoeJwtAuthentication(
        this IServiceCollection services,
        IConfiguration configuration,
        bool requireHttpsMetadata)
    {
        var section = configuration.GetSection("Jwt");
        var issuer = section["Issuer"] ?? "soe-identity";
        var audience = section["Audience"] ?? "soe-api";
        var authority = section["Authority"];

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                if (!string.IsNullOrWhiteSpace(authority))
                {
                    options.Authority = authority;
                    options.MetadataAddress = $"{authority.TrimEnd('/')}/.well-known/openid-configuration";
                }

                options.RequireHttpsMetadata = requireHttpsMetadata;
                options.MapInboundClaims = false;

                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = issuer,
                    ValidateAudience = true,
                    ValidAudience = audience,
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
                    // SignalR: token đi trong query string khi thiết lập WebSocket (BR-RTM-005).
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"].FirstOrDefault();
                        if (!string.IsNullOrEmpty(accessToken) &&
                            context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                        {
                            context.Token = accessToken;
                        }

                        return Task.CompletedTask;
                    }
                };
            });

        return services;
    }

    public static IServiceCollection AddSoeAuthorization(this IServiceCollection services)
    {
        services.AddAuthorizationBuilder()
            .AddPolicy(SoePolicies.ViewerOrAbove, policy =>
                policy.RequireRole(SoeRoles.Admin, SoeRoles.Operator, SoeRoles.Viewer))
            .AddPolicy(SoePolicies.OperatorOrAbove, policy =>
                policy.RequireRole(SoeRoles.Admin, SoeRoles.Operator))
            .AddPolicy(SoePolicies.AdminOnly, policy =>
                policy.RequireRole(SoeRoles.Admin));

        // Mặc định: mọi endpoint đều yêu cầu xác thực, trừ khi khai báo AllowAnonymous (NFR-SEC-001).
        services.AddSingleton<IAuthorizationHandler, PassThroughAuthorizationHandler>();

        return services;
    }

    private sealed class PassThroughAuthorizationHandler : IAuthorizationHandler
    {
        public Task HandleAsync(AuthorizationHandlerContext context) => Task.CompletedTask;
    }
}
