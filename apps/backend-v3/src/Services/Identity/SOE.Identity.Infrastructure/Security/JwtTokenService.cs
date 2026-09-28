using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using SOE.BuildingBlocks.Application.Abstractions;
using SOE.Identity.Application.Abstractions;
using SOE.Identity.Domain;

namespace SOE.Identity.Infrastructure.Security;

/// <summary>
/// Phát hành access token RS256 và refresh token opaque.
/// Access token chỉ chứa claim tối thiểu (BR-IDN-003); refresh token chỉ lưu hash SHA-256 trong CSDL.
/// </summary>
internal sealed class JwtTokenService(
    IOptions<JwtOptions> options,
    RsaKeyProvider keyProvider,
    IClock clock) : ITokenService
{
    private const int RefreshTokenBytes = 32;

    private readonly JwtOptions _options = options.Value;

    public AccessToken CreateAccessToken(User user, Guid sessionId)
    {
        var now = clock.UtcNow;
        var expires = now.AddSeconds(_options.AccessTokenLifetimeSeconds);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new("name", user.Username.Value),
            new(ClaimTypes.Role, user.Role.ToClaimValue()),
            new("sid", sessionId.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("pwd_at", user.PasswordChangedAt.ToUnixTimeSeconds().ToString(
                System.Globalization.CultureInfo.InvariantCulture))
        };

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: now.UtcDateTime,
            expires: expires.UtcDateTime,
            signingCredentials: keyProvider.SigningCredentials);

        var value = new JwtSecurityTokenHandler().WriteToken(token);
        return new AccessToken(value, _options.AccessTokenLifetimeSeconds);
    }

    public RefreshTokenMaterial CreateRefreshToken()
    {
        var raw = Base64UrlEncode(RandomNumberGenerator.GetBytes(RefreshTokenBytes));
        return new RefreshTokenMaterial(raw, HashRefreshToken(raw));
    }

    public byte[] HashRefreshToken(string rawValue) => SHA256.HashData(Encoding.UTF8.GetBytes(rawValue));

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
