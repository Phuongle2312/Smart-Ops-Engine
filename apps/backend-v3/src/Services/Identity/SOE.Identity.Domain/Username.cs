using System.Text.RegularExpressions;
using SOE.BuildingBlocks.Domain;

namespace SOE.Identity.Domain;

/// <summary>Tên đăng nhập: 3–64 ký tự, chỉ chữ thường/số/. _ - (SRS 01 §6).</summary>
public sealed partial record Username
{
    public const int MinLength = 3;
    public const int MaxLength = 64;

    private Username(string value) => Value = value;

    public string Value { get; }

    public static Result<Username> Create(string? input)
    {
        var normalized = input?.Trim().ToLowerInvariant() ?? string.Empty;

        if (normalized.Length is < MinLength or > MaxLength || !Pattern().IsMatch(normalized))
        {
            return Result.Failure<Username>(Error.Validation(
                "SOE-IDN-400",
                "Tên đăng nhập chỉ gồm chữ thường, số, dấu . _ - và dài 3–64 ký tự."));
        }

        return Result.Success(new Username(normalized));
    }

    public override string ToString() => Value;

    [GeneratedRegex(@"^[a-z0-9._-]+$", RegexOptions.CultureInvariant)]
    private static partial Regex Pattern();
}
