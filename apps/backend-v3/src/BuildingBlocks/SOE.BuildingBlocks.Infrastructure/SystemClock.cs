using SOE.BuildingBlocks.Application.Abstractions;

namespace SOE.BuildingBlocks.Infrastructure;

/// <summary>Hiện thực mặc định của IClock — luôn trả giờ UTC.</summary>
public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
