using FluentAssertions;
using SOE.Identity.Domain;

namespace SOE.Identity.UnitTests.Domain;

/// <summary>Kiểm thử quy tắc validate của value object (TC-IDN-API-028, SRS 01 §6).</summary>
public sealed class ValueObjectTests
{
    [Theory]
    [InlineData("admin")]
    [InlineData("operator_01")]
    [InlineData("nguyen.van-a")]
    public void Username_HopLe_TaoThanhCong(string input) =>
        Username.Create(input).IsSuccess.Should().BeTrue();

    [Theory]
    [InlineData("")]
    [InlineData("ab")]
    [InlineData("Admin User!")]
    [InlineData("tên_việt")]
    public void Username_KhongHopLe_TraVeLoi(string input)
    {
        var result = Username.Create(input);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("SOE-IDN-400");
    }

    [Fact]
    public void Username_TuDongChuyenChuThuong()
    {
        var result = Username.Create("  ADMIN  ");

        result.IsSuccess.Should().BeTrue();
        result.Value.Value.Should().Be("admin");
    }

    [Theory]
    [InlineData("a@example.com")]
    [InlineData("ops.team@sub.domain.vn")]
    public void Email_HopLe_TaoThanhCong(string input) =>
        EmailAddress.Create(input).IsSuccess.Should().BeTrue();

    [Theory]
    [InlineData("")]
    [InlineData("abc@")]
    [InlineData("abc@domain")]
    [InlineData("no-at-sign.com")]
    public void Email_KhongHopLe_TraVeLoi(string input) =>
        EmailAddress.Create(input).IsFailure.Should().BeTrue();

    [Theory]
    [InlineData("ADMIN", UserRole.Admin)]
    [InlineData("operator", UserRole.Operator)]
    [InlineData("Viewer", UserRole.Viewer)]
    public void UserRole_ParseKhongPhanBietHoaThuong(string input, UserRole expected)
    {
        UserRoleExtensions.TryParse(input, out var role).Should().BeTrue();
        role.Should().Be(expected);
    }

    [Fact]
    public void UserRole_GiaTriLa_TraVeFalse() =>
        UserRoleExtensions.TryParse("SUPERUSER", out _).Should().BeFalse();
}
