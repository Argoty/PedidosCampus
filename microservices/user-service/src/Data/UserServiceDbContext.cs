using Microsoft.EntityFrameworkCore;
using PedidosCampus.UserService.Models;

namespace PedidosCampus.UserService.Data;

/// <summary>
/// DbContext para User Service. Mapea UserProfile a tabla usuario_perfiles
/// con índices y configuraciones según usuarios-schema.prisma.
/// </summary>
public class UserServiceDbContext : DbContext
{
    public UserServiceDbContext(DbContextOptions<UserServiceDbContext> options)
        : base(options)
    {
    }

    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configurar entidad UserProfile
        modelBuilder.Entity<UserProfile>(entity =>
        {
            // Nombre de tabla en BD
            entity.ToTable("usuario_perfiles");

            // Primary Key
            entity.HasKey(e => e.Id).HasName("PK_usuario_perfiles");

            // Columnas
            entity.Property(e => e.Id)
                .HasColumnName("id")
                .HasColumnType("uuid")
                .HasDefaultValueSql("gen_random_uuid()");

            entity.Property(e => e.UserId)
                .HasColumnName("userId")
                .HasColumnType("uuid");

            entity.Property(e => e.Tipo)
                .HasColumnName("tipo")
                .HasColumnType("character varying(20)")
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(e => e.Nombre)
                .HasColumnName("nombre")
                .HasColumnType("character varying(255)")
                .HasMaxLength(255)
                .IsRequired();

            entity.Property(e => e.Telefono)
                .HasColumnName("telefono")
                .HasColumnType("character varying(20)")
                .HasMaxLength(20);

            entity.Property(e => e.Direccion)
                .HasColumnName("direccion")
                .HasColumnType("character varying(500)")
                .HasMaxLength(500);

            entity.Property(e => e.Disponible)
                .HasColumnName("disponible")
                .HasColumnType("boolean")
                .HasDefaultValue(false);

            entity.Property(e => e.IsActive)
                .HasColumnName("isActive")
                .HasColumnType("boolean")
                .HasDefaultValue(true);

            entity.Property(e => e.ReservedUntil)
                .HasColumnName("reservedUntil")
                .HasColumnType("timestamp with time zone");

            entity.Property(e => e.CreatedAt)
                .HasColumnName("createdAt")
                .HasColumnType("timestamp with time zone")
                .HasDefaultValueSql("NOW() AT TIME ZONE 'UTC'");

            entity.Property(e => e.UpdatedAt)
                .HasColumnName("updatedAt")
                .HasColumnType("timestamp with time zone")
                .HasDefaultValueSql("NOW() AT TIME ZONE 'UTC'");

            // Índices (según usuarios-schema.prisma)
            entity.HasIndex(e => e.UserId)
                .IsUnique()
                .HasDatabaseName("IX_usuario_perfiles_userId");

            entity.HasIndex(e => e.Tipo)
                .HasDatabaseName("IX_usuario_perfiles_tipo");

            entity.HasIndex(e => e.IsActive)
                .HasDatabaseName("IX_usuario_perfiles_isActive");

            entity.HasIndex(e => e.Disponible)
                .HasDatabaseName("IX_usuario_perfiles_disponible");

            entity.HasIndex(e => e.ReservedUntil)
                .HasDatabaseName("IX_usuario_perfiles_reservedUntil");
        });
    }
}
