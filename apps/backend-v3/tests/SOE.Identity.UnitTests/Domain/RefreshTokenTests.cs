using FluentAssertions;
using SOE.Identity.Domain;

namespace SOE.Identity.UnitTests.Domain;

/// <summary>Kiểm thử vòng đời refresh token (TC-IDN-API-011…013, FR-IDN-002, 003).</summary>
public sealed class RefreshTokenTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 23, 8, 0, 0, TimeSpan.Zero);
    private static readonly byte[] Hash = new byte[32];

    [Fact]
    public void Issue_TokenMoi_ConHieuLuc()
    {
        var token = RefreshToken.Issue(Guid.NewGuid(), Hash, Now, "10.0.0.1");

        token.IsActive(Now).Should().BeTrue();
        token.ExpiresAt.Should().Be(Now.AddDays(7));
        token.FamilyExpiresAt.Should().Be(Now.AddDays(30));
    }

    [Fact]
    public void MarkUsed_LanDau_ThanhCong()
    {
        var token = RefreshToken.Issue(Guid.NewGuid(), Hash, Now, null);

        var result = token.MarkUsed(Now.AddMinutes(5));

        result.IsSuccess.Should().BeTrue();
        token.UsedAt.Should().Be(Now.AddMinutes(5));
        token.IsActive(Now.AddMinutes(5)).Should().BeFalse("token đã dùng thì không còn hiệu lực");
    }

    [Fact]
    public void MarkUsed_LanThuHai_ThatBai()
    {
        var token = RefreshToken.Issue(Guid.NewGuid(), Hash, Now, null);
        token.MarkUsed(Now.AddMinutes(1));

        var result = token.MarkUsed(Now.AddMinutes(2));

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("SOE-IDN-402");
    }

    [Fact]
    public void IsActive_SauKhiHetHan_TraVeFalse()
    {
        var token = RefreshToken.Issue(Guid.NewGuid(), Hash, Now, null);

        token.IsActive(Now.AddDays(8)).Should().BeFalse();
    }

    [Fact]
    public void IsActive_KhiChuoiTokenHetHan_TraVeFalse()
    {
        // Token mới cấp lúc ngày thứ 29 nhưng chuỗi hết hạn ở ngày 30 (BR-IDN-005).
        var familyExpires = Now.AddDays(30);
        var token = RefreshToken.Issue(
            Guid.NewGuid(), Hash, Now.AddDays(29), null, Guid.NewGuid(), familyExpires);

        token.IsActive(Now.AddDays(29)).Should().BeTrue();
        token.IsActive(Now.AddDays(31)).Should().BeFalse();
    }

    [Fact]
    public void Revoke_GhiNhanLyDoVaVoHieuHoa()
    {
        var token = RefreshToken.Issue(Guid.NewGuid(), Hash, Now, null);

        token.Revoke(Now.AddMinutes(1), "LOGOUT");

        token.RevokedAt.Should().Be(Now.AddMinutes(1));
        token.RevokedReason.Should().Be("LOGOUT");
        token.IsActive(Now.AddMinutes(2)).Should().BeFalse();
    }

    [Fact]
    public void Revoke_GoiHaiLan_GiuNguyenLanDau()
    {
        var token = RefreshToken.Issue(Guid.NewGuid(), Hash, Now, null);
        token.Revoke(Now, "LOGOUT");

        token.Revoke(Now.AddMinutes(5), "ADMIN_REVOKED");

        token.RevokedReason.Should().Be("LOGOUT");
    }
}
