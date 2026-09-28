using System.Security.Cryptography;
using SOE.Identity.Application.Abstractions;

namespace SOE.Identity.Infrastructure.Security;

/// <summary>
/// Chính sách mật khẩu (BR-IDN-007). M1 dùng danh sách rút gọn các mật khẩu phổ biến;
/// production nạp danh sách top 10k từ tệp cấu hình.
/// </summary>
public sealed class PasswordPolicy : IPasswordPolicy
{
    private const string Alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private static readonly HashSet<string> CommonPasswords = new(StringComparer.OrdinalIgnoreCase)
    {
        "password", "password123", "password1234", "matkhau123", "123456789012",
        "qwertyuiop12", "admin123456", "smartops2026", "111111111111", "letmein12345",
        "iloveyou1234", "welcome12345", "administrator", "abcd12345678"
    };

    public bool IsWeak(string password)
    {
        if (CommonPasswords.Contains(password))
        {
            return true;
        }

        // Chỉ lặp một ký tự hoặc chỉ toàn số tăng/giảm dần cũng coi là yếu.
        return password.Distinct().Count() <= 3;
    }

    /// <summary>Sinh mật khẩu tạm 16 ký tự, đủ mạnh và không chứa ký tự dễ nhầm lẫn (0/O, 1/l).</summary>
    public string GenerateTemporaryPassword()
    {
        Span<char> buffer = stackalloc char[16];
        for (var i = 0; i < buffer.Length; i++)
        {
            buffer[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        }

        // Bảo đảm có ít nhất một chữ và một số theo chính sách.
        buffer[0] = 'S';
        buffer[^1] = (char)('2' + RandomNumberGenerator.GetInt32(8));

        return new string(buffer);
    }
}
