using System;
using ClockedIn.Api.Email;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class EmailTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmailTemplate",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    @for = table.Column<string>(name: "for", type: "text", nullable: false),
                    subject = table.Column<string>(type: "text", nullable: false),
                    heading = table.Column<string>(type: "text", nullable: false),
                    preview = table.Column<string>(type: "text", nullable: false),
                    template = table.Column<string>(type: "text", nullable: false),
                    isEnabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    createdAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailTemplate", x => x.id);
                    table.CheckConstraint("EmailTemplate_name_check", "char_length(btrim(\"name\")) BETWEEN 1 AND 80 AND char_length(btrim(\"subject\")) BETWEEN 1 AND 200");
                    table.ForeignKey(
                        name: "FK_EmailTemplate_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "EmailTemplate_organization_for",
                table: "EmailTemplate",
                columns: new[] { "organizationId", "for" },
                unique: true);

            // Backfills from the embedded defaults.json at the time the migration runs.
            migrationBuilder.Sql(EmailTemplateDefaults.BackfillSql());
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmailTemplate");
        }
    }
}
