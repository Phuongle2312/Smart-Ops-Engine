using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SOE.BuildingBlocks.Application.Abstractions;
using SOE.Identity.Application.Abstractions;
using SOE.Identity.Domain;

namespace SOE.Identity.Infrastructure.Persistence;

/// <summary>
/// Seed tài khoản quản trị đầu tiên (docs §4 data_architecture bước 4).
/// Mật khẩu ban đầu lấy từ cấu hình/biến môi trường; nếu không có thì sinh ngẫu nhiên và ghi ra log một lần.
/// </summary>
public sealed class IdentityDbSeeder(
    IdentityDbContext context,
    IPasswordHasher passwordHasher,
    IPasswordPolicy passwordPolicy,
    IClock clock,
    ILogger<IdentityDbSeeder> logger)
{
    public async Task SeedAsync(string? initialAdminPassword, CancellationToken ct = default)
    {
        if (await context.Users.AnyAsync(ct))
        {
            return;
        }

        var password = string.IsNullOrWhiteSpace(initialAdminPassword)
            ? passwordPolicy.GenerateTemporaryPassword()
            : initialAdminPassword;

        var username = Username.Create("admin").Value;
        var email = EmailAddress.Create("admin@smartops.local").Value;

        var admin = User.Create(
            username,
            passwordHasher.Hash(password),
            "Quản trị hệ thống",
            email,
            UserRole.Admin,
            clock.UtcNow);

        await context.Users.AddAsync(admin, ct);
        await context.SaveChangesAsync(ct);

        if (string.IsNullOrWhiteSpace(initialAdminPassword))
        {
            logger.LogWarning(
                "Đã tạo tài khoản admin với mật khẩu tạm: {Password} — hãy đổi ngay sau lần đăng nhập đầu tiên.",
                password);
        }
        else
        {
            logger.LogInformation("Đã tạo tài khoản admin từ cấu hình Identity:InitialAdminPassword.");
        }
    }
}
