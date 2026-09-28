using System.Security.Cryptography;
using System.Text;

namespace SOE.Identity.Application;

/// <summary>
/// Băm dữ liệu định danh (IP, user agent) trước khi ghi nhật ký — giảm rủi ro dữ liệu cá nhân
/// nhưng vẫn so khớp được (BR-AUD-004).
/// </summary>
public static class Hashing
{
    public static string? HashOrNull(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes)[..32].ToLowerInvariant();
    }
}
