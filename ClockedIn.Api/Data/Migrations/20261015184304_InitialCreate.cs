using System;
using ClockedIn.Api.Entities;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:TimeEntryMode", "Punch,Duration")
                .Annotation("Npgsql:PostgresExtension:citext", ",,");

            migrationBuilder.CreateTable(
                name: "Organization",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Organization", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "Role",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Role", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "User",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    username = table.Column<string>(type: "text", nullable: false),
                    email = table.Column<string>(type: "text", nullable: false),
                    passwordHash = table.Column<string>(type: "text", nullable: false),
                    createdAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_User", x => x.id);
                    table.CheckConstraint("User_lowercase_identity_check", "\"username\" = lower(\"username\") AND \"email\" = lower(\"email\")");
                });

            migrationBuilder.CreateTable(
                name: "Department",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "citext", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Department", x => x.id);
                    table.ForeignKey(
                        name: "FK_Department_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Tag",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "citext", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tag", x => x.id);
                    table.ForeignKey(
                        name: "FK_Tag_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationMembership",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    userId = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    roleId = table.Column<Guid>(type: "uuid", nullable: false),
                    joinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationMembership", x => x.id);
                    table.ForeignKey(
                        name: "FK_OrganizationMembership_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OrganizationMembership_Role_roleId",
                        column: x => x.roleId,
                        principalTable: "Role",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OrganizationMembership_User_userId",
                        column: x => x.userId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RefreshToken",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    userId = table.Column<Guid>(type: "uuid", nullable: false),
                    tokenHash = table.Column<string>(type: "text", nullable: false),
                    expiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    revokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshToken", x => x.id);
                    table.ForeignKey(
                        name: "FK_RefreshToken_User_userId",
                        column: x => x.userId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserProfile",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    userId = table.Column<Guid>(type: "uuid", nullable: false),
                    firstName = table.Column<string>(type: "text", nullable: false),
                    lastName = table.Column<string>(type: "text", nullable: false),
                    displayName = table.Column<string>(type: "text", nullable: true),
                    timezone = table.Column<string>(type: "text", nullable: false, defaultValue: "UTC"),
                    phone = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserProfile", x => x.id);
                    table.ForeignKey(
                        name: "FK_UserProfile_User_userId",
                        column: x => x.userId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CollectiveTimeEntry",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    recordedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    departmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    startedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    endedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    participantCount = table.Column<int>(type: "integer", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CollectiveTimeEntry", x => x.id);
                    table.CheckConstraint("CollectiveTimeEntry_span_check", "\"endedAt\" > \"startedAt\" AND \"participantCount\" >= 1");
                    table.ForeignKey(
                        name: "FK_CollectiveTimeEntry_Department_departmentId",
                        column: x => x.departmentId,
                        principalTable: "Department",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CollectiveTimeEntry_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CollectiveTimeEntry_User_recordedByUserId",
                        column: x => x.recordedByUserId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DepartmentMembership",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    userId = table.Column<Guid>(type: "uuid", nullable: false),
                    departmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    roleId = table.Column<Guid>(type: "uuid", nullable: false),
                    joinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DepartmentMembership", x => x.id);
                    table.ForeignKey(
                        name: "FK_DepartmentMembership_Department_departmentId",
                        column: x => x.departmentId,
                        principalTable: "Department",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DepartmentMembership_Role_roleId",
                        column: x => x.roleId,
                        principalTable: "Role",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DepartmentMembership_User_userId",
                        column: x => x.userId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserTimeEntry",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    userId = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    departmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    mode = table.Column<TimeEntryMode>(type: "\"TimeEntryMode\"", nullable: false),
                    startedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    endedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    durationMinutes = table.Column<int>(type: "integer", nullable: true),
                    occurredOn = table.Column<DateOnly>(type: "date", nullable: false),
                    description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserTimeEntry", x => x.id);
                    table.CheckConstraint("UserTimeEntry_mode_check", "(\r\n  \"mode\" = 'Punch'\r\n  AND \"startedAt\" IS NOT NULL\r\n  AND (\r\n    (\"endedAt\" IS NULL AND \"durationMinutes\" IS NULL)\r\n    OR (\r\n      \"endedAt\" IS NOT NULL\r\n      AND \"endedAt\" > \"startedAt\"\r\n      AND \"durationMinutes\" = FLOOR(EXTRACT(EPOCH FROM (\"endedAt\" - \"startedAt\")) / 60)::integer\r\n    )\r\n  )\r\n)\r\nOR (\r\n  \"mode\" = 'Duration'\r\n  AND \"durationMinutes\" > 0\r\n  AND (\r\n    (\"startedAt\" IS NULL AND \"endedAt\" IS NULL)\r\n    OR (\r\n      \"startedAt\" IS NOT NULL\r\n      AND \"endedAt\" IS NOT NULL\r\n      AND \"endedAt\" > \"startedAt\"\r\n      AND \"durationMinutes\" = FLOOR(EXTRACT(EPOCH FROM (\"endedAt\" - \"startedAt\")) / 60)::integer\r\n    )\r\n  )\r\n)");
                    table.ForeignKey(
                        name: "FK_UserTimeEntry_Department_departmentId",
                        column: x => x.departmentId,
                        principalTable: "Department",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserTimeEntry_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserTimeEntry_User_userId",
                        column: x => x.userId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CollectiveTimeEntryTag",
                columns: table => new
                {
                    collectiveTimeEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    tagId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CollectiveTimeEntryTag", x => new { x.collectiveTimeEntryId, x.tagId });
                    table.ForeignKey(
                        name: "FK_CollectiveTimeEntryTag_CollectiveTimeEntry_collectiveTimeEn~",
                        column: x => x.collectiveTimeEntryId,
                        principalTable: "CollectiveTimeEntry",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CollectiveTimeEntryTag_Tag_tagId",
                        column: x => x.tagId,
                        principalTable: "Tag",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserTimeEntryTag",
                columns: table => new
                {
                    userTimeEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    tagId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserTimeEntryTag", x => new { x.userTimeEntryId, x.tagId });
                    table.ForeignKey(
                        name: "FK_UserTimeEntryTag_Tag_tagId",
                        column: x => x.tagId,
                        principalTable: "Tag",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserTimeEntryTag_UserTimeEntry_userTimeEntryId",
                        column: x => x.userTimeEntryId,
                        principalTable: "UserTimeEntry",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Role",
                columns: new[] { "id", "code", "name" },
                values: new object[,]
                {
                    { new Guid("11111111-1111-4111-8111-111111111111"), "MEMBER", "Member" },
                    { new Guid("22222222-2222-4222-8222-222222222222"), "ADMIN", "Admin" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_CollectiveTimeEntry_departmentId",
                table: "CollectiveTimeEntry",
                column: "departmentId");

            migrationBuilder.CreateIndex(
                name: "IX_CollectiveTimeEntry_organizationId",
                table: "CollectiveTimeEntry",
                column: "organizationId");

            migrationBuilder.CreateIndex(
                name: "IX_CollectiveTimeEntry_recordedByUserId",
                table: "CollectiveTimeEntry",
                column: "recordedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CollectiveTimeEntryTag_tagId",
                table: "CollectiveTimeEntryTag",
                column: "tagId");

            migrationBuilder.CreateIndex(
                name: "IX_Department_organizationId_name",
                table: "Department",
                columns: new[] { "organizationId", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DepartmentMembership_departmentId",
                table: "DepartmentMembership",
                column: "departmentId");

            migrationBuilder.CreateIndex(
                name: "IX_DepartmentMembership_roleId",
                table: "DepartmentMembership",
                column: "roleId");

            migrationBuilder.CreateIndex(
                name: "IX_DepartmentMembership_userId_departmentId",
                table: "DepartmentMembership",
                columns: new[] { "userId", "departmentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationMembership_organizationId",
                table: "OrganizationMembership",
                column: "organizationId");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationMembership_roleId",
                table: "OrganizationMembership",
                column: "roleId");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationMembership_userId_organizationId",
                table: "OrganizationMembership",
                columns: new[] { "userId", "organizationId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshToken_tokenHash",
                table: "RefreshToken",
                column: "tokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshToken_userId",
                table: "RefreshToken",
                column: "userId");

            migrationBuilder.CreateIndex(
                name: "IX_Role_code",
                table: "Role",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tag_organizationId_name",
                table: "Tag",
                columns: new[] { "organizationId", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_User_email",
                table: "User",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_User_username",
                table: "User",
                column: "username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserProfile_userId",
                table: "UserProfile",
                column: "userId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserTimeEntry_departmentId",
                table: "UserTimeEntry",
                column: "departmentId");

            migrationBuilder.CreateIndex(
                name: "IX_UserTimeEntry_organizationId",
                table: "UserTimeEntry",
                column: "organizationId");

            migrationBuilder.CreateIndex(
                name: "IX_UserTimeEntry_userId",
                table: "UserTimeEntry",
                column: "userId");

            migrationBuilder.CreateIndex(
                name: "IX_UserTimeEntryTag_tagId",
                table: "UserTimeEntryTag",
                column: "tagId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CollectiveTimeEntryTag");

            migrationBuilder.DropTable(
                name: "DepartmentMembership");

            migrationBuilder.DropTable(
                name: "OrganizationMembership");

            migrationBuilder.DropTable(
                name: "RefreshToken");

            migrationBuilder.DropTable(
                name: "UserProfile");

            migrationBuilder.DropTable(
                name: "UserTimeEntryTag");

            migrationBuilder.DropTable(
                name: "CollectiveTimeEntry");

            migrationBuilder.DropTable(
                name: "Role");

            migrationBuilder.DropTable(
                name: "Tag");

            migrationBuilder.DropTable(
                name: "UserTimeEntry");

            migrationBuilder.DropTable(
                name: "Department");

            migrationBuilder.DropTable(
                name: "User");

            migrationBuilder.DropTable(
                name: "Organization");
        }
    }
}
