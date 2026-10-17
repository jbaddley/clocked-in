using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InvitationsAndSuperAdmin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "isSuperAdmin",
                table: "User",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "Invitation",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "text", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    departmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    roleId = table.Column<Guid>(type: "uuid", nullable: false),
                    codeHash = table.Column<string>(type: "text", nullable: false),
                    invitedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    expiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    acceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    revokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    createdAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Invitation", x => x.id);
                    table.CheckConstraint("Invitation_lowercase_email_check", "\"email\" = lower(\"email\")");
                    table.ForeignKey(
                        name: "FK_Invitation_Department_departmentId",
                        column: x => x.departmentId,
                        principalTable: "Department",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Invitation_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Invitation_Role_roleId",
                        column: x => x.roleId,
                        principalTable: "Role",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Invitation_User_invitedByUserId",
                        column: x => x.invitedByUserId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PasswordResetCode",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    userId = table.Column<Guid>(type: "uuid", nullable: false),
                    codeHash = table.Column<string>(type: "text", nullable: false),
                    expiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    usedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    createdAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordResetCode", x => x.id);
                    table.ForeignKey(
                        name: "FK_PasswordResetCode_User_userId",
                        column: x => x.userId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "Invitation_pending_department_key",
                table: "Invitation",
                columns: new[] { "email", "departmentId" },
                unique: true,
                filter: "\"departmentId\" IS NOT NULL AND \"acceptedAt\" IS NULL AND \"revokedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "Invitation_pending_org_key",
                table: "Invitation",
                columns: new[] { "email", "organizationId" },
                unique: true,
                filter: "\"departmentId\" IS NULL AND \"acceptedAt\" IS NULL AND \"revokedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Invitation_codeHash",
                table: "Invitation",
                column: "codeHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invitation_departmentId",
                table: "Invitation",
                column: "departmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Invitation_email",
                table: "Invitation",
                column: "email");

            migrationBuilder.CreateIndex(
                name: "IX_Invitation_invitedByUserId",
                table: "Invitation",
                column: "invitedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Invitation_organizationId",
                table: "Invitation",
                column: "organizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Invitation_roleId",
                table: "Invitation",
                column: "roleId");

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetCode_codeHash",
                table: "PasswordResetCode",
                column: "codeHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetCode_userId",
                table: "PasswordResetCode",
                column: "userId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Invitation");

            migrationBuilder.DropTable(
                name: "PasswordResetCode");

            migrationBuilder.DropColumn(
                name: "isSuperAdmin",
                table: "User");
        }
    }
}
