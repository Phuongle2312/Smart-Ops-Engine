using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SOE.Identity.Domain;

namespace SOE.Identity.Infrastructure.Persistence.Configurations;

internal sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("RefreshTokens");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id).ValueGeneratedNever();
        builder.Property(t => t.UserId).IsRequired();

        // Chỉ lưu hash SHA-256 của token, không lưu token gốc (NFR-SEC-005).
        builder.Property(t => t.TokenHash).HasColumnType("varbinary(32)").IsRequired();
        builder.HasIndex(t => t.TokenHash).IsUnique();

        builder.Property(t => t.FamilyId).IsRequired();
        builder.HasIndex(t => t.FamilyId);
        builder.HasIndex(t => new { t.UserId, t.ExpiresAt });

        builder.Property(t => t.CreatedAt).HasPrecision(3).IsRequired();
        builder.Property(t => t.ExpiresAt).HasPrecision(3).IsRequired();
        builder.Property(t => t.FamilyExpiresAt).HasPrecision(3).IsRequired();
        builder.Property(t => t.UsedAt).HasPrecision(3);
        builder.Property(t => t.RevokedAt).HasPrecision(3);
        builder.Property(t => t.RevokedReason).HasMaxLength(64).IsUnicode(false);
        builder.Property(t => t.CreatedByIp).HasMaxLength(64).IsUnicode(false);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
