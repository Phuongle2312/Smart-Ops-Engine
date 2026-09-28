namespace SOE.BuildingBlocks.Domain;

/// <summary>Sự kiện miền — mô tả việc đã xảy ra bên trong một aggregate.</summary>
public interface IDomainEvent
{
    DateTimeOffset OccurredAt { get; }
}
