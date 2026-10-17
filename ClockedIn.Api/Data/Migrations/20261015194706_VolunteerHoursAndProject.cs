using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class VolunteerHoursAndProject : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "UserTimeEntry_mode_check",
                table: "UserTimeEntry");

            migrationBuilder.DropCheckConstraint(
                name: "CollectiveTimeEntry_span_check",
                table: "CollectiveTimeEntry");

            // New enum values must commit before CHECK constraints can reference them.
            migrationBuilder.Sql(
                """ALTER TYPE "TimeEntryMode" ADD VALUE IF NOT EXISTS 'Total';""",
                suppressTransaction: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "createdAt",
                table: "UserTimeEntry",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AddColumn<Guid>(
                name: "enteredByUserId",
                table: "UserTimeEntry",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<decimal>(
                name: "hourlyRate",
                table: "UserTimeEntry",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "inKindValue",
                table: "UserTimeEntry",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "projectId",
                table: "UserTimeEntry",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "taskCategoryId",
                table: "UserTimeEntry",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "notes",
                table: "UserProfile",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "zipCode",
                table: "UserProfile",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "isActive",
                table: "OrganizationMembership",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<decimal>(
                name: "professionalBillingRate",
                table: "OrganizationMembership",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "rateType",
                table: "OrganizationMembership",
                type: "text",
                nullable: false,
                defaultValue: "UtahVolunteer");

            migrationBuilder.AddColumn<string>(
                name: "defaultRateType",
                table: "Organization",
                type: "text",
                nullable: false,
                defaultValue: "UtahVolunteer");

            migrationBuilder.AddColumn<int>(
                name: "rateSourceYear",
                table: "Organization",
                type: "integer",
                nullable: false,
                defaultValue: 2025);

            migrationBuilder.AddColumn<decimal>(
                name: "utahVolunteerRate",
                table: "Organization",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 35.47m);

            migrationBuilder.AddColumn<DateTime>(
                name: "createdAt",
                table: "CollectiveTimeEntry",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP");

            migrationBuilder.AddColumn<decimal>(
                name: "hourlyRate",
                table: "CollectiveTimeEntry",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "inKindValue",
                table: "CollectiveTimeEntry",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<Guid>(
                name: "projectId",
                table: "CollectiveTimeEntry",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "taskCategoryId",
                table: "CollectiveTimeEntry",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "Project",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    departmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    ownerUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "citext", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    accessType = table.Column<string>(type: "text", nullable: false),
                    startDate = table.Column<DateOnly>(type: "date", nullable: true),
                    endDate = table.Column<DateOnly>(type: "date", nullable: true),
                    isActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Project", x => x.id);
                    table.CheckConstraint("Project_access_check", "\"accessType\" IN ('Public', 'Private', 'Department')\r\nAND (\r\n  (\"accessType\" = 'Department' AND \"departmentId\" IS NOT NULL)\r\n  OR (\"accessType\" IN ('Public', 'Private') AND \"departmentId\" IS NULL)\r\n)\r\nAND (\r\n  \"startDate\" IS NULL\r\n  OR \"endDate\" IS NULL\r\n  OR \"endDate\" >= \"startDate\"\r\n)");
                    table.ForeignKey(
                        name: "FK_Project_Department_departmentId",
                        column: x => x.departmentId,
                        principalTable: "Department",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Project_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Project_User_ownerUserId",
                        column: x => x.ownerUserId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TaskCategory",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "citext", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskCategory", x => x.id);
                    table.ForeignKey(
                        name: "FK_TaskCategory_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProjectEditor",
                columns: table => new
                {
                    projectId = table.Column<Guid>(type: "uuid", nullable: false),
                    userId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectEditor", x => new { x.projectId, x.userId });
                    table.ForeignKey(
                        name: "FK_ProjectEditor_Project_projectId",
                        column: x => x.projectId,
                        principalTable: "Project",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectEditor_User_userId",
                        column: x => x.userId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserTimeEntry_enteredByUserId",
                table: "UserTimeEntry",
                column: "enteredByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserTimeEntry_projectId",
                table: "UserTimeEntry",
                column: "projectId");

            migrationBuilder.CreateIndex(
                name: "IX_UserTimeEntry_taskCategoryId",
                table: "UserTimeEntry",
                column: "taskCategoryId");

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
                name: "IX_CollectiveTimeEntry_projectId",
                table: "CollectiveTimeEntry",
                column: "projectId");

            migrationBuilder.CreateIndex(
                name: "IX_CollectiveTimeEntry_taskCategoryId",
                table: "CollectiveTimeEntry",
                column: "taskCategoryId");

            migrationBuilder.AddCheckConstraint(
                name: "CollectiveTimeEntry_span_check",
                table: "CollectiveTimeEntry",
                sql: "\"endedAt\" > \"startedAt\"\r\nAND \"participantCount\" >= 1\r\nAND \"hourlyRate\" > 0\r\nAND \"inKindValue\" = ROUND(\r\n  (EXTRACT(EPOCH FROM (\"endedAt\" - \"startedAt\")) / 3600.0)\r\n  * \"participantCount\"\r\n  * \"hourlyRate\"\r\n, 2)");

            migrationBuilder.CreateIndex(
                name: "IX_Project_departmentId",
                table: "Project",
                column: "departmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Project_organizationId_title",
                table: "Project",
                columns: new[] { "organizationId", "title" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Project_ownerUserId",
                table: "Project",
                column: "ownerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectEditor_userId",
                table: "ProjectEditor",
                column: "userId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskCategory_organizationId_name",
                table: "TaskCategory",
                columns: new[] { "organizationId", "name" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_CollectiveTimeEntry_Project_projectId",
                table: "CollectiveTimeEntry",
                column: "projectId",
                principalTable: "Project",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_CollectiveTimeEntry_TaskCategory_taskCategoryId",
                table: "CollectiveTimeEntry",
                column: "taskCategoryId",
                principalTable: "TaskCategory",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UserTimeEntry_Project_projectId",
                table: "UserTimeEntry",
                column: "projectId",
                principalTable: "Project",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UserTimeEntry_TaskCategory_taskCategoryId",
                table: "UserTimeEntry",
                column: "taskCategoryId",
                principalTable: "TaskCategory",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UserTimeEntry_User_enteredByUserId",
                table: "UserTimeEntry",
                column: "enteredByUserId",
                principalTable: "User",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CollectiveTimeEntry_Project_projectId",
                table: "CollectiveTimeEntry");

            migrationBuilder.DropForeignKey(
                name: "FK_CollectiveTimeEntry_TaskCategory_taskCategoryId",
                table: "CollectiveTimeEntry");

            migrationBuilder.DropForeignKey(
                name: "FK_UserTimeEntry_Project_projectId",
                table: "UserTimeEntry");

            migrationBuilder.DropForeignKey(
                name: "FK_UserTimeEntry_TaskCategory_taskCategoryId",
                table: "UserTimeEntry");

            migrationBuilder.DropForeignKey(
                name: "FK_UserTimeEntry_User_enteredByUserId",
                table: "UserTimeEntry");

            migrationBuilder.DropTable(
                name: "ProjectEditor");

            migrationBuilder.DropTable(
                name: "TaskCategory");

            migrationBuilder.DropTable(
                name: "Project");

            migrationBuilder.DropIndex(
                name: "IX_UserTimeEntry_enteredByUserId",
                table: "UserTimeEntry");

            migrationBuilder.DropIndex(
                name: "IX_UserTimeEntry_projectId",
                table: "UserTimeEntry");

            migrationBuilder.DropIndex(
                name: "IX_UserTimeEntry_taskCategoryId",
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
                name: "IX_CollectiveTimeEntry_projectId",
                table: "CollectiveTimeEntry");

            migrationBuilder.DropIndex(
                name: "IX_CollectiveTimeEntry_taskCategoryId",
                table: "CollectiveTimeEntry");

            migrationBuilder.DropCheckConstraint(
                name: "CollectiveTimeEntry_span_check",
                table: "CollectiveTimeEntry");

            migrationBuilder.DropColumn(
                name: "createdAt",
                table: "UserTimeEntry");

            migrationBuilder.DropColumn(
                name: "enteredByUserId",
                table: "UserTimeEntry");

            migrationBuilder.DropColumn(
                name: "hourlyRate",
                table: "UserTimeEntry");

            migrationBuilder.DropColumn(
                name: "inKindValue",
                table: "UserTimeEntry");

            migrationBuilder.DropColumn(
                name: "projectId",
                table: "UserTimeEntry");

            migrationBuilder.DropColumn(
                name: "taskCategoryId",
                table: "UserTimeEntry");

            migrationBuilder.DropColumn(
                name: "notes",
                table: "UserProfile");

            migrationBuilder.DropColumn(
                name: "zipCode",
                table: "UserProfile");

            migrationBuilder.DropColumn(
                name: "isActive",
                table: "OrganizationMembership");

            migrationBuilder.DropColumn(
                name: "professionalBillingRate",
                table: "OrganizationMembership");

            migrationBuilder.DropColumn(
                name: "rateType",
                table: "OrganizationMembership");

            migrationBuilder.DropColumn(
                name: "defaultRateType",
                table: "Organization");

            migrationBuilder.DropColumn(
                name: "rateSourceYear",
                table: "Organization");

            migrationBuilder.DropColumn(
                name: "utahVolunteerRate",
                table: "Organization");

            migrationBuilder.DropColumn(
                name: "createdAt",
                table: "CollectiveTimeEntry");

            migrationBuilder.DropColumn(
                name: "hourlyRate",
                table: "CollectiveTimeEntry");

            migrationBuilder.DropColumn(
                name: "inKindValue",
                table: "CollectiveTimeEntry");

            migrationBuilder.DropColumn(
                name: "projectId",
                table: "CollectiveTimeEntry");

            migrationBuilder.DropColumn(
                name: "taskCategoryId",
                table: "CollectiveTimeEntry");

            // Postgres cannot remove an enum value safely; leave TimeEntryMode.Total in place.

            migrationBuilder.AddCheckConstraint(
                name: "UserTimeEntry_mode_check",
                table: "UserTimeEntry",
                sql: "(\r\n  \"mode\" = 'Punch'\r\n  AND \"startedAt\" IS NOT NULL\r\n  AND (\r\n    (\"endedAt\" IS NULL AND \"durationMinutes\" IS NULL)\r\n    OR (\r\n      \"endedAt\" IS NOT NULL\r\n      AND \"endedAt\" > \"startedAt\"\r\n      AND \"durationMinutes\" = FLOOR(EXTRACT(EPOCH FROM (\"endedAt\" - \"startedAt\")) / 60)::integer\r\n    )\r\n  )\r\n)\r\nOR (\r\n  \"mode\" = 'Duration'\r\n  AND \"durationMinutes\" > 0\r\n  AND (\r\n    (\"startedAt\" IS NULL AND \"endedAt\" IS NULL)\r\n    OR (\r\n      \"startedAt\" IS NOT NULL\r\n      AND \"endedAt\" IS NOT NULL\r\n      AND \"endedAt\" > \"startedAt\"\r\n      AND \"durationMinutes\" = FLOOR(EXTRACT(EPOCH FROM (\"endedAt\" - \"startedAt\")) / 60)::integer\r\n    )\r\n  )\r\n)");

            migrationBuilder.AddCheckConstraint(
                name: "CollectiveTimeEntry_span_check",
                table: "CollectiveTimeEntry",
                sql: "\"endedAt\" > \"startedAt\" AND \"participantCount\" >= 1");
        }
    }
}
