using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using SOE.BuildingBlocks.Application.Abstractions;
using SOE.BuildingBlocks.Web.Middleware;

namespace SOE.BuildingBlocks.Web.Authentication;

/// <summary>
/// Lấy thông tin người dùng từ JWT đã xác thực — KHÔNG đọc header do client tự gắn
/// (chống nâng quyền, TC-GW-SEC-009).
/// </summary>
public sealed class HttpUserContext(IHttpContextAccessor accessor) : IUserContext
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated ?? false;

    public Guid UserId =>
        Guid.TryParse(Principal?.FindFirstValue(ClaimTypes.NameIdentifier) ?? Principal?.FindFirstValue("sub"),
            out var id)
            ? id
            : Guid.Empty;

    public string Username => Principal?.FindFirstValue("name") ?? string.Empty;

    public string Role => Principal?.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

    public string? CorrelationId => accessor.HttpContext?.TraceIdentifier;

    public string? IpAddress => accessor.HttpContext?.Connection.RemoteIpAddress?.ToString();

    public string? UserAgent => accessor.HttpContext?.Request.Headers.UserAgent.FirstOrDefault();

    public static string HeaderCorrelationId => CorrelationIdMiddleware.HeaderName;
}
