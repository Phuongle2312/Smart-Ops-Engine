using FluentValidation;
using SOE.BuildingBlocks.Application.Abstractions;
using SOE.BuildingBlocks.Domain;
using SOE.Contracts.Identity;
using SOE.Identity.Application.Abstractions;
using SOE.Identity.Domain;

namespace SOE.Identity.Application.Users;

/// <summary>Mật khẩu tạm chỉ trả về **một lần duy nhất** ngay sau khi tạo (UC-IDN-04 bước 6).</summary>
public sealed record CreateUserResult(UserDto User, string TemporaryPassword);

/// <summary>UC-IDN-04 — ADMIN tạo người dùng mới (FR-IDN-006).</summary>
public sealed record CreateUserCommand(string Username, string FullName, string Email, string Role)
    : ICommand<CreateUserResult>;

public sealed class CreateUserCommandValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserCommandValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("Vui lòng nhập tên đăng nhập.")
            .MaximumLength(Domain.Username.MaxLength);

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

internal sealed class CreateUserCommandHandler(
    IUserRepository users,
    IPasswordHasher passwordHasher,
    IPasswordPolicy passwordPolicy,
    IUnitOfWork unitOfWork,
    IEventPublisher events,
    IUserContext userContext,
    IClock clock)
    : ICommandHandler<CreateUserCommand, CreateUserResult>
{
    public async Task<Result<CreateUserResult>> Handle(CreateUserCommand command, CancellationToken ct)
    {
        var usernameResult = Domain.Username.Create(command.Username);
        if (usernameResult.IsFailure)
        {
            return Result.Failure<CreateUserResult>(usernameResult.Error);
        }

        var emailResult = EmailAddress.Create(command.Email);
        if (emailResult.IsFailure)
        {
            return Result.Failure<CreateUserResult>(emailResult.Error);
        }

        if (!UserRoleExtensions.TryParse(command.Role, out var role))
        {
            return Result.Failure<CreateUserResult>(
                Error.Validation("SOE-IDN-400", "Vai trò không hợp lệ."));
        }

        if (await users.UsernameExistsAsync(usernameResult.Value.Value, ct))
        {
            return Result.Failure<CreateUserResult>(IdentityErrors.UsernameTaken);
        }

        if (await users.EmailExistsAsync(emailResult.Value.Value, null, ct))
        {
            return Result.Failure<CreateUserResult>(IdentityErrors.EmailTaken);
        }

        var now = clock.UtcNow;
        var temporaryPassword = passwordPolicy.GenerateTemporaryPassword();

        var user = User.Create(
            usernameResult.Value,
            passwordHasher.Hash(temporaryPassword),
            command.FullName.Trim(),
            emailResult.Value,
            role,
            now,
            userContext.UserId);

        await users.AddAsync(user, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await events.PublishAsync(
            new UserChangedV1(user.Id, user.Username.Value, "CREATED", userContext.UserId, now), ct);

        return Result.Success(new CreateUserResult(UserDto.From(user), temporaryPassword));
    }
}
