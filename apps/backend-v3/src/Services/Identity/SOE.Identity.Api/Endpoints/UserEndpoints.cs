using MediatR;
using SOE.BuildingBlocks.Web;
using SOE.BuildingBlocks.Web.Authentication;
using SOE.Identity.Application.Users;

namespace SOE.Identity.Api.Endpoints;

public sealed record CreateUserRequest(string Username, string FullName, string Email, string Role);

public sealed record UpdateUserRequest(string FullName, string Email, string Role);

public sealed record SetUserStatusRequest(bool IsActive);

/// <summary>Endpoint quản lý người dùng — toàn bộ yêu cầu vai trò ADMIN (FR-IDN-006, 007, 013…015).</summary>
public static class UserEndpoints
{
    public static IEndpointRouteBuilder MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/me", async (ISender sender, HttpContext http, CancellationToken ct) =>
        {
            var result = await sender.Send(new GetCurrentUserQuery(), ct);
            return result.IsFailure ? ApiResults.Problem(result, http) : Results.Ok(result.Value);
        })
        .RequireAuthorization(SoePolicies.ViewerOrAbove)
        .WithTags("Users")
        .WithSummary("Thông tin người đang đăng nhập");

        var group = app.MapGroup("/api/v1/users")
            .RequireAuthorization(SoePolicies.AdminOnly)
            .WithTags("Users");

        group.MapGet("/", async (
            string? search,
            string? role,
            bool? isActive,
            int? page,
            int? pageSize,
            ISender sender,
            HttpContext http,
            CancellationToken ct) =>
        {
            var query = new GetUsersQuery(search, role, isActive, page ?? 1, pageSize ?? 20);
            var result = await sender.Send(query, ct);
            return result.IsFailure ? ApiResults.Problem(result, http) : Results.Ok(result.Value);
        })
        .WithSummary("Danh sách người dùng");

        group.MapGet("/{id:guid}", async (Guid id, ISender sender, HttpContext http, CancellationToken ct) =>
        {
            var result = await sender.Send(new GetUserByIdQuery(id), ct);
            return result.IsFailure ? ApiResults.Problem(result, http) : Results.Ok(result.Value);
        })
        .WithSummary("Chi tiết người dùng");

        group.MapPost("/", async (
            CreateUserRequest request,
            ISender sender,
            HttpContext http,
            CancellationToken ct) =>
        {
            var command = new CreateUserCommand(request.Username, request.FullName, request.Email, request.Role);
            var result = await sender.Send(command, ct);

            return result.IsFailure
                ? ApiResults.Problem(result, http)
                : Results.Created($"/api/v1/users/{result.Value.User.Id}", result.Value);
        })
        .WithSummary("Tạo người dùng mới");

        group.MapPut("/{id:guid}", async (
            Guid id,
            UpdateUserRequest request,
            ISender sender,
            HttpContext http,
            CancellationToken ct) =>
        {
            var command = new UpdateUserCommand(id, request.FullName, request.Email, request.Role);
            var result = await sender.Send(command, ct);
            return result.IsFailure ? ApiResults.Problem(result, http) : Results.Ok(result.Value);
        })
        .WithSummary("Cập nhật người dùng");

        group.MapPut("/{id:guid}/status", async (
            Guid id,
            SetUserStatusRequest request,
            ISender sender,
            HttpContext http,
            CancellationToken ct) =>
        {
            var result = await sender.Send(new SetUserStatusCommand(id, request.IsActive), ct);
            return result.IsFailure ? ApiResults.Problem(result, http) : Results.Ok(result.Value);
        })
        .WithSummary("Bật/tắt tài khoản");

        group.MapPost("/{id:guid}/reset-password", async (
            Guid id,
            ISender sender,
            HttpContext http,
            CancellationToken ct) =>
        {
            var result = await sender.Send(new ResetPasswordCommand(id), ct);
            return result.IsFailure ? ApiResults.Problem(result, http) : Results.Ok(result.Value);
        })
        .WithSummary("Đặt lại mật khẩu (trả mật khẩu tạm một lần)");

        group.MapPost("/{id:guid}/revoke-sessions", async (
            Guid id,
            ISender sender,
            HttpContext http,
            CancellationToken ct) =>
        {
            var result = await sender.Send(new RevokeSessionsCommand(id), ct);
            return result.IsFailure ? ApiResults.Problem(result, http) : Results.NoContent();
        })
        .WithSummary("Thu hồi mọi phiên đăng nhập của người dùng");

        return app;
    }
}
