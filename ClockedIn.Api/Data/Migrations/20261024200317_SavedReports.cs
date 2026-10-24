using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class SavedReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Report",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "citext", nullable: false),
                    isDefault = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    layout = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{\"version\":1,\"cards\":[]}'::jsonb"),
                    filters = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    createdAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Report", x => x.id);
                    table.CheckConstraint("Report_name_check", "char_length(btrim(\"name\"::text)) BETWEEN 1 AND 80");
                    table.ForeignKey(
                        name: "FK_Report_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Report_organizationId_name",
                table: "Report",
                columns: new[] { "organizationId", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "Report_one_default",
                table: "Report",
                column: "organizationId",
                unique: true,
                filter: "\"isDefault\" = TRUE");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Report");
        }
    }
}
