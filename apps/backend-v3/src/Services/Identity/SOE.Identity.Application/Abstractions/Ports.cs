using SOE.Identity.Domain;

namespace SOE.Identity.Application.Abstractions;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<User?> GetByUsernameAsync(string username, CancellationToken ct = default);

    Task<bool> UsernameExistsAsync(string username, CancellationToken ct = default);

    Task<bool> EmailExistsAsync(string email, Guid? excludeUserId = null, CancellationToken ct = default);

    /// <summary>Đếm ADMIN đang hoạt động — phục vụ quy tắc "ADMIN cuối cùng" (FR-IDN-015).</summary>
    Task<int> CountActiveAdminsAsync(CancellationToken ct = default);

    Task<(IReadOnlyList<User> Items, int TotalItems)> ListAsync(
        string? search,
        UserRole? role,
        bool? isActive,
        int page,
        int pageSize,
        CancellationToken ct = default);

    Task AddAsync(User user, CancellationToken ct = default);

    void Update(User user);
}

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetByHashAsync(byte[] tokenHash, CancellationToken ct = default);

    Task<IReadOnlyList<RefreshToken>> GetActiveByUserAsync(Guid userId, CancellationToken ct = default);

    Task<IReadOnlyList<RefreshToken>> GetByFamilyAsync(Guid familyId, CancellationToken ct = default);

    Task AddAsync(RefreshToken token, CancellationToken ct = default);

    void Update(RefreshToken token);
}

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

/// <summary>Băm & kiểm tra mật khẩu (mặc định Argon2id — NFR-SEC-004).</summary>
public interface IPasswordHasher
{
    string Hash(string password);

    bool Verify(string password, string passwordHash);

    /// <summary>Băm giả khi không tìm thấy người dùng để giữ thời gian phản hồi hằng định (BR-IDN-002).</summary>
    void PerformDummyVerify();
}

/// <summary>Kiểm tra mật khẩu có nằm trong danh sách phổ biến/yếu hay không (BR-IDN-007).</summary>
public interface IPasswordPolicy
{
    bool IsWeak(string password);

    string GenerateTemporaryPassword();
}

public sealed record AccessToken(string Value, int ExpiresInSeconds);

public sealed record RefreshTokenMaterial(string RawValue, byte[] Hash);

public interface ITokenService
{
    AccessToken CreateAccessToken(User user, Guid sessionId);

    RefreshTokenMaterial CreateRefreshToken();

    byte[] HashRefreshToken(string rawValue);
}
