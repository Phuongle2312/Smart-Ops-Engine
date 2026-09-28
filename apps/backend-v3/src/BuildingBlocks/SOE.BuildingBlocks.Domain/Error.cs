namespace SOE.BuildingBlocks.Domain;

public enum ErrorType
{
    Validation,
    NotFound,
    Conflict,
    Unauthorized,
    Forbidden,
    Locked,
    Unprocessable,
    Unavailable,
    Unexpected
}

/// <summary>
/// Lỗi nghiệp vụ: <paramref name="Code"/> theo quy ước SOE-&lt;MOD&gt;-NNN,
/// <paramref name="Message"/> là thông báo tiếng Việt hiển thị cho người dùng.
/// </summary>
public sealed record Error(string Code, string Message, ErrorType Type)
{
    public static readonly Error None = new(string.Empty, string.Empty, ErrorType.Unexpected);

    /// <summary>Lỗi validate theo từng trường, dùng để dựng phần "errors" của ProblemDetails.</summary>
    public IReadOnlyDictionary<string, string[]>? FieldErrors { get; init; }

    public static Error Validation(string code, string message,
        IReadOnlyDictionary<string, string[]>? fieldErrors = null) =>
        new(code, message, ErrorType.Validation) { FieldErrors = fieldErrors };

    public static Error NotFound(string code, string message) => new(code, message, ErrorType.NotFound);

    public static Error Conflict(string code, string message) => new(code, message, ErrorType.Conflict);

    public static Error Unauthorized(string code, string message) => new(code, message, ErrorType.Unauthorized);

    public static Error Forbidden(string code, string message) => new(code, message, ErrorType.Forbidden);

    public static Error Locked(string code, string message) => new(code, message, ErrorType.Locked);

    public static Error Unprocessable(string code, string message) => new(code, message, ErrorType.Unprocessable);
}
