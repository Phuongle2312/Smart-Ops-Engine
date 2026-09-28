using SOE.BuildingBlocks.Domain;

namespace SOE.Identity.Domain;

/// <summary>
/// Mã lỗi của Identity (docs/02_srs/01_identity.md §5). Thông báo đăng nhập cố tình mơ hồ
/// để không tiết lộ tài khoản có tồn tại hay không (BR-IDN-001).
/// </summary>
public static class IdentityErrors
{
    public static readonly Error InvalidCredentials = Error.Unauthorized(
        "SOE-IDN-401", "Tên đăng nhập hoặc mật khẩu không đúng.");

    public static readonly Error SessionExpired = Error.Unauthorized(
        "SOE-IDN-402", "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");

    public static readonly Error AccountDisabled = Error.Forbidden(
        "SOE-IDN-403", "Tài khoản đã bị vô hiệu hóa.");

    public static Error AccountLocked(int minutesRemaining) => Error.Locked(
        "SOE-IDN-423",
        $"Tài khoản đang tạm khóa. Vui lòng thử lại sau {minutesRemaining} phút.");

    public static readonly Error UserNotFound = Error.NotFound(
        "SOE-IDN-404", "Không tìm thấy người dùng.");

    public static readonly Error UsernameTaken = Error.Conflict(
        "SOE-IDN-409", "Tên đăng nhập đã được sử dụng.");

    public static readonly Error EmailTaken = Error.Conflict(
        "SOE-IDN-409", "Email đã được sử dụng.");

    public static readonly Error LastAdmin = Error.Unprocessable(
        "SOE-IDN-422", "Không thể vô hiệu hóa hoặc hạ quyền quản trị viên cuối cùng.");

    public static readonly Error SamePassword = Error.Validation(
        "SOE-IDN-400", "Mật khẩu mới phải khác mật khẩu hiện tại.");

    public static readonly Error WeakPassword = Error.Validation(
        "SOE-IDN-400", "Mật khẩu quá phổ biến, vui lòng chọn mật khẩu khác.");

    public static readonly Error TokenReuse = Error.Unauthorized(
        "SOE-IDN-402", "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
}
