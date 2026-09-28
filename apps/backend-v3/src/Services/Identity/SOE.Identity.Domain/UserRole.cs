namespace SOE.Identity.Domain;

/// <summary>Ba vai trò của hệ thống (docs §4 api_gateway_security).</summary>
public enum UserRole
{
    Viewer = 0,
    Operator = 1,
    Admin = 2
}

public static class UserRoleExtensions
{
    public static string ToClaimValue(this UserRole role) => role switch
    {
        UserRole.Admin => "ADMIN",
        UserRole.Operator => "OPERATOR",
        _ => "VIEWER"
    };

    public static bool TryParse(string? value, out UserRole role)
    {
        switch (value?.Trim().ToUpperInvariant())
        {
            case "ADMIN":
                role = UserRole.Admin;
                return true;
            case "OPERATOR":
                role = UserRole.Operator;
                return true;
            case "VIEWER":
                role = UserRole.Viewer;
                return true;
            default:
                role = UserRole.Viewer;
                return false;
        }
    }
}
