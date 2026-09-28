using FluentValidation;
using SOE.BuildingBlocks.Application.Abstractions;
using SOE.BuildingBlocks.Domain;
using SOE.Contracts.Identity;
using SOE.Identity.Application.Abstractions;
using SOE.Identity.Application.Users;
using SOE.Identity.Domain;

namespace SOE.Identity.Application.Authentication;

/// <summary>UC-IDN-02 — Làm mới access token, xoay vòng refresh token (FR-IDN-002, 003).</summary>
public sealed record RefreshTokenCommand(string RefreshToken, string? IpAddress)
    : ICommand<AuthenticationResult>;

public sealed class RefreshTokenCommandValidator : AbstractValidator<RefreshTokenCommand>
{
    public RefreshTokenCommandValidator()
    {
        RuleFor(x => x.RefreshToken)
            .NotEmpty().WithMessage("Thiếu refresh token.")
            .MaximumLength(512);
    }
}

internal sealed class RefreshTokenCommandHandler(
    IUserRepository users,
    IRefreshTokenRepository refreshTokens,
    ITokenService tokenService,
    IUnitOfWork unitOfWork,
    IEventPublisher events,
    IClock clock)
    : ICommandHandler<RefreshTokenCommand, AuthenticationResult>
{
    public async Task<Result<AuthenticationResult>> Handle(RefreshTokenCommand command, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var hash = tokenService.HashRefreshToken(command.RefreshToken);
        var stored = await refreshTokens.GetByHashAsync(hash, ct);

        if (stored is null)
        {
            return Result.Failure<AuthenticationResult>(IdentityErrors.SessionExpired);
        }

        // Token đã dùng mà bị dùng lại ⇒ nghi bị đánh cắp: thu hồi toàn bộ chuỗi (FR-IDN-003).
        if (stored.UsedAt is not null)
        {
            await RevokeFamilyAsync(stored, now, ct);
            await events.PublishAsync(
                new TokenReuseDetectedV1(stored.UserId, stored.FamilyId, Hashing.HashOrNull(command.IpAddress), now),
                ct);
            return Result.Failure<AuthenticationResult>(IdentityErrors.TokenReuse);
        }

        var markUsed = stored.MarkUsed(now);
        if (markUsed.IsFailure)
        {
            return Result.Failure<AuthenticationResult>(markUsed.Error);
        }

        refreshTokens.Update(stored);

        var user = await users.GetByIdAsync(stored.UserId, ct);
        if (user is null || !user.IsActive)
        {
            await unitOfWork.SaveChangesAsync(ct);
            return Result.Failure<AuthenticationResult>(IdentityErrors.SessionExpired);
        }

        var sessionId = Guid.NewGuid();
        var accessToken = tokenService.CreateAccessToken(user, sessionId);
        var material = tokenService.CreateRefreshToken();

        // Token mới nằm cùng FamilyId và giữ nguyên hạn cuối của chuỗi (BR-IDN-005).
        var rotated = RefreshToken.Issue(
            user.Id, material.Hash, now, command.IpAddress, stored.FamilyId, stored.FamilyExpiresAt);

        await refreshTokens.AddAsync(rotated, ct);
        await unitOfWork.SaveChangesAsync(ct);

        return Result.Success(new AuthenticationResult(
            accessToken.Value,
            accessToken.ExpiresInSeconds,
            material.RawValue,
            user.MustChangePassword,
            UserDto.From(user)));
    }

    private async Task RevokeFamilyAsync(RefreshToken stored, DateTimeOffset now, CancellationToken ct)
    {
        foreach (var token in await refreshTokens.GetByFamilyAsync(stored.FamilyId, ct))
        {
            token.Revoke(now, "TOKEN_REUSE_DETECTED");
            refreshTokens.Update(token);
        }

        await unitOfWork.SaveChangesAsync(ct);
    }
}
