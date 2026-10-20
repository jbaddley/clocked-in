using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class HourlyRateSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "HourlyRate_rate_check",
                table: "HourlyRate");

            migrationBuilder.AddColumn<string>(
                name: "source",
                table: "HourlyRate",
                type: "text",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "HourlyRate_rate_check",
                table: "HourlyRate",
                sql: "\"type\" IN ('Volunteer', 'Professional')\r\nAND \"perHourRate\" > 0\r\nAND (\r\n  (\"isDefault\" = FALSE)\r\n  OR (\"type\" = 'Volunteer')\r\n)\r\nAND (\"source\" IS NULL OR char_length(\"source\") BETWEEN 1 AND 200)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "HourlyRate_rate_check",
                table: "HourlyRate");

            migrationBuilder.DropColumn(
                name: "source",
                table: "HourlyRate");

            migrationBuilder.AddCheckConstraint(
                name: "HourlyRate_rate_check",
                table: "HourlyRate",
                sql: "\"type\" IN ('Volunteer', 'Professional')\r\nAND \"perHourRate\" > 0\r\nAND (\r\n  (\"isDefault\" = FALSE)\r\n  OR (\"type\" = 'Volunteer')\r\n)");
        }
    }
}
