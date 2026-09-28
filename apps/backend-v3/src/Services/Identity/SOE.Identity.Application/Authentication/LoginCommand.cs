using FluentValidation;
using SOE.BuildingBlocks.Application.Abstractions;
using SOE.BuildingBlocks.Domain;
using SOE.Contracts.Identity;
using SOE.Identity.Application.Abstractions;
using SOE.Identity.Application.Users;
using SOE.Identity.Domain;

namespace SOE.Identity.Application.Authentication;

/// <summary>Kết quả xác thực. RefreshToken thô chỉ dùng để đặt cookie HttpOnly, không trả trong body.</summary>
public sealed record AuthenticationResult(
    string AccessToken,
    int ExpiresInSeconds,
    string RefreshToken,
    bool MustChangePassword,
    UserDto User);

/// <summary>UC-IDN-01 — Đăng nhập (FR-IDN-001).</summary>
public sealed record LoginCommand(string Username, string Password, string? IpAddress)
    : ICommand<AuthenticationResult>;

public sealed class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("Vui lòng nhập tên đăng nhập.")
            .MaximumLength(Username.MaxLength);

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Vui lòng nhập mật khẩu.")
            .MaximumLength(256);
    }
}

internal sealed class LoginCommandHandler(
    IUserRepository users,
    IRefreshTokenRepository refreshTokens,
    IPasswordHasher passwordHasher,
    ITokenService tokenService,
    IUnitOfWork unitOfWork,
    IEventPublisher events,
    IClock clock)
    : ICommandHandler<LoginCommand, AuthenticationResult>
{
    public async Task<Result<AuthenticationResult>> Handle(LoginCommand command, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var normalized = command.Username.Trim().ToLowerInvariant();
        var user = await users.GetByUsernameAsync(normalized, ct);

        if (user is null)
        {
            // Giữ thời gian phản hồi hằng định để không lộ tài khoản có tồn tại hay không (BR-IDN-002).
            passwordHasher.PerformDummyVerify();
            await PublishFailureAsync(normalized, "USER_NOT_FOUND", command.IpAddress, now, ct);
            return Result.Failure<AuthenticationResult>(IdentityErrors.InvalidCredentials);
        }

        if (user.IsLocked(now))
        {
            await PublishFailureAsync(normalized, "LOCKED", command.IpAddress, now, ct);
            return Result.Failure<AuthenticationResult>(IdentityErrors.AccountLocked(user.LockMinutesRemaining(now)));
        }

        if (!passwordHasher.Verify(command.Password, user.PasswordHash))
        {
            user.RegisterFailedLogin(now);
            users.Update(user);
            await unitOfWork.SaveChangesAsync(ct);

            await PublishFailureAsync(normalized, "BAD_PASSWORD", command.IpAddress, now, ct);

            if (user.IsLocked(now))
            {
                await events.PublishAsync(
                    new UserLockedV1(user.Id, user.Username.Value, user.LockedUntil!.Value, now), ct);
                return Result.Failure<AuthenticationResult>(
                    IdentityErrors.AccountLocked(user.LockMinutesRemaining(now)));
            }

            return Result.Failure<AuthenticationResult>(IdentityErrors.InvalidCredentials);
        }

        // Kiểm tra trạng thái sau khi mật khẩu đúng (BR-IDN-001: không lộ trạng thái cho người lạ).
        if (!user.IsActive)
        {
            await PublishFailureAsync(normalized, "DISABLED", command.IpAddress, now, ct);
            return Result.Failure<AuthenticationResult>(IdentityErrors.AccountDisabled);
        }

        user.RegisterSuccessfulLogin(now);
        users.Update(user);

        await EnforceSessionLimitAsync(user.Id, now, ct);

        var sessionId = Guid.NewGuid();
        var accessToken = tokenService.CreateAccessToken(user, sessionId);
        var refreshMaterial = tokenService.CreateRefreshToken();
        var refreshToken = RefreshToken.Issue(user.Id, refreshMaterial.Hash, now, command.IpAddress);

        await refreshTokens.AddAsync(refreshToken, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await events.PublishAsync(
            new UserLoggedInV1(user.Id, user.Username.Value, user.Role.ToClaimValue(),
                Hashing.HashOrNull(command.IpAddress), null, now), ct);

        return Result.Success(new AuthenticationResult(
            accessToken.Value,
            accessToken.ExpiresInSeconds,
            refreshMaterial.RawValue,
            user.MustChangePassword,
            UserDto.From(user)));
    }

    /// <summary>Tối đa 5 phiên còn hiệu lực; vượt quá thì thu hồi phiên cũ nhất (BR-IDN-008).</summary>
    private async Task EnforceSessionLimitAsync(Guid userId, DateTimeOffset now, CancellationToken ct)
    {
        var active = await refreshTokens.GetActiveByUserAsync(userId, ct);
        var excess = active.Count - (RefreshToken.MaxActiveSessionsPerUser - 1);

        foreach (var token in active.OrderBy(t => t.CreatedAt).Take(Math.Max(0, excess)))
        {
            token.Revoke(now, "SESSION_LIMIT");
            refreshTokens.Update(token);
        }
    }

    private Task PublishFailureAsync(
        string username, string reason, string? ip, DateTimeOffset now, CancellationToken ct) =>
        events.PublishAsync(new UserLoginFailedV1(username, reason, Hashing.HashOrNull(ip), now), ct);
}
