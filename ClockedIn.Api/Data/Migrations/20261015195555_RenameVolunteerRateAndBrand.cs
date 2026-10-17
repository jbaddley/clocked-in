using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameVolunteerRateAndBrand : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserTimeEntry_organizationId",
                table: "UserTimeEntry");

            migrationBuilder.DropIndex(
                name: "IX_UserTimeEntry_userId",
                table: "UserTimeEntry");

            migrationBuilder.DropCheckConstraint(
                name: "UserTimeEntry_mode_check",
                table: "UserTimeEntry");

            migrationBuilder.DropCheckConstraint(
                name: "OrganizationMembership_rate_check",
                table: "OrganizationMembership");

            migrationBuilder.DropCheckConstraint(
                name: "Organization_rate_check",
                table: "Organization");

            migrationBuilder.DropIndex(
                name: "IX_CollectiveTimeEntry_organizationId",
                table: "CollectiveTimeEntry");

            migrationBuilder.RenameColumn(
                name: "utahVolunteerRate",
                table: "Organization",
                newName: "volunteerHourlyRate");

            migrationBuilder.Sql(
                """
                UPDATE "Organization" SET "defaultRateType" = 'Volunteer' WHERE "defaultRateType" = 'UtahVolunteer';
                UPDATE "OrganizationMembership" SET "rateType" = 'Volunteer' WHERE "rateType" = 'UtahVolunteer';
                """);

            migrationBuilder.AddColumn<string>(
                name: "sourceRef",
                table: "UserTimeEntry",
                type: "text",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "rateType",
                table: "OrganizationMembership",
                type: "text",
                nullable: false,
                defaultValue: "Volunteer",
                oldClrType: typeof(string),
                oldType: "text",
                oldDefaultValue: "UtahVolunteer");

            migrationBuilder.AddColumn<Guid>(
                name: "primaryDepartmentId",
                table: "OrganizationMembership",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "defaultRateType",
                table: "Organization",
                type: "text",
                nullable: false,
                defaultValue: "Volunteer",
                oldClrType: typeof(string),
                oldType: "text",
                oldDefaultValue: "UtahVolunteer");

            migrationBuilder.CreateTable(
                name: "OrganizationBrand",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    wordmarkUrl = table.Column<string>(type: "text", nullable: true),
                    markUrl = table.Column<string>(type: "text", nullable: true),
                    accentImageUrl = table.Column<string>(type: "text", nullable: true),
                    primary = table.Column<string>(type: "text", nullable: false),
                    primaryForeground = table.Column<string>(type: "text", nullable: false),
                    highlight = table.Column<string>(type: "text", nullable: false),
                    accent = table.Column<string>(type: "text", nullable: false),
                    success = table.Column<string>(type: "text", nullable: false),
                    surface = table.Column<string>(type: "text", nullable: false),
                    surfaceForeground = table.Column<string>(type: "text", nullable: false),
                    foreground = table.Column<string>(type: "text", nullable: false),
                    headingFont = table.Column<string>(type: "text", nullable: false),
                    bodyFont = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationBrand", x => x.id);
                    table.CheckConstraint("OrganizationBrand_token_check", "\"primary\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"primaryForeground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"highlight\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"accent\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"success\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"surface\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"surfaceForeground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"foreground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"headingFont\" IN ('SourceSans3', 'NunitoSans', 'Geist')\r\nAND \"bodyFont\" IN ('SourceSans3', 'NunitoSans', 'Geist')");
                    table.ForeignKey(
                        name: "FK_OrganizationBrand_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserTimeEntry_organizationId_occurredOn",
                table: "UserTimeEntry",
                columns: new[] { "organizationId", "occurredOn" });

            migrationBuilder.CreateIndex(
                name: "IX_UserTimeEntry_sourceRef",
                table: "UserTimeEntry",
                column: "sourceRef",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserTimeEntry_userId_occurredOn",
                table: "UserTimeEntry",
                columns: new[] { "userId", "occurredOn" });

            migrationBuilder.AddCheckConstraint(
                name: "UserTimeEntry_mode_check",
                table: "UserTimeEntry",
                sql: "\"hourlyRate\" > 0\r\nAND (\r\n  (\r\n    \"mode\" = 'Punch'\r\n    AND \"startedAt\" IS NOT NULL\r\n    AND (\r\n      (\r\n        \"endedAt\" IS NULL\r\n        AND \"durationMinutes\" IS NULL\r\n        AND \"inKindValue\" IS NULL\r\n      )\r\n      OR (\r\n        \"endedAt\" IS NOT NULL\r\n        AND \"endedAt\" > \"startedAt\"\r\n        AND \"durationMinutes\" BETWEEN 1 AND 1440\r\n        AND \"durationMinutes\" = FLOOR(EXTRACT(EPOCH FROM (\"endedAt\" - \"startedAt\")) / 60)::integer\r\n        AND \"inKindValue\" IS NOT NULL\r\n        AND \"inKindValue\" = ROUND((\"durationMinutes\"::numeric * \"hourlyRate\") / 60, 2)\r\n      )\r\n    )\r\n  )\r\n  OR (\r\n    \"mode\" = 'Duration'\r\n    AND \"durationMinutes\" BETWEEN 1 AND 1440\r\n    AND \"inKindValue\" IS NOT NULL\r\n    AND \"inKindValue\" = ROUND((\"durationMinutes\"::numeric * \"hourlyRate\") / 60, 2)\r\n    AND (\r\n      (\"startedAt\" IS NULL AND \"endedAt\" IS NULL)\r\n      OR (\r\n        \"startedAt\" IS NOT NULL\r\n        AND \"endedAt\" IS NOT NULL\r\n        AND \"endedAt\" > \"startedAt\"\r\n        AND \"durationMinutes\" = FLOOR(EXTRACT(EPOCH FROM (\"endedAt\" - \"startedAt\")) / 60)::integer\r\n      )\r\n    )\r\n  )\r\n  OR (\r\n    \"mode\" = 'Total'\r\n    AND \"durationMinutes\" BETWEEN 1 AND 59940\r\n    AND \"startedAt\" IS NULL\r\n    AND \"endedAt\" IS NULL\r\n    AND \"inKindValue\" IS NOT NULL\r\n    AND \"inKindValue\" = ROUND((\"durationMinutes\"::numeric * \"hourlyRate\") / 60, 2)\r\n  )\r\n)");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationMembership_primaryDepartmentId",
                table: "OrganizationMembership",
                column: "primaryDepartmentId");

            migrationBuilder.AddCheckConstraint(
                name: "OrganizationMembership_rate_check",
                table: "OrganizationMembership",
                sql: "\"rateType\" IN ('Volunteer', 'Professional')\r\nAND (\r\n  (\"rateType\" = 'Volunteer' AND \"professionalBillingRate\" IS NULL)\r\n  OR (\r\n    \"rateType\" = 'Professional'\r\n    AND \"professionalBillingRate\" IS NOT NULL\r\n    AND \"professionalBillingRate\" > 0\r\n  )\r\n)");

            migrationBuilder.AddCheckConstraint(
                name: "Organization_rate_check",
                table: "Organization",
                sql: "\"volunteerHourlyRate\" > 0 AND \"defaultRateType\" IN ('Volunteer', 'Professional')");

            migrationBuilder.CreateIndex(
                name: "IX_CollectiveTimeEntry_organizationId_startedAt",
                table: "CollectiveTimeEntry",
                columns: new[] { "organizationId", "startedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationBrand_organizationId",
                table: "OrganizationBrand",
                column: "organizationId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_OrganizationMembership_Department_primaryDepartmentId",
                table: "OrganizationMembership",
                column: "primaryDepartmentId",
                principalTable: "Department",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OrganizationMembership_Department_primaryDepartmentId",
                table: "OrganizationMembership");

            migrationBuilder.DropTable(
                name: "OrganizationBrand");

            migrationBuilder.DropIndex(
                name: "IX_UserTimeEntry_organizationId_occurredOn",
                table: "UserTimeEntry");

            migrationBuilder.DropIndex(
                name: "IX_UserTimeEntry_sourceRef",
                table: "UserTimeEntry");

            migrationBuilder.DropIndex(
                name: "IX_UserTimeEntry_userId_occurredOn",
                table: "UserTimeEntry");

            migrationBuilder.DropCheckConstraint(
                name: "UserTimeEntry_mode_check",
                table: "UserTimeEntry");

            migrationBuilder.DropIndex(
                name: "IX_OrganizationMembership_primaryDepartmentId",
                table: "OrganizationMembership");

            migrationBuilder.DropCheckConstraint(
                name: "OrganizationMembership_rate_check",
                table: "OrganizationMembership");

            migrationBuilder.DropCheckConstraint(
                name: "Organization_rate_check",
                table: "Organization");

            migrationBuilder.DropIndex(
                name: "IX_CollectiveTimeEntry_organizationId_startedAt",
                table: "CollectiveTimeEntry");

            migrationBuilder.DropColumn(
                name: "sourceRef",
                table: "UserTimeEntry");

            migrationBuilder.DropColumn(
                name: "primaryDepartmentId",
                table: "OrganizationMembership");

            migrationBuilder.RenameColumn(
                name: "volunteerHourlyRate",
                table: "Organization",
                newName: "utahVolunteerRate");

            migrationBuilder.AlterColumn<string>(
                name: "rateType",
                table: "OrganizationMembership",
                type: "text",
                nullable: false,
                defaultValue: "UtahVolunteer",
                oldClrType: typeof(string),
                oldType: "text",
                oldDefaultValue: "Volunteer");

            migrationBuilder.AlterColumn<string>(
                name: "defaultRateType",
                table: "Organization",
                type: "text",
                nullable: false,
                defaultValue: "UtahVolunteer",
                oldClrType: typeof(string),
                oldType: "text",
                oldDefaultValue: "Volunteer");

            migrationBuilder.CreateIndex(
                name: "IX_UserTimeEntry_organizationId",
                table: "UserTimeEntry",
                column: "organizationId");

            migrationBuilder.CreateIndex(
                name: "IX_UserTimeEntry_userId",
                table: "UserTimeEntry",
                column: "userId");

            migrationBuilder.AddCheckConstraint(
                name: "UserTimeEntry_mode_check",
                table: "UserTimeEntry",
                sql: "\"hourlyRate\" > 0\r\nAND (\r\n  (\r\n    \"mode\" = 'Punch'\r\n    AND \"startedAt\" IS NOT NULL\r\n    AND (\r\n      (\r\n        \"endedAt\" IS NULL\r\n        AND \"durationMinutes\" IS NULL\r\n        AND \"inKindValue\" IS NULL\r\n      )\r\n      OR (\r\n        \"endedAt\" IS NOT NULL\r\n        AND \"endedAt\" > \"startedAt\"\r\n        AND \"durationMinutes\" BETWEEN 1 AND 1440\r\n        AND \"durationMinutes\" = FLOOR(EXTRACT(EPOCH FROM (\"endedAt\" - \"startedAt\")) / 60)::integer\r\n        AND \"inKindValue\" IS NOT NULL\r\n        AND \"inKindValue\" = ROUND((\"durationMinutes\"::numeric * \"hourlyRate\") / 60, 2)\r\n      )\r\n    )\r\n  )\r\n  OR (\r\n    \"mode\" = 'Duration'\r\n    AND \"durationMinutes\" BETWEEN 1 AND 1440\r\n    AND \"inKindValue\" IS NOT NULL\r\n    AND \"inKindValue\" = ROUND((\"durationMinutes\"::numeric * \"hourlyRate\") / 60, 2)\r\n    AND (\r\n      (\"startedAt\" IS NULL AND \"endedAt\" IS NULL)\r\n      OR (\r\n        \"startedAt\" IS NOT NULL\r\n        AND \"endedAt\" IS NOT NULL\r\n        AND \"endedAt\" > \"startedAt\"\r\n        AND \"durationMinutes\" = FLOOR(EXTRACT(EPOCH FROM (\"endedAt\" - \"startedAt\")) / 60)::integer\r\n      )\r\n    )\r\n  )\r\n  OR (\r\n    \"mode\" = 'Total'\r\n    AND \"durationMinutes\" BETWEEN 1 AND 1440\r\n    AND \"startedAt\" IS NULL\r\n    AND \"endedAt\" IS NULL\r\n    AND \"inKindValue\" IS NOT NULL\r\n    AND \"inKindValue\" = ROUND((\"durationMinutes\"::numeric * \"hourlyRate\") / 60, 2)\r\n  )\r\n)");

            migrationBuilder.AddCheckConstraint(
                name: "OrganizationMembership_rate_check",
                table: "OrganizationMembership",
                sql: "\"rateType\" IN ('UtahVolunteer', 'Professional')\r\nAND (\r\n  (\"rateType\" = 'UtahVolunteer' AND \"professionalBillingRate\" IS NULL)\r\n  OR (\r\n    \"rateType\" = 'Professional'\r\n    AND \"professionalBillingRate\" IS NOT NULL\r\n    AND \"professionalBillingRate\" > 0\r\n  )\r\n)");

            migrationBuilder.AddCheckConstraint(
                name: "Organization_rate_check",
                table: "Organization",
                sql: "\"utahVolunteerRate\" > 0 AND \"defaultRateType\" IN ('UtahVolunteer', 'Professional')");

            migrationBuilder.CreateIndex(
                name: "IX_CollectiveTimeEntry_organizationId",
                table: "CollectiveTimeEntry",
                column: "organizationId");
        }
    }
}
