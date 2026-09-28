using FluentValidation;
using SOE.BuildingBlocks.Application.Abstractions;
using SOE.BuildingBlocks.Domain;
using SOE.Contracts.Identity;
using SOE.Identity.Application.Abstractions;
using SOE.Identity.Domain;

namespace SOE.Identity.Application.Users;

/// <summary>UC-IDN-04/A1 — ADMIN sửa họ tên, email, vai trò (FR-IDN-007).</summary>
public sealed record UpdateUserCommand(Guid UserId, string FullName, string Email, string Role)
    : ICommand<UserDto>;

public sealed class UpdateUserCommandValidator : AbstractValidator<UpdateUserCommand>
{
    public UpdateUserCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();

        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Vui lòng nhập họ tên.")
            .MaximumLength(128);

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Vui lòng nhập email.")
            .MaximumLength(EmailAddress.MaxLength);

        RuleFor(x => x.Role)
            .Must(r => UserRoleExtensions.TryParse(r, out _))
            .WithMessage("Vai trò không hợp lệ.");
    }
}

internal sealed class UpdateUserCommandHandler(
    IUserRepository users,
    IUnitOfWork unitOfWork,
    IEventPublisher events,
    IUserContext userContext,
    IClock clock)
    : ICommandHandler<UpdateUserCommand, UserDto>
{
    public async Task<Result<UserDto>> Handle(UpdateUserCommand command, CancellationToken ct)
    {
        var user = await users.GetByIdAsync(command.UserId, ct);
        if (user is null)
        {
            return Result.Failure<UserDto>(IdentityErrors.UserNotFound);
        }

        var emailResult = EmailAddress.Create(command.Email);
        if (emailResult.IsFailure)
        {
            return Result.Failure<UserDto>(emailResult.Error);
        }

        if (await users.EmailExistsAsync(emailResult.Value.Value, user.Id, ct))
        {
            return Result.Failure<UserDto>(IdentityErrors.EmailTaken);
        }

        if (!UserRoleExtensions.TryParse(command.Role, out var role))
        {
            return Result.Failure<UserDto>(Error.Validation("SOE-IDN-400", "Vai trò không hợp lệ."));
        }

        var now = clock.UtcNow;

        // Không được hạ quyền ADMIN cuối cùng còn hoạt động (FR-IDN-015).
        if (user.Role == UserRole.Admin && role != UserRole.Admin && user.IsActive &&
            await users.CountActiveAdminsAsync(ct) <= 1)
        {
            return Result.Failure<UserDto>(IdentityErrors.LastAdmin);
        }

        var profileResult = user.UpdateProfile(command.FullName, emailResult.Value, now, userContext.UserId);
        if (profileResult.IsFailure)
        {
            return Result.Failure<UserDto>(profileResult.Error);
        }

        var roleChanged = user.Role != role;
        var roleResult = user.ChangeRole(role, now, userContext.UserId);
        if (roleResult.IsFailure)
        {
            return Result.Failure<UserDto>(roleResult.Error);
        }

        users.Update(user);
        await unitOfWork.SaveChangesAsync(ct);

        await events.PublishAsync(
            new UserChangedV1(user.Id, user.Username.Value, roleChanged ? "ROLE_CHANGED" : "UPDATED",
                userContext.UserId, now), ct);

        return Result.Success(UserDto.From(user));
    }
}
