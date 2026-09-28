using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace SOE.BuildingBlocks.Web.Middleware;

/// <summary>
/// Bắt mọi exception chưa xử lý và trả ProblemDetails 500 — không lộ stack trace ra ngoài
/// (FR-GW-014, OWASP API8). Chi tiết lỗi chỉ nằm trong log.
/// </summary>
public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // Client hủy request — không phải lỗi hệ thống.
            logger.LogDebug("Request {Path} bị hủy bởi client", context.Request.Path);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Lỗi chưa xử lý tại {Path}", context.Request.Path);

            if (context.Response.HasStarted)
            {
                throw;
            }

            var problem = new ProblemDetails
            {
                Type = "https://docs.soe.local/errors/SOE-SYS-500",
                Title = "Lỗi hệ thống",
                Status = StatusCodes.Status500InternalServerError,
                Detail = "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
                Instance = context.Request.Path
            };
            problem.Extensions["code"] = "SOE-SYS-500";
            problem.Extensions["correlationId"] = context.TraceIdentifier;

            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/problem+json";
            await context.Response.WriteAsJsonAsync(problem);
        }
    }
}
