using SOE.BuildingBlocks.Application.Abstractions;
using SOE.BuildingBlocks.Domain;
using SOE.Contracts.Identity;
using SOE.Identity.Application.Abstractions;
using SOE.Identity.Domain;

namespace SOE.Identity.Application.Users;

public sealed record ResetPasswordResult(Guid UserId, string TemporaryPassword);

/// <summary>UC-IDN-04/A3 — ADMIN đặt lại mật khẩu, buộc người dùng đổi ở lần đăng nhập kế tiếp.</summary>
public sealed record ResetPasswordCommand(Guid UserId) : ICommand<ResetPasswordResult>;

internal sealed class ResetPasswordCommandHandler(
    IUserRepository users,
    IRefreshTokenRepository refreshTokens,
    IPasswordHasher passwordHasher,
    IPasswordPolicy passwordPolicy,
    IUnitOfWork unitOfWork,
    IEventPublisher events,
    IUserContext userContext,
    IClock clock)
    : ICommandHandler<ResetPasswordCommand, ResetPasswordResult>
{
    public async Task<Result<ResetPasswordResult>> Handle(ResetPasswordCommand command, CancellationToken ct)
    {
        var user = await users.GetByIdAsync(command.UserId, ct);
        if (user is null)
        {
            return Result.Failure<ResetPasswordResult>(IdentityErrors.UserNotFound);
        }

        var now = clock.UtcNow;
        var temporaryPassword = passwordPolicy.GenerateTemporaryPassword();

        user.ResetPassword(passwordHasher.Hash(temporaryPassword), now, userContext.UserId);
        users.Update(user);

        foreach (var token in await refreshTokens.GetActiveByUserAsync(user.Id, ct))
        {
            token.Revoke(now, "PASSWORD_RESET");
            refreshTokens.Update(token);
        }

        await unitOfWork.SaveChangesAsync(ct);

        await events.PublishAsync(
            new UserChangedV1(user.Id, user.Username.Value, "PASSWORD_RESET", userContext.UserId, now), ct);

        return Result.Success(new ResetPasswordResult(user.Id, temporaryPassword));
    }
}
