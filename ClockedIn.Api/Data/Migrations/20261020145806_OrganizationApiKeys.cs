using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class OrganizationApiKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OrganizationApiKey",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: false),
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
                    table.PrimaryKey("PK_OrganizationApiKey", x => x.id);
                    table.ForeignKey(
                        name: "FK_OrganizationApiKey_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrganizationApiKey_User_createdByUserId",
                        column: x => x.createdByUserId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationApiKey_createdByUserId",
                table: "OrganizationApiKey",
                column: "createdByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationApiKey_keyHash",
                table: "OrganizationApiKey",
                column: "keyHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationApiKey_organizationId",
                table: "OrganizationApiKey",
                column: "organizationId");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationApiKey_prefix",
                table: "OrganizationApiKey",
                column: "prefix");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrganizationApiKey");
        }
    }
}
