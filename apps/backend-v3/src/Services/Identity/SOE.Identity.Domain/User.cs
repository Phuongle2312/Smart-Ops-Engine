using SOE.BuildingBlocks.Domain;
using SOE.Identity.Domain.Events;

namespace SOE.Identity.Domain;

/// <summary>
/// Người dùng hệ thống. Quy tắc khóa tài khoản, đổi mật khẩu, đổi vai trò nằm trong entity
/// (docs/02_srs/01_identity.md §4, BR-IDN-*).
/// </summary>
public sealed class User : AggregateRoot<Guid>
{
    public const int MaxFailedAttempts = 5;
    public static readonly TimeSpan LockDuration = TimeSpan.FromMinutes(15);

    private User() { }

    private User(
        Guid id,
        Username username,
        string passwordHash,
        string fullName,
        EmailAddress email,
        UserRole role,
        DateTimeOffset now) : base(id)
    {
        Username = username;
        PasswordHash = passwordHash;
        FullName = fullName;
        Email = email;
        Role = role;
        IsActive = true;
        MustChangePassword = true;
        PasswordChangedAt = now;
        CreatedAt = now;
        UpdatedAt = now;
    }

    public Username Username { get; private set; } = null!;

    public string PasswordHash { get; private set; } = string.Empty;

    public string FullName { get; private set; } = string.Empty;

    public EmailAddress Email { get; private set; } = null!;

    public UserRole Role { get; private set; }

    public bool IsActive { get; private set; }

    public bool MustChangePassword { get; private set; }

    public int FailedLoginCount { get; private set; }

    public DateTimeOffset? LockedUntil { get; private set; }

    public DateTimeOffset PasswordChangedAt { get; private set; }

    public DateTimeOffset? LastLoginAt { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public static User Create(
        Username username,
        string passwordHash,
        string fullName,
        EmailAddress email,
        UserRole role,
        DateTimeOffset now,
        Guid? actorId = null)
    {
        var user = new User(Guid.NewGuid(), username, passwordHash, fullName, email, role, now);
        user.Raise(new UserCreatedDomainEvent(user.Id, username.Value, role, actorId, now));
        return user;
    }

    public bool IsLocked(DateTimeOffset now) => LockedUntil is not null && LockedUntil > now;

    public int LockMinutesRemaining(DateTimeOffset now) =>
        IsLocked(now) ? Math.Max(1, (int)Math.Ceiling((LockedUntil!.Value - now).TotalMinutes)) : 0;

    /// <summary>Ghi nhận một lần đăng nhập sai; đủ 5 lần thì khóa 15 phút (FR-IDN-005).</summary>
    public void RegisterFailedLogin(DateTimeOffset now)
    {
        FailedLoginCount++;
        UpdatedAt = now;

        if (FailedLoginCount < MaxFailedAttempts)
        {
            return;
        }

        LockedUntil = now.Add(LockDuration);
        FailedLoginCount = 0;
        Raise(new UserLockedDomainEvent(Id, Username.Value, LockedUntil.Value, now));
    }

    public void RegisterSuccessfulLogin(DateTimeOffset now)
    {
        FailedLoginCount = 0;
        LockedUntil = null;
        LastLoginAt = now;
        UpdatedAt = now;
        Raise(new UserLoggedInDomainEvent(Id, Username.Value, Role, now));
    }

    /// <summary>Đổi mật khẩu; gọi xong phải thu hồi toàn bộ refresh token (FR-IDN-008).</summary>
    public void ChangePassword(string newPasswordHash, DateTimeOffset now)
    {
        PasswordHash = newPasswordHash;
        PasswordChangedAt = now;
        MustChangePassword = false;
        UpdatedAt = now;
        Raise(new UserPasswordChangedDomainEvent(Id, Username.Value, now));
    }

    /// <summary>Đặt lại mật khẩu bởi ADMIN: người dùng buộc phải đổi ở lần đăng nhập kế tiếp.</summary>
    public void ResetPassword(string temporaryPasswordHash, DateTimeOffset now, Guid actorId)
    {
        PasswordHash = temporaryPasswordHash;
        PasswordChangedAt = now;
        MustChangePassword = true;
        FailedLoginCount = 0;
        LockedUntil = null;
        UpdatedAt = now;
        Raise(new UserChangedDomainEvent(Id, Username.Value, "PASSWORD_RESET", actorId, now));
    }

    public Result UpdateProfile(string fullName, EmailAddress email, DateTimeOffset now, Guid actorId)
    {
        if (string.IsNullOrWhiteSpace(fullName))
        {
            return Result.Failure(Error.Validation("SOE-IDN-400", "Vui lòng nhập họ tên."));
        }

        FullName = fullName.Trim();
        Email = email;
        UpdatedAt = now;
        Raise(new UserChangedDomainEvent(Id, Username.Value, "PROFILE_UPDATED", actorId, now));
        return Result.Success();
    }

    /// <summary>Đổi vai trò. Người gọi phải kiểm tra quy tắc "ADMIN cuối cùng" trước (FR-IDN-015).</summary>
    public Result ChangeRole(UserRole role, DateTimeOffset now, Guid actorId)
    {
        if (Role == role)
        {
            return Result.Success();
        }

        Role = role;
        UpdatedAt = now;
        Raise(new UserChangedDomainEvent(Id, Username.Value, "ROLE_CHANGED", actorId, now));
        return Result.Success();
    }

    public Result SetActive(bool isActive, DateTimeOffset now, Guid actorId)
    {
        if (IsActive == isActive)
        {
            return Result.Success();
        }

        IsActive = isActive;
        UpdatedAt = now;

        if (!isActive)
        {
            FailedLoginCount = 0;
            LockedUntil = null;
        }

        Raise(new UserChangedDomainEvent(
            Id, Username.Value, isActive ? "ACTIVATED" : "DEACTIVATED", actorId, now));

        return Result.Success();
    }
}
