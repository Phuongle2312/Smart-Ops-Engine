using System.Reflection;
using FluentAssertions;
using NetArchTest.Rules;

namespace SOE.ArchitectureTests;

/// <summary>
/// Ràng buộc Clean Architecture (docs/01_architecture/solid_clean_architecture.md §2, NFR-MNT-002).
/// Các test này giữ cho chiều phụ thuộc luôn hướng vào trong.
/// </summary>
public sealed class LayerDependencyTests
{
    private static readonly Assembly DomainAssembly = typeof(SOE.Identity.Domain.User).Assembly;

    private static readonly Assembly ApplicationAssembly =
        typeof(SOE.Identity.Application.DependencyInjection).Assembly;

    private static readonly Assembly InfrastructureAssembly =
        typeof(SOE.Identity.Infrastructure.DependencyInjection).Assembly;

    private static readonly Assembly BuildingBlocksDomainAssembly =
        typeof(SOE.BuildingBlocks.Domain.Result).Assembly;

    [Fact]
    public void Domain_KhongPhuThuocApplication_Infrastructure_Hay_Api()
    {
        var result = Types.InAssembly(DomainAssembly)
            .ShouldNot()
            .HaveDependencyOnAny(
                "SOE.Identity.Application",
                "SOE.Identity.Infrastructure",
                "SOE.Identity.Api")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            "Domain phải độc lập: {0}", Describe(result));
    }

    [Fact]
    public void Domain_KhongPhuThuocHaTang()
    {
        var result = Types.InAssembly(DomainAssembly)
            .ShouldNot()
            .HaveDependencyOnAny(
                "Microsoft.EntityFrameworkCore",
                "Microsoft.AspNetCore",
                "MediatR",
                "FluentValidation",
                "System.Net.Http")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            "Domain không được biết đến EF Core/HTTP/MediatR: {0}", Describe(result));
    }

    [Fact]
    public void BuildingBlocksDomain_KhongPhuThuocHaTang()
    {
        var result = Types.InAssembly(BuildingBlocksDomainAssembly)
            .ShouldNot()
            .HaveDependencyOnAny("Microsoft.EntityFrameworkCore", "Microsoft.AspNetCore", "MediatR")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(Describe(result));
    }

    [Fact]
    public void Application_KhongPhuThuocInfrastructure_Hay_Api()
    {
        var result = Types.InAssembly(ApplicationAssembly)
            .ShouldNot()
            .HaveDependencyOnAny("SOE.Identity.Infrastructure", "SOE.Identity.Api")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            "Application chỉ được biết port, không biết hiện thực: {0}", Describe(result));
    }

    [Fact]
    public void Application_KhongDungTrucTiepEfCore()
    {
        var result = Types.InAssembly(ApplicationAssembly)
            .ShouldNot()
            .HaveDependencyOn("Microsoft.EntityFrameworkCore")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            "Truy cập dữ liệu phải qua repository (DIP): {0}", Describe(result));
    }

    [Fact]
    public void Infrastructure_KhongPhuThuocApi()
    {
        var result = Types.InAssembly(InfrastructureAssembly)
            .ShouldNot()
            .HaveDependencyOn("SOE.Identity.Api")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(Describe(result));
    }

    [Fact]
    public void CommandHandler_PhaiLaInternalVaSealed()
    {
        var result = Types.InAssembly(ApplicationAssembly)
            .That()
            .HaveNameEndingWith("CommandHandler")
            .Or()
            .HaveNameEndingWith("QueryHandler")
            .Should()
            .BeSealed()
            .And()
            .NotBePublic()
            .GetResult();

        result.IsSuccessful.Should().BeTrue(
            "Handler là chi tiết triển khai, không phải API công khai: {0}", Describe(result));
    }

    [Fact]
    public void Repository_PhaiNamOInfrastructureVaSealed()
    {
        var result = Types.InAssembly(InfrastructureAssembly)
            .That()
            .HaveNameEndingWith("Repository")
            .Should()
            .BeSealed()
            .GetResult();

        result.IsSuccessful.Should().BeTrue(Describe(result));
    }

    private static string Describe(TestResult result) =>
        result.FailingTypeNames is null || result.FailingTypeNames.Count == 0
            ? "không có chi tiết"
            : string.Join(", ", result.FailingTypeNames);
}
