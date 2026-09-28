using System.Security.Cryptography;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace SOE.Identity.Infrastructure.Security;

/// <summary>
/// Giữ khóa RSA dùng để ký JWT (RS256) và công bố public key qua JWKS (FR-IDN-010).
/// Dev: tự sinh khóa tạm khi chưa cấu hình PEM — token sẽ mất hiệu lực sau mỗi lần khởi động lại.
/// </summary>
public sealed class RsaKeyProvider : IDisposable
{
    private readonly RSA _rsa;

    public RsaKeyProvider(IOptions<JwtOptions> options, ILogger<RsaKeyProvider> logger)
    {
        var jwt = options.Value;
        _rsa = RSA.Create(2048);

        if (!string.IsNullOrWhiteSpace(jwt.PrivateKeyPem))
        {
            _rsa.ImportFromPem(jwt.PrivateKeyPem);
        }
        else
        {
            logger.LogWarning(
                "Chưa cấu hình Jwt:PrivateKeyPem — đang dùng khóa RSA tạm sinh khi khởi động. " +
                "KHÔNG dùng cấu hình này ở môi trường production.");
        }

        KeyId = jwt.KeyId;
        SigningKey = new RsaSecurityKey(_rsa) { KeyId = KeyId };
        SigningCredentials = new SigningCredentials(SigningKey, SecurityAlgorithms.RsaSha256);
    }

    public string KeyId { get; }

    public RsaSecurityKey SigningKey { get; }

    public SigningCredentials SigningCredentials { get; }

    /// <summary>Tham số public key để dựng JWKS (không bao giờ xuất private key).</summary>
    public RSAParameters PublicParameters => _rsa.ExportParameters(includePrivateParameters: false);

    public void Dispose() => _rsa.Dispose();
}
