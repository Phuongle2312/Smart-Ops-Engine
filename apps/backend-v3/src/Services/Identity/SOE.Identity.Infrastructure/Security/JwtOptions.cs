using System.ComponentModel.DataAnnotations;

namespace SOE.Identity.Infrastructure.Security;

/// <summary>Cấu hình phát hành JWT. Khóa riêng lấy từ secret store, không nằm trong repo (NFR-SEC-007).</summary>
public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    [Required]
    public string Issuer { get; set; } = "soe-identity";

    [Required]
    public string Audience { get; set; } = "soe-api";

    /// <summary>Thời hạn access token — mặc định 15 phút (NFR-SEC-005).</summary>
    [Range(60, 3600)]
    public int AccessTokenLifetimeSeconds { get; set; } = 900;

    /// <summary>Khóa riêng RSA dạng PEM (PKCS#8). Để trống ở môi trường dev sẽ tự sinh khóa tạm.</summary>
    public string? PrivateKeyPem { get; set; }

    /// <summary>Định danh khóa công bố trong JWKS, phục vụ xoay khóa.</summary>
    public string KeyId { get; set; } = "soe-key-1";
}
