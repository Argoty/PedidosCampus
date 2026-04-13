using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PedidosCampus.UserService.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "usuario_perfiles",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    userId = table.Column<Guid>(type: "uuid", nullable: false),
                    tipo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    nombre = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    telefono = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    direccion = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    disponible = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    isActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    reservedUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    createdAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'UTC'"),
                    updatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW() AT TIME ZONE 'UTC'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_usuario_perfiles", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_usuario_perfiles_disponible",
                table: "usuario_perfiles",
                column: "disponible");

            migrationBuilder.CreateIndex(
                name: "IX_usuario_perfiles_isActive",
                table: "usuario_perfiles",
                column: "isActive");

            migrationBuilder.CreateIndex(
                name: "IX_usuario_perfiles_reservedUntil",
                table: "usuario_perfiles",
                column: "reservedUntil");

            migrationBuilder.CreateIndex(
                name: "IX_usuario_perfiles_tipo",
                table: "usuario_perfiles",
                column: "tipo");

            migrationBuilder.CreateIndex(
                name: "IX_usuario_perfiles_userId",
                table: "usuario_perfiles",
                column: "userId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "usuario_perfiles");
        }
    }
}
