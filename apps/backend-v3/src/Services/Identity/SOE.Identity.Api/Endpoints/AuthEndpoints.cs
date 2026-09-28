using MediatR;
using Microsoft.AspNetCore.Mvc;
using SOE.BuildingBlocks.Web;
using SOE.Identity.Application.Authentication;

namespace SOE.Identity.Api.Endpoints;

public sealed record LoginRequest(string Username, string Password);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public sealed record LoginResponse(
    string AccessToken,
    string TokenType,
    int ExpiresIn,
    bool MustChangePassword,
    object User);

/// <summary>
/// Endpoint xác thực (docs/02_srs/01_identity.md §5).
/// Refresh token đi qua cookie HttpOnly; access token trả trong body cho SPA giữ trong bộ nhớ.
/// </summary>
public static class AuthEndpoints
{
    public const string RefreshCookieName = "soe_rt";
    private const string CookiePath = "/api/v1/auth";

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/auth").WithTags("Auth");

        group.MapPost("/login", async (
            LoginRequest request,
            ISender sender,
            HttpContext http,
            CancellationToken ct) =>
        {
            var command = new LoginCommand(
                request.Username,
                request.Password,
                http.Connection.RemoteIpAddress?.ToString());

            var result = await sender.Send(command, ct);
            if (result.IsFailure)
            {
                return ApiResults.Problem(result, http);
            }

            SetRefreshCookie(http, result.Value.RefreshToken);

            return Results.Ok(new LoginResponse(
                result.Value.AccessToken,
                "Bearer",
                result.Value.ExpiresInSeconds,
                result.Value.MustChangePassword,
                result.Value.User));
        })
        .AllowAnonymous()
        .RequireRateLimiting("login")
        .WithName("Login")
        .WithSummary("Đăng nhập hệ thống");

        group.MapPost("/refresh", async (ISender sender, HttpContext http, CancellationToken ct) =>
        {
            var refreshToken = http.Request.Cookies[RefreshCookieName];
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                return Results.Problem(new ProblemDetails
                {
                    Type = "https://docs.soe.local/errors/SOE-IDN-402",
                    Title = "Chưa xác thực",
                    Status = StatusCodes.Status401Unauthorized,
                    Detail = "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.",
                    Instance = http.Request.Path
                });
            }

            var command = new RefreshTokenCommand(refreshToken, http.Connection.RemoteIpAddress?.ToString());
            var result = await sender.Send(command, ct);

            if (result.IsFailure)
            {
                ClearRefreshCookie(http);
                return ApiResults.Problem(result, http);
            }

            SetRefreshCookie(http, result.Value.RefreshToken);

            return Results.Ok(new LoginResponse(
                result.Value.AccessToken,
                "Bearer",
                result.Value.ExpiresInSeconds,
                result.Value.MustChangePassword,
                result.Value.User));
        })
        .AllowAnonymous()
        .WithName("RefreshToken")
        .WithSummary("Làm mới access token");

        group.MapPost("/logout", async (ISender sender, HttpContext http, CancellationToken ct) =>
        {
            var refreshToken = http.Request.Cookies[RefreshCookieName];
            var result = await sender.Send(new LogoutCommand(refreshToken), ct);

            ClearRefreshCookie(http);

            return result.IsFailure ? ApiResults.Problem(result, http) : Results.NoContent();
        })
        .RequireAuthorization()
        .WithName("Logout")
        .WithSummary("Đăng xuất");

        app.MapPut("/api/v1/me/password", async (
            ChangePasswordRequest request,
            ISender sender,
            HttpContext http,
            CancellationToken ct) =>
        {
            var result = await sender.Send(
                new ChangePasswordCommand(request.CurrentPassword, request.NewPassword), ct);

            if (result.IsFailure)
            {
                return ApiResults.Problem(result, http);
            }

            ClearRefreshCookie(http);
            return Results.NoContent();
        })
        .RequireAuthorization()
        .WithTags("Auth")
        .WithName("ChangeOwnPassword")
        .WithSummary("Đổi mật khẩu của chính mình");

        return app;
    }

    private static void SetRefreshCookie(HttpContext http, string value) =>
        http.Response.Cookies.Append(RefreshCookieName, value, new CookieOptions
        {
            HttpOnly = true,
            Secure = !http.Request.Host.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase),
            SameSite = SameSiteMode.Strict,
            Path = CookiePath,
            MaxAge = TimeSpan.FromDays(7),
            IsEssential = true
        });

    private static void ClearRefreshCookie(HttpContext http) =>
        http.Response.Cookies.Delete(RefreshCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = !http.Request.Host.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase),
            SameSite = SameSiteMode.Strict,
            Path = CookiePath
        });
}
