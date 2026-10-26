using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class VolunteerNeeds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Guest",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    email = table.Column<string>(type: "text", nullable: false),
                    phone = table.Column<string>(type: "text", nullable: false),
                    userId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Guest", x => x.id);
                    table.CheckConstraint("Guest_values_check", "char_length(btrim(\"name\")) BETWEEN 1 AND 120\r\nAND \"email\" = lower(\"email\")\r\nAND char_length(btrim(\"phone\")) BETWEEN 1 AND 40");
                    table.ForeignKey(
                        name: "FK_Guest_User_userId",
                        column: x => x.userId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "VolunteerNeed",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    createdByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    publicToken = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "citext", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    type = table.Column<string>(type: "text", nullable: false),
                    countNeeded = table.Column<int>(type: "integer", nullable: false),
                    countVetted = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    startDate = table.Column<DateOnly>(type: "date", nullable: true),
                    endDate = table.Column<DateOnly>(type: "date", nullable: true),
                    requiredBy = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    allowPublic = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    requireVetting = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    questions = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{\"version\":1,\"items\":[]}'::jsonb"),
                    projectId = table.Column<Guid>(type: "uuid", nullable: true),
                    taskCategoryId = table.Column<Guid>(type: "uuid", nullable: true),
                    departmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    createdAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VolunteerNeed", x => x.id);
                    table.CheckConstraint("VolunteerNeed_values_check", "\"type\" IN ('Position', 'Task')\r\nAND char_length(btrim(\"name\"::text)) BETWEEN 1 AND 200\r\nAND (\"description\" IS NULL OR char_length(\"description\") BETWEEN 1 AND 4000)\r\nAND \"countNeeded\" BETWEEN 1 AND 10000\r\nAND \"countVetted\" >= 0\r\nAND \"countVetted\" <= \"countNeeded\"\r\nAND (\"endDate\" IS NULL OR \"startDate\" IS NULL OR \"endDate\" >= \"startDate\")\r\nAND char_length(\"publicToken\") = 32\r\nAND \"publicToken\" = lower(\"publicToken\")\r\nAND left(\"questions\"::text, 1) = '{'");
                    table.ForeignKey(
                        name: "FK_VolunteerNeed_Department_departmentId",
                        column: x => x.departmentId,
                        principalTable: "Department",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_VolunteerNeed_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_VolunteerNeed_Project_projectId",
                        column: x => x.projectId,
                        principalTable: "Project",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_VolunteerNeed_TaskCategory_taskCategoryId",
                        column: x => x.taskCategoryId,
                        principalTable: "TaskCategory",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_VolunteerNeed_User_createdByUserId",
                        column: x => x.createdByUserId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "VolunteerSignup",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    volunteerNeedId = table.Column<Guid>(type: "uuid", nullable: false),
                    userId = table.Column<Guid>(type: "uuid", nullable: true),
                    guestId = table.Column<Guid>(type: "uuid", nullable: true),
                    comment = table.Column<string>(type: "text", nullable: true),
                    answers = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    passed = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    vetted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    createdAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VolunteerSignup", x => x.id);
                    table.CheckConstraint("VolunteerSignup_person_check", "((\"userId\" IS NOT NULL AND \"guestId\" IS NULL) OR (\"userId\" IS NULL AND \"guestId\" IS NOT NULL))\r\nAND (\"comment\" IS NULL OR char_length(\"comment\") BETWEEN 1 AND 2000)\r\nAND left(\"answers\"::text, 1) = '['");
                    table.ForeignKey(
                        name: "FK_VolunteerSignup_Guest_guestId",
                        column: x => x.guestId,
                        principalTable: "Guest",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_VolunteerSignup_User_userId",
                        column: x => x.userId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_VolunteerSignup_VolunteerNeed_volunteerNeedId",
                        column: x => x.volunteerNeedId,
                        principalTable: "VolunteerNeed",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "Guest_user",
                table: "Guest",
                column: "userId",
                unique: true,
                filter: "\"userId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Guest_email",
                table: "Guest",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerNeed_createdByUserId",
                table: "VolunteerNeed",
                column: "createdByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerNeed_departmentId",
                table: "VolunteerNeed",
                column: "departmentId");

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerNeed_organizationId",
                table: "VolunteerNeed",
                column: "organizationId");

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerNeed_projectId",
                table: "VolunteerNeed",
                column: "projectId");

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerNeed_publicToken",
                table: "VolunteerNeed",
                column: "publicToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerNeed_taskCategoryId",
                table: "VolunteerNeed",
                column: "taskCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerSignup_guestId",
                table: "VolunteerSignup",
                column: "guestId");

            migrationBuilder.CreateIndex(
                name: "IX_VolunteerSignup_userId",
                table: "VolunteerSignup",
                column: "userId");

            migrationBuilder.CreateIndex(
                name: "VolunteerSignup_need_guest",
                table: "VolunteerSignup",
                columns: new[] { "volunteerNeedId", "guestId" },
                unique: true,
                filter: "\"guestId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "VolunteerSignup_need_user",
                table: "VolunteerSignup",
                columns: new[] { "volunteerNeedId", "userId" },
                unique: true,
                filter: "\"userId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VolunteerSignup");

            migrationBuilder.DropTable(
                name: "Guest");

            migrationBuilder.DropTable(
                name: "VolunteerNeed");
        }
    }
}
