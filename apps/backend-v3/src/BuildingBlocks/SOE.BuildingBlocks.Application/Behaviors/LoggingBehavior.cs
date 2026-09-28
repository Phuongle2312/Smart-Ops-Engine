using System.Diagnostics;
using MediatR;
using Microsoft.Extensions.Logging;
using SOE.BuildingBlocks.Domain;

namespace SOE.BuildingBlocks.Application.Behaviors;

/// <summary>Ghi log thời gian xử lý và kết quả của mỗi command/query (không ghi nội dung request).</summary>
public sealed class LoggingBehavior<TRequest, TResponse>(ILogger<LoggingBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
    where TResponse : Result
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var name = typeof(TRequest).Name;
        var stopwatch = Stopwatch.StartNew();

        var response = await next();
        stopwatch.Stop();

        if (response.IsSuccess)
        {
            logger.LogInformation("{RequestName} hoàn tất trong {ElapsedMs} ms", name, stopwatch.ElapsedMilliseconds);
        }
        else
        {
            logger.LogWarning(
                "{RequestName} thất bại sau {ElapsedMs} ms với lỗi {ErrorCode}",
                name,
                stopwatch.ElapsedMilliseconds,
                response.Error.Code);
        }

        return response;
    }
}
