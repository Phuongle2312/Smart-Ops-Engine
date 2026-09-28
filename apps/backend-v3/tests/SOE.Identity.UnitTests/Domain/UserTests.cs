using FluentAssertions;
using SOE.Identity.Domain;
using SOE.Identity.Domain.Events;

namespace SOE.Identity.UnitTests.Domain;

/// <summary>
/// Kiểm thử quy tắc nghiệp vụ của User (TC-IDN-API-004…006, BR-IDN-004…006).
/// </summary>
public sealed class UserTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 23, 8, 0, 0, TimeSpan.Zero);

    private static User CreateUser() => User.Create(
        Username.Create("operator01").Value,
        "hash",
        "Nguyễn Văn A",
        EmailAddress.Create("a@example.com").Value,
        UserRole.Operator,
        Now);

    [Fact]
    public void Create_DatTrangThaiBanDau_DungQuyDinh()
    {
        var user = CreateUser();

        user.IsActive.Should().BeTrue();
        user.MustChangePassword.Should().BeTrue("người dùng mới phải đổi mật khẩu lần đầu (FR-IDN-006)");
        user.FailedLoginCount.Should().Be(0);
        user.DomainEvents.Should().ContainSingle(e => e is UserCreatedDomainEvent);
    }

    [Fact]
    public void RegisterFailedLogin_Duoi5Lan_ChuaKhoaTaiKhoan()
    {
        var user = CreateUser();

        for (var i = 0; i < 4; i++)
        {
            user.RegisterFailedLogin(Now);
        }

        user.IsLocked(Now).Should().BeFalse();
        user.FailedLoginCount.Should().Be(4);
    }

    [Fact]
    public void RegisterFailedLogin_Du5Lan_KhoaTaiKhoan15Phut()
    {
        var user = CreateUser();

        for (var i = 0; i < 5; i++)
        {
            user.RegisterFailedLogin(Now);
        }

        user.IsLocked(Now).Should().BeTrue();
        user.LockedUntil.Should().Be(Now.AddMinutes(15));
        user.FailedLoginCount.Should().Be(0);
        user.DomainEvents.Should().Contain(e => e is UserLockedDomainEvent);
    }

    [Fact]
    public void IsLocked_SauKhiHetHan_TuMoKhoa()
    {
        var user = CreateUser();
        for (var i = 0; i < 5; i++)
        {
            user.RegisterFailedLogin(Now);
        }

        user.IsLocked(Now.AddMinutes(16)).Should().BeFalse();
    }

    [Fact]
    public void RegisterSuccessfulLogin_XoaBoDemVaMoKhoa()
    {
        var user = CreateUser();
        user.RegisterFailedLogin(Now);

        user.RegisterSuccessfulLogin(Now.AddMinutes(1));

        user.FailedLoginCount.Should().Be(0);
        user.LockedUntil.Should().BeNull();
        user.LastLoginAt.Should().Be(Now.AddMinutes(1));
    }

    [Fact]
    public void ChangePassword_CapNhatMocThoiGianVaBoCoDoiMatKhau()
    {
        var user = CreateUser();
        var changedAt = Now.AddHours(1);

        user.ChangePassword("hash-moi", changedAt);

        user.PasswordHash.Should().Be("hash-moi");
        user.PasswordChangedAt.Should().Be(changedAt, "token cũ hơn mốc này phải bị từ chối (BR-IDN-004)");
        user.MustChangePassword.Should().BeFalse();
    }

    [Fact]
    public void ResetPassword_BuocDoiMatKhauVaMoKhoa()
    {
        var user = CreateUser();
        for (var i = 0; i < 5; i++)
        {
            user.RegisterFailedLogin(Now);
        }

        user.ResetPassword("hash-tam", Now.AddMinutes(2), Guid.NewGuid());

        user.MustChangePassword.Should().BeTrue();
        user.IsLocked(Now.AddMinutes(2)).Should().BeFalse();
    }

    [Fact]
    public void SetActive_KhiVoHieuHoa_XoaTrangThaiKhoa()
    {
        var user = CreateUser();
        user.RegisterFailedLogin(Now);

        var result = user.SetActive(false, Now, Guid.NewGuid());

        result.IsSuccess.Should().BeTrue();
        user.IsActive.Should().BeFalse();
        user.FailedLoginCount.Should().Be(0);
    }

    [Fact]
    public void ChangeRole_DoiVaiTro_PhatSinhSuKien()
    {
        var user = CreateUser();

        var result = user.ChangeRole(UserRole.Admin, Now, Guid.NewGuid());

        result.IsSuccess.Should().BeTrue();
        user.Role.Should().Be(UserRole.Admin);
        user.DomainEvents.OfType<UserChangedDomainEvent>()
            .Should().Contain(e => e.ChangeKind == "ROLE_CHANGED");
    }

    [Fact]
    public void UpdateProfile_HoTenRong_TraVeLoiValidate()
    {
        var user = CreateUser();

        var result = user.UpdateProfile("  ", EmailAddress.Create("b@example.com").Value, Now, Guid.NewGuid());

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("SOE-IDN-400");
    }
}
