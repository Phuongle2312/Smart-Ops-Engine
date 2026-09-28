using SOE.Identity.Domain;

namespace SOE.Identity.Application.Users;

/// <summary>
/// DTO người dùng trả ra API — KHÔNG bao giờ chứa PasswordHash (FR-IDN-006, OWASP API3).
/// </summary>
public sealed record UserDto(
    Guid Id,
    string Username,
    string FullName,
    string Email,
    string Role,
    bool IsActive,
    bool MustChangePassword,
    DateTimeOffset? LockedUntil,
    DateTimeOffset? LastLoginAt,
    DateTimeOffset CreatedAt)
{
    public static UserDto From(User user) => new(
        user.Id,
        user.Username.Value,
        user.FullName,
        user.Email.Value,
        user.Role.ToClaimValue(),
        user.IsActive,
        user.MustChangePassword,
        user.LockedUntil,
        user.LastLoginAt,
        user.CreatedAt);
}

/// <summary>Thông tin người đang đăng nhập kèm danh sách quyền (FR-IDN-009).</summary>
public sealed record CurrentUserDto(
    Guid Id,
    string Username,
    string FullName,
    string Email,
    string Role,
    IReadOnlyList<string> Permissions,
    bool MustChangePassword,
    DateTimeOffset? LastLoginAt);

public static class RolePermissions
{
    private static readonly string[] ViewerPermissions =
    [
        "node:read", "metric:read", "incident:read"
    ];

    private static readonly string[] OperatorPermissions =
    [
        "node:read", "metric:read", "metric:export", "incident:read",
        "incident:ack", "incident:resolve", "check:run", "node:toggle"
    ];

    private static readonly string[] AdminPermissions =
    [
        "node:read", "node:write", "node:delete", "node:toggle", "node:test-connection",
        "metric:read", "metric:export",
        "incident:read", "incident:ack", "incident:resolve", "threshold:write",
        "check:run", "channel:read", "channel:write", "channel:test",
        "audit:read", "config:write", "user:read", "user:write"
    ];

    public static IReadOnlyList<string> For(UserRole role) => role switch
    {
        UserRole.Admin => AdminPermissions,
        UserRole.Operator => OperatorPermissions,
        _ => ViewerPermissions
    };
}
