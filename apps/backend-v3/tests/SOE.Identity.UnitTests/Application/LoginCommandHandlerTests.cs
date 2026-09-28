using FluentAssertions;
using NSubstitute;
using SOE.BuildingBlocks.Application.Abstractions;
using SOE.BuildingBlocks.Domain;
using SOE.Contracts.Identity;
using SOE.Identity.Application.Abstractions;
using SOE.Identity.Application.Authentication;
using SOE.Identity.Domain;

namespace SOE.Identity.UnitTests.Application;

/// <summary>
/// Kiểm thử luồng đăng nhập ở tầng Application — chạy hoàn toàn trong bộ nhớ, không cần DB
/// (TC-IDN-API-001…007, BR-IDN-001, 002).
/// </summary>
public sealed class LoginCommandHandlerTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 23, 8, 0, 0, TimeSpan.Zero);

    private readonly IUserRepository _users = Substitute.For<IUserRepository>();
    private readonly IRefreshTokenRepository _refreshTokens = Substitute.For<IRefreshTokenRepository>();
    private readonly IPasswordHasher _passwordHasher = Substitute.For<IPasswordHasher>();
    private readonly ITokenService _tokenService = Substitute.For<ITokenService>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly IEventPublisher _events = Substitute.For<IEventPublisher>();
    private readonly IClock _clock = Substitute.For<IClock>();

    public LoginCommandHandlerTests()
    {
        _clock.UtcNow.Returns(Now);
        _tokenService.CreateAccessToken(Arg.Any<User>(), Arg.Any<Guid>())
            .Returns(new AccessToken("access-token", 900));
        _tokenService.CreateRefreshToken()
            .Returns(new RefreshTokenMaterial("refresh-token", new byte[32]));
        _refreshTokens.GetActiveByUserAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Array.Empty<RefreshToken>());
    }

    private static LoginCommand Command(string username = "operator01", string password = "MatKhauDung2026") =>
        new(username, password, "10.0.0.1");

    private static User ActiveUser() => User.Create(
        Username.Create("operator01").Value,
        "hash",
        "Nguyễn Văn A",
        EmailAddress.Create("a@example.com").Value,
        UserRole.Operator,
        Now);

    private Task<Result<AuthenticationResult>> HandleAsync(LoginCommand command)
    {
        var handler = new LoginCommandHandler(
            _users, _refreshTokens, _passwordHasher, _tokenService, _unitOfWork, _events, _clock);

        return handler.Handle(command, CancellationToken.None);
    }

    [Fact]
    public async Task DangNhap_ThanhCong_TraVeTokenVaLuuRefreshToken()
    {
        var user = ActiveUser();
        _users.GetByUsernameAsync("operator01", Arg.Any<CancellationToken>()).Returns(user);
        _passwordHasher.Verify(Arg.Any<string>(), Arg.Any<string>()).Returns(true);

        var result = await HandleAsync(Command());

        result.IsSuccess.Should().BeTrue();
        result.Value.AccessToken.Should().Be("access-token");
        result.Value.RefreshToken.Should().Be("refresh-token");
        result.Value.User.Role.Should().Be("OPERATOR");

        await _refreshTokens.Received(1).AddAsync(Arg.Any<RefreshToken>(), Arg.Any<CancellationToken>());
        await _events.Received(1).PublishAsync(Arg.Any<UserLoggedInV1>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DangNhap_TaiKhoanKhongTonTai_TraVeLoiChungVaBamGia()
    {
        _users.GetByUsernameAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((User?)null);

        var result = await HandleAsync(Command("khongtontai"));

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("SOE-IDN-401");
        result.Error.Message.Should().Be("Tên đăng nhập hoặc mật khẩu không đúng.");
        _passwordHasher.Received(1).PerformDummyVerify();
        await _events.Received(1).PublishAsync(Arg.Any<UserLoginFailedV1>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DangNhap_SaiMatKhau_TangBoDemVaTraLoiChung()
    {
        var user = ActiveUser();
        _users.GetByUsernameAsync("operator01", Arg.Any<CancellationToken>()).Returns(user);
        _passwordHasher.Verify(Arg.Any<string>(), Arg.Any<string>()).Returns(false);

        var result = await HandleAsync(Command());

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("SOE-IDN-401");
        user.FailedLoginCount.Should().Be(1);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DangNhap_SaiMatKhauLanThu5_KhoaTaiKhoan()
    {
        var user = ActiveUser();
        for (var i = 0; i < 4; i++)
        {
            user.RegisterFailedLogin(Now);
        }

        _users.GetByUsernameAsync("operator01", Arg.Any<CancellationToken>()).Returns(user);
        _passwordHasher.Verify(Arg.Any<string>(), Arg.Any<string>()).Returns(false);

        var result = await HandleAsync(Command());

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("SOE-IDN-423");
        user.IsLocked(Now).Should().BeTrue();
        await _events.Received(1).PublishAsync(Arg.Any<UserLockedV1>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DangNhap_TaiKhoanDangKhoa_TraVe423KhongKiemTraMatKhau()
    {
        var user = ActiveUser();
        for (var i = 0; i < 5; i++)
        {
            user.RegisterFailedLogin(Now);
        }

        _users.GetByUsernameAsync("operator01", Arg.Any<CancellationToken>()).Returns(user);

        var result = await HandleAsync(Command());

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("SOE-IDN-423");
        _passwordHasher.DidNotReceive().Verify(Arg.Any<string>(), Arg.Any<string>());
    }

    [Fact]
    public async Task DangNhap_TaiKhoanBiVoHieuHoa_TraVe403()
    {
        var user = ActiveUser();
        user.SetActive(false, Now, Guid.NewGuid());

        _users.GetByUsernameAsync("operator01", Arg.Any<CancellationToken>()).Returns(user);
        _passwordHasher.Verify(Arg.Any<string>(), Arg.Any<string>()).Returns(true);

        var result = await HandleAsync(Command());

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("SOE-IDN-403");
    }
}
