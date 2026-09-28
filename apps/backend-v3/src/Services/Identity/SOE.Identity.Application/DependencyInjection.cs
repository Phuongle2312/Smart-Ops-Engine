using System.Reflection;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using SOE.BuildingBlocks.Application.Behaviors;

namespace SOE.Identity.Application;

public static class DependencyInjection
{
    /// <summary>Đăng ký MediatR, pipeline behavior và toàn bộ validator của Identity.</summary>
    public static IServiceCollection AddIdentityApplication(this IServiceCollection services)
    {
        var assembly = Assembly.GetExecutingAssembly();

        services.AddMediatR(config =>
        {
            config.RegisterServicesFromAssembly(assembly);
            config.AddOpenBehavior(typeof(LoggingBehavior<,>));
            config.AddOpenBehavior(typeof(ValidationBehavior<,>));
        });

        services.AddValidatorsFromAssembly(assembly, includeInternalTypes: true);

        return services;
    }
}
