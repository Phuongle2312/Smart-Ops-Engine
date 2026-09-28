using System.Text.RegularExpressions;
using SOE.BuildingBlocks.Domain;

namespace SOE.Identity.Domain;

/// <summary>Email liên hệ của người dùng.</summary>
public sealed partial record EmailAddress
{
    public const int MaxLength = 256;

    private EmailAddress(string value) => Value = value;

    public string Value { get; }

    public static Result<EmailAddress> Create(string? input)
    {
        var normalized = input?.Trim() ?? string.Empty;

        if (normalized.Length is 0 or > MaxLength || !Pattern().IsMatch(normalized))
        {
            return Result.Failure<EmailAddress>(Error.Validation("SOE-IDN-400", "Email không hợp lệ."));
        }

        return Result.Success(new EmailAddress(normalized));
    }

    public override string ToString() => Value;

    [GeneratedRegex(@"^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$", RegexOptions.CultureInvariant)]
    private static partial Regex Pattern();
}
