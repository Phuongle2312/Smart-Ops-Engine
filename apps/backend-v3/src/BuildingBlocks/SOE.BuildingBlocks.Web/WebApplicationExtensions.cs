using Microsoft.AspNetCore.Builder;
using SOE.BuildingBlocks.Web.Middleware;

namespace SOE.BuildingBlocks.Web;

public static class WebApplicationExtensions
{
    /// <summary>
    /// Pipeline chuẩn cho mọi service: bắt lỗi → correlation id → security headers.
    /// Gọi ngay đầu pipeline, trước authentication.
    /// </summary>
    public static IApplicationBuilder UseSoeRequestPipeline(this IApplicationBuilder app)
    {
        app.UseMiddleware<ExceptionHandlingMiddleware>();
        app.UseMiddleware<CorrelationIdMiddleware>();
        app.UseMiddleware<SecurityHeadersMiddleware>();
        return app;
    }
}
