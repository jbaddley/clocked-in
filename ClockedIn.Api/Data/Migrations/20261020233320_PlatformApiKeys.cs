using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class PlatformApiKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PlatformApiKey",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    prefix = table.Column<string>(type: "text", nullable: false),
                    keyHash = table.Column<string>(type: "text", nullable: false),
                    scopes = table.Column<string>(type: "text", nullable: false),
                    createdByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    createdAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    lastUsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    expiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    revokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformApiKey", x => x.id);
                    table.ForeignKey(
                        name: "FK_PlatformApiKey_User_createdByUserId",
                        column: x => x.createdByUserId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlatformApiKey_createdByUserId",
                table: "PlatformApiKey",
                column: "createdByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformApiKey_keyHash",
                table: "PlatformApiKey",
                column: "keyHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlatformApiKey_prefix",
                table: "PlatformApiKey",
                column: "prefix");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlatformApiKey");
        }
    }
}
