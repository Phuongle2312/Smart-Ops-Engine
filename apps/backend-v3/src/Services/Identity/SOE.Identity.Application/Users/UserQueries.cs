using FluentValidation;
using SOE.BuildingBlocks.Application.Abstractions;
using SOE.BuildingBlocks.Domain;
using SOE.Identity.Application.Abstractions;
using SOE.Identity.Domain;

namespace SOE.Identity.Application.Users;

/// <summary>FR-IDN-009 — Thông tin người đang đăng nhập.</summary>
public sealed record GetCurrentUserQuery : IQuery<CurrentUserDto>;

internal sealed class GetCurrentUserQueryHandler(IUserRepository users, IUserContext userContext)
    : IQueryHandler<GetCurrentUserQuery, CurrentUserDto>
{
    public async Task<Result<CurrentUserDto>> Handle(GetCurrentUserQuery query, CancellationToken ct)
    {
        var user = await users.GetByIdAsync(userContext.UserId, ct);
        if (user is null)
        {
            return Result.Failure<CurrentUserDto>(IdentityErrors.UserNotFound);
        }

        return Result.Success(new CurrentUserDto(
            user.Id,
            user.Username.Value,
            user.FullName,
            user.Email.Value,
            user.Role.ToClaimValue(),
            RolePermissions.For(user.Role),
            user.MustChangePassword,
            user.LastLoginAt));
    }
}

/// <summary>FR-IDN-013 — Danh sách người dùng có lọc và phân trang.</summary>
public sealed record GetUsersQuery(string? Search, string? Role, bool? IsActive, int Page, int PageSize)
    : IQuery<PagedResult<UserDto>>;

public sealed class GetUsersQueryValidator : AbstractValidator<GetUsersQuery>
{
    public GetUsersQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1).WithMessage("Trang phải lớn hơn 0.");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, PagedResult<UserDto>.MaxPageSize)
            .WithMessage($"Số dòng mỗi trang từ 1 đến {PagedResult<UserDto>.MaxPageSize}.");

        RuleFor(x => x.Search).MaximumLength(128);

        RuleFor(x => x.Role)
            .Must(r => r is null || UserRoleExtensions.TryParse(r, out _))
            .WithMessage("Vai trò không hợp lệ.");
    }
}

internal sealed class GetUsersQueryHandler(IUserRepository users)
    : IQueryHandler<GetUsersQuery, PagedResult<UserDto>>
{
    public async Task<Result<PagedResult<UserDto>>> Handle(GetUsersQuery query, CancellationToken ct)
    {
        UserRole? role = null;
        if (query.Role is not null && UserRoleExtensions.TryParse(query.Role, out var parsed))
        {
            role = parsed;
        }

        var (items, total) = await users.ListAsync(
            query.Search, role, query.IsActive, query.Page, query.PageSize, ct);

        return Result.Success(new PagedResult<UserDto>(
            items.Select(UserDto.From).ToList(), query.Page, query.PageSize, total));
    }
}

/// <summary>Chi tiết một người dùng (ADMIN).</summary>
public sealed record GetUserByIdQuery(Guid UserId) : IQuery<UserDto>;

internal sealed class GetUserByIdQueryHandler(IUserRepository users)
    : IQueryHandler<GetUserByIdQuery, UserDto>
{
    public async Task<Result<UserDto>> Handle(GetUserByIdQuery query, CancellationToken ct)
    {
        var user = await users.GetByIdAsync(query.UserId, ct);
        return user is null
            ? Result.Failure<UserDto>(IdentityErrors.UserNotFound)
            : Result.Success(UserDto.From(user));
    }
}
