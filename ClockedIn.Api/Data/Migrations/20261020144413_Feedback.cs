using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class Feedback : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Feedback",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    userId = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: true),
                    type = table.Column<string>(type: "text", nullable: false),
                    priority = table.Column<string>(type: "text", nullable: false),
                    area = table.Column<string>(type: "text", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    screenshotUrls = table.Column<string>(type: "jsonb", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false, defaultValue: "Pending"),
                    createdAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Feedback", x => x.id);
                    table.CheckConstraint("Feedback_values_check", "\"type\" IN ('Bug', 'Feature')\r\nAND \"priority\" IN ('Urgent', 'High', 'Medium', 'Low')\r\nAND \"area\" IN ('Dashboard', 'LogTime', 'Entries', 'Reports', 'Settings', 'Other')\r\nAND \"status\" IN ('Pending', 'Acknowledged', 'Planned', 'InProgress', 'Resolved', 'Cancelled', 'CouldNotReproduce', 'Archived')\r\nAND char_length(\"title\") BETWEEN 1 AND 120\r\nAND char_length(\"description\") BETWEEN 1 AND 4000\r\nAND left(\"screenshotUrls\"::text, 1) = '['");
                    table.ForeignKey(
                        name: "FK_Feedback_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Feedback_User_userId",
                        column: x => x.userId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackAction",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    feedbackId = table.Column<Guid>(type: "uuid", nullable: false),
                    previousStatus = table.Column<string>(type: "text", nullable: false),
                    updatedStatus = table.Column<string>(type: "text", nullable: false),
                    updatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    takenByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ticketUrl = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackAction", x => x.id);
                    table.CheckConstraint("FeedbackAction_values_check", "\"previousStatus\" IN ('Pending', 'Acknowledged', 'Planned', 'InProgress', 'Resolved', 'Cancelled', 'CouldNotReproduce', 'Archived')\r\nAND \"updatedStatus\" IN ('Pending', 'Acknowledged', 'Planned', 'InProgress', 'Resolved', 'Cancelled', 'CouldNotReproduce', 'Archived')\r\nAND char_length(\"description\") BETWEEN 1 AND 2000");
                    table.ForeignKey(
                        name: "FK_FeedbackAction_Feedback_feedbackId",
                        column: x => x.feedbackId,
                        principalTable: "Feedback",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FeedbackAction_User_takenByUserId",
                        column: x => x.takenByUserId,
                        principalTable: "User",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Feedback_createdAt",
                table: "Feedback",
                column: "createdAt");

            migrationBuilder.CreateIndex(
                name: "IX_Feedback_organizationId",
                table: "Feedback",
                column: "organizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Feedback_status",
                table: "Feedback",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_Feedback_userId",
                table: "Feedback",
                column: "userId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackAction_feedbackId",
                table: "FeedbackAction",
                column: "feedbackId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackAction_takenByUserId",
                table: "FeedbackAction",
                column: "takenByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FeedbackAction");

            migrationBuilder.DropTable(
                name: "Feedback");
        }
    }
}
