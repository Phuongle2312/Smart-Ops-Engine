using SOE.BuildingBlocks.Application.Abstractions;
using SOE.BuildingBlocks.Domain;
using SOE.Identity.Application.Abstractions;
using SOE.Identity.Domain;

namespace SOE.Identity.Application.Users;

/// <summary>UC-IDN-04/A4 — ADMIN buộc một người dùng đăng xuất khỏi mọi thiết bị (FR-IDN-014).</summary>
public sealed record RevokeSessionsCommand(Guid UserId) : ICommand;

internal sealed class RevokeSessionsCommandHandler(
    IUserRepository users,
    IRefreshTokenRepository refreshTokens,
    IUnitOfWork unitOfWork,
    IClock clock)
    : ICommandHandler<RevokeSessionsCommand>
{
    public async Task<Result> Handle(RevokeSessionsCommand command, CancellationToken ct)
    {
        var user = await users.GetByIdAsync(command.UserId, ct);
        if (user is null)
        {
            return Result.Failure(IdentityErrors.UserNotFound);
        }

        var now = clock.UtcNow;

        foreach (var token in await refreshTokens.GetActiveByUserAsync(user.Id, ct))
        {
            token.Revoke(now, "ADMIN_REVOKED");
            refreshTokens.Update(token);
        }

        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }
}
