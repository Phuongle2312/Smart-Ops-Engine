using Microsoft.EntityFrameworkCore;
using SOE.Identity.Application.Abstractions;
using SOE.Identity.Domain;

namespace SOE.Identity.Infrastructure.Persistence;

internal sealed class RefreshTokenRepository(IdentityDbContext context) : IRefreshTokenRepository
{
    public Task<RefreshToken?> GetByHashAsync(byte[] tokenHash, CancellationToken ct = default) =>
        context.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == tokenHash, ct);

    public async Task<IReadOnlyList<RefreshToken>> GetActiveByUserAsync(
        Guid userId, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        return await context.RefreshTokens
            .Where(t => t.UserId == userId && t.UsedAt == null && t.RevokedAt == null && t.ExpiresAt > now)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<RefreshToken>> GetByFamilyAsync(
        Guid familyId, CancellationToken ct = default) =>
        await context.RefreshTokens.Where(t => t.FamilyId == familyId).ToListAsync(ct);

    public async Task AddAsync(RefreshToken token, CancellationToken ct = default) =>
        await context.RefreshTokens.AddAsync(token, ct);

    public void Update(RefreshToken token) => context.RefreshTokens.Update(token);
}
