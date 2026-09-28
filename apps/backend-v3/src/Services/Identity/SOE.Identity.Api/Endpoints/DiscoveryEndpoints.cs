using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Options;
using SOE.Identity.Infrastructure.Security;

namespace SOE.Identity.Api.Endpoints;

/// <summary>
/// JWKS + metadata OIDC tối thiểu để Gateway và các service tự xác minh JWT (FR-IDN-010).
/// Chỉ công bố public key, không bao giờ lộ private key.
/// </summary>
public static class DiscoveryEndpoints
{
    public static IEndpointRouteBuilder MapDiscoveryEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/.well-known/jwks.json", (RsaKeyProvider keys) =>
        {
            var parameters = keys.PublicParameters;

            var jwk = new
            {
                kty = "RSA",
                use = "sig",
                alg = "RS256",
                kid = keys.KeyId,
                n = Base64UrlEncoder.Encode(parameters.Modulus),
                e = Base64UrlEncoder.Encode(parameters.Exponent)
            };

            return Results.Ok(new { keys = new[] { jwk } });
        })
        .AllowAnonymous()
        .WithTags("Discovery")
        .WithSummary("Khóa công khai xác minh JWT");

        app.MapGet("/.well-known/openid-configuration", (
            IOptions<JwtOptions> options,
            HttpContext http) =>
        {
            var baseUrl = $"{http.Request.Scheme}://{http.Request.Host}";

            return Results.Ok(new
            {
                issuer = options.Value.Issuer,
                jwks_uri = $"{baseUrl}/.well-known/jwks.json",
                id_token_signing_alg_values_supported = new[] { "RS256" },
                token_endpoint = $"{baseUrl}/api/v1/auth/login",
                response_types_supported = new[] { "token" },
                subject_types_supported = new[] { "public" }
            });
        })
        .AllowAnonymous()
        .WithTags("Discovery")
        .WithSummary("Metadata phục vụ xác minh token");

        return app;
    }
}
