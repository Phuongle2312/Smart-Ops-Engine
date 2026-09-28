using SOE.BuildingBlocks.Domain;

namespace SOE.Identity.Domain;

/// <summary>
/// Refresh token dạng opaque: CSDL chỉ lưu **hash SHA-256**; token gốc chỉ tồn tại trong cookie của client.
/// Mỗi lần dùng sẽ xoay vòng (rotation); dùng lại token đã dùng ⇒ thu hồi cả FamilyId (FR-IDN-002, 003).
/// </summary>
public sealed class RefreshToken : Entity<Guid>
{
    public const int MaxActiveSessionsPerUser = 5;
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);
    public static readonly TimeSpan FamilyMaxLifetime = TimeSpan.FromDays(30);

    private RefreshToken() { }

    private RefreshToken(
        Guid id,
        Guid userId,
        byte[] tokenHash,
        Guid familyId,
        DateTimeOffset createdAt,
        DateTimeOffset expiresAt,
        DateTimeOffset familyExpiresAt,
        string? createdByIp) : base(id)
    {
        UserId = userId;
        TokenHash = tokenHash;
        FamilyId = familyId;
        CreatedAt = createdAt;
        ExpiresAt = expiresAt;
        FamilyExpiresAt = familyExpiresAt;
        CreatedByIp = createdByIp;
    }

    public Guid UserId { get; private set; }

    public byte[] TokenHash { get; private set; } = Array.Empty<byte>();

    public Guid FamilyId { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset ExpiresAt { get; private set; }

    /// <summary>Hạn cuối của cả chuỗi token (BR-IDN-005: tối đa 30 ngày).</summary>
    public DateTimeOffset FamilyExpiresAt { get; private set; }

    public DateTimeOffset? UsedAt { get; private set; }

    public DateTimeOffset? RevokedAt { get; private set; }

    public string? RevokedReason { get; private set; }

    public string? CreatedByIp { get; private set; }

    public static RefreshToken Issue(
        Guid userId,
        byte[] tokenHash,
        DateTimeOffset now,
        string? createdByIp,
        Guid? familyId = null,
        DateTimeOffset? familyExpiresAt = null) =>
        new(Guid.NewGuid(),
            userId,
            tokenHash,
            familyId ?? Guid.NewGuid(),
            now,
            now.Add(Lifetime),
            familyExpiresAt ?? now.Add(FamilyMaxLifetime),
            createdByIp);

    public bool IsActive(DateTimeOffset now) =>
        UsedAt is null && RevokedAt is null && ExpiresAt > now && FamilyExpiresAt > now;

    public Result MarkUsed(DateTimeOffset now)
    {
        if (!IsActive(now))
        {
            return Result.Failure(IdentityErrors.SessionExpired);
        }

        UsedAt = now;
        return Result.Success();
    }

    public void Revoke(DateTimeOffset now, string reason)
    {
        if (RevokedAt is not null)
        {
            return;
        }

        RevokedAt = now;
        RevokedReason = reason;
    }
}
