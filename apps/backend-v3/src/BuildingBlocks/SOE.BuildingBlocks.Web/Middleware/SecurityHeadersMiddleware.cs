using Microsoft.AspNetCore.Http;

namespace SOE.BuildingBlocks.Web.Middleware;

/// <summary>Bộ header bảo mật bắt buộc (docs §6 api_gateway_security, NFR-SEC-011).</summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers["X-Content-Type-Options"] = "nosniff";
            headers["X-Frame-Options"] = "DENY";
            headers["Referrer-Policy"] = "no-referrer";
            headers["Cross-Origin-Opener-Policy"] = "same-origin";
            headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()";
            headers["Cache-Control"] = "no-store";

            // Không lộ thông tin hạ tầng (FR-GW-014)
            headers.Remove("Server");
            headers.Remove("X-Powered-By");

            return Task.CompletedTask;
        });

        await next(context);
    }
}
