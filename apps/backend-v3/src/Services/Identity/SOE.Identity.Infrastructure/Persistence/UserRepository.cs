using Microsoft.EntityFrameworkCore;
using SOE.Identity.Application.Abstractions;
using SOE.Identity.Domain;

namespace SOE.Identity.Infrastructure.Persistence;

internal sealed class UserRepository(IdentityDbContext context) : IUserRepository
{
    // Username/Email là value object có ValueConverter: so sánh cả đối tượng để EF dịch được sang SQL,
    // và dùng EF.Property<string>(...) khi cần LIKE/ORDER BY trên cột đã chuyển đổi.
    public Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        context.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<User?> GetByUsernameAsync(string username, CancellationToken ct = default)
    {
        var result = Username.Create(username);
        if (result.IsFailure)
        {
            return Task.FromResult<User?>(null);
        }

        var value = result.Value;
        return context.Users.FirstOrDefaultAsync(u => u.Username == value, ct);
    }

    public Task<bool> UsernameExistsAsync(string username, CancellationToken ct = default)
    {
        var result = Username.Create(username);
        if (result.IsFailure)
        {
            return Task.FromResult(false);
        }

        var value = result.Value;
        return context.Users.AnyAsync(u => u.Username == value, ct);
    }

    public Task<bool> EmailExistsAsync(string email, Guid? excludeUserId = null, CancellationToken ct = default)
    {
        var result = EmailAddress.Create(email);
        if (result.IsFailure)
        {
            return Task.FromResult(false);
        }

        var value = result.Value;
        return context.Users.AnyAsync(
            u => u.Email == value && (excludeUserId == null || u.Id != excludeUserId), ct);
    }

    public Task<int> CountActiveAdminsAsync(CancellationToken ct = default) =>
        context.Users.CountAsync(u => u.IsActive && u.Role == UserRole.Admin, ct);

    public async Task<(IReadOnlyList<User> Items, int TotalItems)> ListAsync(
        string? search,
        UserRole? role,
        bool? isActive,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var query = context.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            query = query.Where(u =>
                EF.Functions.Like(EF.Property<string>(u, "Username"), term) ||
                EF.Functions.Like(u.FullName, term) ||
                EF.Functions.Like(EF.Property<string>(u, "Email"), term));
        }

        if (role is not null)
        {
            query = query.Where(u => u.Role == role);
        }

        if (isActive is not null)
        {
            query = query.Where(u => u.IsActive == isActive);
        }

        var total = await query.CountAsync(ct);

        var items = await query
            .OrderBy(u => EF.Property<string>(u, "Username"))
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task AddAsync(User user, CancellationToken ct = default) =>
        await context.Users.AddAsync(user, ct);

    public void Update(User user) => context.Users.Update(user);
}
