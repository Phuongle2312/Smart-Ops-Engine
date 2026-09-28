using Microsoft.AspNetCore.Http;

namespace SOE.BuildingBlocks.Web.Middleware;

/// <summary>
/// Nhận hoặc sinh X-Correlation-Id, gắn vào TraceIdentifier và trả lại trong response
/// để truy vết xuyên service (NFR-OBS-001).
/// </summary>
public sealed class CorrelationIdMiddleware(RequestDelegate next)
{
    public const string HeaderName = "X-Correlation-Id";

    private const int MaxLength = 64;

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers[HeaderName].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(correlationId) || correlationId.Length > MaxLength)
        {
            correlationId = Guid.NewGuid().ToString("n");
        }

        context.TraceIdentifier = correlationId;
        context.Response.OnStarting(() =>
        {
            context.Response.Headers[HeaderName] = correlationId;
            return Task.CompletedTask;
        });

        await next(context);
    }
}
