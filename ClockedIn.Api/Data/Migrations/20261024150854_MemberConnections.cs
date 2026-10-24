using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class MemberConnections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MemberConnection",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    userAId = table.Column<Guid>(type: "uuid", nullable: false),
                    userBId = table.Column<Guid>(type: "uuid", nullable: false),
                    relationship = table.Column<string>(type: "text", nullable: false),
                    createdByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    createdAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MemberConnection", x => x.id);
                    table.CheckConstraint("MemberConnection_pair_check", "\"userAId\" <> \"userBId\"\r\nAND \"userAId\"::text < \"userBId\"::text\r\nAND \"relationship\" IN (\r\n  'Parent', 'Child', 'Spouse', 'Sibling', 'Grandparent', 'Grandchild',\r\n  'Guardian', 'Dependent', 'Friend', 'Colleague', 'Associate'\r\n)");
                    table.ForeignKey(
                        name: "FK_MemberConnection_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MemberConnection_User_createdByUserId",
                        column: x => x.createdByUserId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MemberConnection_User_userAId",
                        column: x => x.userAId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MemberConnection_User_userBId",
                        column: x => x.userBId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MemberConnection_createdByUserId",
                table: "MemberConnection",
                column: "createdByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_MemberConnection_userAId",
                table: "MemberConnection",
                column: "userAId");

            migrationBuilder.CreateIndex(
                name: "IX_MemberConnection_userBId",
                table: "MemberConnection",
                column: "userBId");

            migrationBuilder.CreateIndex(
                name: "MemberConnection_pair_key",
                table: "MemberConnection",
                columns: new[] { "organizationId", "userAId", "userBId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MemberConnection");
        }
    }
}
