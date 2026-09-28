using SOE.BuildingBlocks.Application.Abstractions;
using SOE.BuildingBlocks.Domain;
using SOE.Identity.Application.Abstractions;

namespace SOE.Identity.Application.Authentication;

/// <summary>UC-IDN-02/A1 — Đăng xuất: thu hồi refresh token hiện tại (FR-IDN-004).</summary>
public sealed record LogoutCommand(string? RefreshToken) : ICommand;

internal sealed class LogoutCommandHandler(
    IRefreshTokenRepository refreshTokens,
    ITokenService tokenService,
    IUnitOfWork unitOfWork,
    IClock clock)
    : ICommandHandler<LogoutCommand>
{
    public async Task<Result> Handle(LogoutCommand command, CancellationToken ct)
    {
        // Đăng xuất luôn thành công kể cả khi không có cookie — tránh lộ thông tin phiên.
        if (string.IsNullOrWhiteSpace(command.RefreshToken))
        {
            return Result.Success();
        }

        var hash = tokenService.HashRefreshToken(command.RefreshToken);
        var stored = await refreshTokens.GetByHashAsync(hash, ct);

        if (stored is not null)
        {
            stored.Revoke(clock.UtcNow, "LOGOUT");
            refreshTokens.Update(stored);
            await unitOfWork.SaveChangesAsync(ct);
        }

        return Result.Success();
    }
}
