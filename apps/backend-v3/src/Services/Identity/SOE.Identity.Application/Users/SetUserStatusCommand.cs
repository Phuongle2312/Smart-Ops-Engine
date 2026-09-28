using SOE.BuildingBlocks.Application.Abstractions;
using SOE.BuildingBlocks.Domain;
using SOE.Contracts.Identity;
using SOE.Identity.Application.Abstractions;
using SOE.Identity.Domain;

namespace SOE.Identity.Application.Users;

/// <summary>UC-IDN-04/A2 — Bật/tắt tài khoản (FR-IDN-007, FR-IDN-015).</summary>
public sealed record SetUserStatusCommand(Guid UserId, bool IsActive) : ICommand<UserDto>;

internal sealed class SetUserStatusCommandHandler(
    IUserRepository users,
    IRefreshTokenRepository refreshTokens,
    IUnitOfWork unitOfWork,
    IEventPublisher events,
    IUserContext userContext,
    IClock clock)
    : ICommandHandler<SetUserStatusCommand, UserDto>
{
    public async Task<Result<UserDto>> Handle(SetUserStatusCommand command, CancellationToken ct)
    {
        var user = await users.GetByIdAsync(command.UserId, ct);
        if (user is null)
        {
            return Result.Failure<UserDto>(IdentityErrors.UserNotFound);
        }

        var now = clock.UtcNow;

        if (!command.IsActive)
        {
            // Không cho tự vô hiệu hóa chính mình và không cho tắt ADMIN cuối cùng (FR-IDN-015).
            if (user.Id == userContext.UserId ||
                (user.Role == UserRole.Admin && user.IsActive && await users.CountActiveAdminsAsync(ct) <= 1))
            {
                return Result.Failure<UserDto>(IdentityErrors.LastAdmin);
            }
        }

        var result = user.SetActive(command.IsActive, now, userContext.UserId);
        if (result.IsFailure)
        {
            return Result.Failure<UserDto>(result.Error);
        }

        users.Update(user);

        if (!command.IsActive)
        {
            // Vô hiệu hóa ⇒ thu hồi mọi phiên ngay (BR-IDN-006).
            foreach (var token in await refreshTokens.GetActiveByUserAsync(user.Id, ct))
            {
                token.Revoke(now, "USER_DEACTIVATED");
                refreshTokens.Update(token);
            }
        }

        await unitOfWork.SaveChangesAsync(ct);

        await events.PublishAsync(
            new UserChangedV1(user.Id, user.Username.Value,
                command.IsActive ? "ACTIVATED" : "DEACTIVATED", userContext.UserId, now), ct);

        return Result.Success(UserDto.From(user));
    }
}
