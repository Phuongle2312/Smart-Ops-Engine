namespace SOE.BuildingBlocks.Application.Abstractions;

/// <summary>Nguồn thời gian — không dùng DateTime.Now trực tiếp để test được (quy ước §6.3).</summary>
public interface IClock
{
    DateTimeOffset UtcNow { get; }
}

/// <summary>Thông tin người dùng của request hiện tại, lấy từ JWT (không tin header do client gắn).</summary>
public interface IUserContext
{
    bool IsAuthenticated { get; }

    Guid UserId { get; }

    string Username { get; }

    string Role { get; }

    string? CorrelationId { get; }

    string? IpAddress { get; }

    string? UserAgent { get; }
}

/// <summary>Phát integration event ra bus (v3 M1: ghi log/outbox tạm, M2 nối MassTransit).</summary>
public interface IEventPublisher
{
    Task PublishAsync<TEvent>(TEvent @event, CancellationToken cancellationToken = default)
        where TEvent : class;
}
