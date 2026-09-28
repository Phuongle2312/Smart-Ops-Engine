using FluentValidation;
using SOE.BuildingBlocks.Application.Abstractions;
using SOE.BuildingBlocks.Domain;
using SOE.Identity.Application.Abstractions;
using SOE.Identity.Domain;

namespace SOE.Identity.Application.Authentication;

/// <summary>UC-IDN-03 — Người dùng tự đổi mật khẩu (FR-IDN-008).</summary>
public sealed record ChangePasswordCommand(string CurrentPassword, string NewPassword) : ICommand;

public sealed class ChangePasswordCommandValidator : AbstractValidator<ChangePasswordCommand>
{
    public ChangePasswordCommandValidator()
    {
        RuleFor(x => x.CurrentPassword)
            .NotEmpty().WithMessage("Vui lòng nhập mật khẩu hiện tại.");

        RuleFor(x => x.NewPassword)
            .NotEmpty().WithMessage("Vui lòng nhập mật khẩu mới.")
            .MinimumLength(12).WithMessage("Mật khẩu tối thiểu 12 ký tự, gồm chữ và số.")
            .MaximumLength(256)
            .Must(p => p.Any(char.IsLetter) && p.Any(char.IsDigit))
            .WithMessage("Mật khẩu tối thiểu 12 ký tự, gồm chữ và số.");
    }
}

internal sealed class ChangePasswordCommandHandler(
    IUserRepository users,
    IRefreshTokenRepository refreshTokens,
    IPasswordHasher passwordHasher,
    IPasswordPolicy passwordPolicy,
    IUnitOfWork unitOfWork,
    IUserContext userContext,
    IClock clock)
    : ICommandHandler<ChangePasswordCommand>
{
    public async Task<Result> Handle(ChangePasswordCommand command, CancellationToken ct)
    {
        var user = await users.GetByIdAsync(userContext.UserId, ct);
        if (user is null)
        {
            return Result.Failure(IdentityErrors.UserNotFound);
        }

        if (!passwordHasher.Verify(command.CurrentPassword, user.PasswordHash))
        {
            return Result.Failure(IdentityErrors.InvalidCredentials);
        }

        if (passwordHasher.Verify(command.NewPassword, user.PasswordHash))
        {
            return Result.Failure(IdentityErrors.SamePassword);
        }

        if (passwordPolicy.IsWeak(command.NewPassword))
        {
            return Result.Failure(IdentityErrors.WeakPassword);
        }

        var now = clock.UtcNow;
        user.ChangePassword(passwordHasher.Hash(command.NewPassword), now);
        users.Update(user);

        // Đổi mật khẩu ⇒ thu hồi mọi phiên còn hiệu lực (FR-IDN-008).
        foreach (var token in await refreshTokens.GetActiveByUserAsync(user.Id, ct))
        {
            token.Revoke(now, "PASSWORD_CHANGED");
            refreshTokens.Update(token);
        }

        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }
}
