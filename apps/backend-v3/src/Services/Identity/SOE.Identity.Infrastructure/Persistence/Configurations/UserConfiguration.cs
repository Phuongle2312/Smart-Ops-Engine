using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SOE.Identity.Domain;

namespace SOE.Identity.Infrastructure.Persistence.Configurations;

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");
        builder.HasKey(u => u.Id);

        builder.Property(u => u.Id).ValueGeneratedNever();

        builder.Property(u => u.Username)
            .HasConversion(v => v.Value, v => Username.Create(v).Value)
            .HasColumnName("Username")
            .HasMaxLength(Username.MaxLength)
            .IsUnicode(false)
            .IsRequired();

        builder.HasIndex(u => u.Username).IsUnique();

        builder.Property(u => u.Email)
            .HasConversion(v => v.Value, v => EmailAddress.Create(v).Value)
            .HasColumnName("Email")
            .HasMaxLength(EmailAddress.MaxLength)
            .IsRequired();

        builder.HasIndex(u => u.Email).IsUnique();

        builder.Property(u => u.PasswordHash)
            .HasMaxLength(256)
            .IsUnicode(false)
            .IsRequired();

        builder.Property(u => u.FullName).HasMaxLength(128).IsRequired();

        builder.Property(u => u.Role)
            .HasConversion(v => v.ToClaimValue(), v => Parse(v))
            .HasMaxLength(16)
            .IsUnicode(false)
            .IsRequired();

        builder.Property(u => u.IsActive).IsRequired();
        builder.Property(u => u.MustChangePassword).IsRequired();
        builder.Property(u => u.FailedLoginCount).IsRequired();

        builder.Property(u => u.LockedUntil).HasPrecision(3);
        builder.Property(u => u.PasswordChangedAt).HasPrecision(3).IsRequired();
        builder.Property(u => u.LastLoginAt).HasPrecision(3);
        builder.Property(u => u.CreatedAt).HasPrecision(3).IsRequired();
        builder.Property(u => u.UpdatedAt).HasPrecision(3).IsRequired();

        // Optimistic concurrency (docs D2)
        builder.Property<byte[]>("RowVersion").IsRowVersion();

        builder.Ignore(u => u.DomainEvents);
    }

    private static UserRole Parse(string value)
    {
        UserRoleExtensions.TryParse(value, out var role);
        return role;
    }
}
