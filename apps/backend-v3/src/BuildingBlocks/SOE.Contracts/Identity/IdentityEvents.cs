namespace SOE.Contracts.Identity;

/// <summary>Đăng nhập thành công (FR-IDN-012).</summary>
public sealed record UserLoggedInV1(
    Guid UserId,
    string Username,
    string Role,
    string? IpHash,
    string? UserAgentHash,
    DateTimeOffset OccurredAt);

/// <summary>Đăng nhập thất bại — phục vụ phát hiện brute force.</summary>
public sealed record UserLoginFailedV1(
    string Username,
    string Reason,
    string? IpHash,
    DateTimeOffset OccurredAt);

/// <summary>Tài khoản bị khóa tạm thời (FR-IDN-005).</summary>
public sealed record UserLockedV1(
    Guid UserId,
    string Username,
    DateTimeOffset LockedUntil,
    DateTimeOffset OccurredAt);

/// <summary>Tạo/sửa/đổi vai trò/bật tắt người dùng (FR-IDN-006, FR-IDN-007).</summary>
public sealed record UserChangedV1(
    Guid UserId,
    string Username,
    string ChangeKind,
    Guid? ActorId,
    DateTimeOffset OccurredAt);

/// <summary>Phát hiện tái sử dụng refresh token — sự kiện bảo mật mức cao (FR-IDN-003).</summary>
public sealed record TokenReuseDetectedV1(
    Guid UserId,
    Guid FamilyId,
    string? IpHash,
    DateTimeOffset OccurredAt);
