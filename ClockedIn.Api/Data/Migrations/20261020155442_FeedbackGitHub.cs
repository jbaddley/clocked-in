using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class FeedbackGitHub : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "Feedback_values_check",
                table: "Feedback");

            migrationBuilder.AddColumn<int>(
                name: "githubIssueNumber",
                table: "Feedback",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ticketUrl",
                table: "Feedback",
                type: "text",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "Feedback_values_check",
                table: "Feedback",
                sql: "\"type\" IN ('Bug', 'Feature')\r\nAND \"priority\" IN ('Urgent', 'High', 'Medium', 'Low')\r\nAND \"area\" IN ('Dashboard', 'LogTime', 'Entries', 'Reports', 'Settings', 'Other')\r\nAND \"status\" IN ('Pending', 'Acknowledged', 'Planned', 'InProgress', 'Resolved', 'Cancelled', 'CouldNotReproduce', 'Archived')\r\nAND char_length(\"title\") BETWEEN 1 AND 120\r\nAND char_length(\"description\") BETWEEN 1 AND 4000\r\nAND left(\"screenshotUrls\"::text, 1) = '['\r\nAND (\"githubIssueNumber\" IS NULL OR \"githubIssueNumber\" > 0)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "Feedback_values_check",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "githubIssueNumber",
                table: "Feedback");

            migrationBuilder.DropColumn(
                name: "ticketUrl",
                table: "Feedback");

            migrationBuilder.AddCheckConstraint(
                name: "Feedback_values_check",
                table: "Feedback",
                sql: "\"type\" IN ('Bug', 'Feature')\r\nAND \"priority\" IN ('Urgent', 'High', 'Medium', 'Low')\r\nAND \"area\" IN ('Dashboard', 'LogTime', 'Entries', 'Reports', 'Settings', 'Other')\r\nAND \"status\" IN ('Pending', 'Acknowledged', 'Planned', 'InProgress', 'Resolved', 'Cancelled', 'CouldNotReproduce', 'Archived')\r\nAND char_length(\"title\") BETWEEN 1 AND 120\r\nAND char_length(\"description\") BETWEEN 1 AND 4000\r\nAND left(\"screenshotUrls\"::text, 1) = '['");
        }
    }
}
