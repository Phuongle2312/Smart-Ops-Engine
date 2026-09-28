using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SOE.BuildingBlocks.Application.Abstractions;
using SOE.BuildingBlocks.Infrastructure;
using SOE.Identity.Application.Abstractions;
using SOE.Identity.Infrastructure.Persistence;
using SOE.Identity.Infrastructure.Security;

namespace SOE.Identity.Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// Đăng ký hạ tầng của Identity. Mọi port khai báo ở Application được nối với hiện thực tại đây (DIP).
    /// </summary>
    public static IServiceCollection AddIdentityInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<IdentityDbContext>(options =>
            options.UseSqlServer(
                configuration.GetConnectionString("Default"),
                sql => sql.EnableRetryOnFailure(3, TimeSpan.FromSeconds(5), null)));

        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<IdentityDbContext>());
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IdentityDbSeeder>();

        services.AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddSingleton<RsaKeyProvider>();
        services.AddSingleton<IPasswordHasher, Argon2PasswordHasher>();
        services.AddSingleton<IPasswordPolicy, PasswordPolicy>();
        services.AddSingleton<IClock, SystemClock>();
        services.AddScoped<ITokenService, JwtTokenService>();

        // M1: publisher chỉ ghi log; M2 thay bằng MassTransit + outbox (không đổi Application layer).
        services.AddScoped<IEventPublisher, LoggingEventPublisher>();

        return services;
    }
}
