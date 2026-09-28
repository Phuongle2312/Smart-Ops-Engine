using Microsoft.Extensions.Logging;
using SOE.BuildingBlocks.Application.Abstractions;

namespace SOE.BuildingBlocks.Infrastructure;

/// <summary>
/// Hiện thực tạm của IEventPublisher cho M1: chỉ ghi log.
/// M2 sẽ thay bằng MassTransit + transactional outbox mà không phải sửa Application layer (DIP).
/// </summary>
public sealed class LoggingEventPublisher(ILogger<LoggingEventPublisher> logger) : IEventPublisher
{
    public Task PublishAsync<TEvent>(TEvent @event, CancellationToken cancellationToken = default)
        where TEvent : class
    {
        logger.LogInformation("Phát integration event {EventType}", typeof(TEvent).Name);
        return Task.CompletedTask;
    }
}
