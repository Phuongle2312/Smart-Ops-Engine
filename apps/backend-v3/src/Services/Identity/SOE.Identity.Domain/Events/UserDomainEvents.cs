using SOE.BuildingBlocks.Domain;

namespace SOE.Identity.Domain.Events;

public sealed record UserCreatedDomainEvent(
    Guid UserId, string Username, UserRole Role, Guid? ActorId, DateTimeOffset OccurredAt) : IDomainEvent;

public sealed record UserChangedDomainEvent(
    Guid UserId, string Username, string ChangeKind, Guid? ActorId, DateTimeOffset OccurredAt) : IDomainEvent;

public sealed record UserLoggedInDomainEvent(
    Guid UserId, string Username, UserRole Role, DateTimeOffset OccurredAt) : IDomainEvent;

public sealed record UserLockedDomainEvent(
    Guid UserId, string Username, DateTimeOffset LockedUntil, DateTimeOffset OccurredAt) : IDomainEvent;

public sealed record UserPasswordChangedDomainEvent(
    Guid UserId, string Username, DateTimeOffset OccurredAt) : IDomainEvent;

public sealed record TokenReuseDetectedDomainEvent(
    Guid UserId, Guid FamilyId, DateTimeOffset OccurredAt) : IDomainEvent;
