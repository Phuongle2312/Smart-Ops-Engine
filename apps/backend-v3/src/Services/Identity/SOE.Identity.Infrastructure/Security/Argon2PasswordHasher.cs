using System.Security.Cryptography;
using System.Text;
using Konscious.Security.Cryptography;
using SOE.Identity.Application.Abstractions;

namespace SOE.Identity.Infrastructure.Security;

/// <summary>
/// Băm mật khẩu bằng Argon2id (NFR-SEC-004). Định dạng lưu trữ:
/// <c>$argon2id$v=19$m=19456,t=2,p=1$&lt;salt-base64&gt;$&lt;hash-base64&gt;</c>
/// </summary>
public sealed class Argon2PasswordHasher : IPasswordHasher
{
    private const int MemoryKb = 19456;   // 19 MiB
    private const int Iterations = 2;
    private const int Parallelism = 1;
    private const int SaltSize = 16;
    private const int HashSize = 32;

    private static readonly string DummyHash = new Argon2PasswordHasher().Hash("dummy-password-for-timing");

    public string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Compute(password, salt);

        return string.Create(
            System.Globalization.CultureInfo.InvariantCulture,
            $"$argon2id$v=19$m={MemoryKb},t={Iterations},p={Parallelism}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}");
    }

    public bool Verify(string password, string passwordHash)
    {
        var parts = passwordHash.Split('$', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 5 || parts[0] != "argon2id")
        {
            return false;
        }

        byte[] salt;
        byte[] expected;
        try
        {
            salt = Convert.FromBase64String(parts[3]);
            expected = Convert.FromBase64String(parts[4]);
        }
        catch (FormatException)
        {
            return false;
        }

        var actual = Compute(password, salt);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    /// <summary>Băm giả để thời gian phản hồi khi sai tài khoản tương đương khi sai mật khẩu (BR-IDN-002).</summary>
    public void PerformDummyVerify() => Verify("dummy-password-for-timing", DummyHash);

    private static byte[] Compute(string password, byte[] salt)
    {
        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            MemorySize = MemoryKb,
            Iterations = Iterations,
            DegreeOfParallelism = Parallelism
        };

        return argon2.GetBytes(HashSize);
    }
}
