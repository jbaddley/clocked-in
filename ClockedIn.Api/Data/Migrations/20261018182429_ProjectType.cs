using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ProjectType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "Project_access_check",
                table: "Project");

            migrationBuilder.AddColumn<string>(
                name: "projectType",
                table: "Project",
                type: "text",
                nullable: false,
                defaultValue: "Project");

            migrationBuilder.AddCheckConstraint(
                name: "Project_access_check",
                table: "Project",
                sql: "\"projectType\" IN ('Project', 'Event')\r\nAND \"accessType\" IN ('Public', 'Private', 'Department')\r\nAND (\r\n  (\"accessType\" = 'Department' AND \"departmentId\" IS NOT NULL)\r\n  OR (\"accessType\" IN ('Public', 'Private') AND \"departmentId\" IS NULL)\r\n)\r\nAND (\r\n  \"startDate\" IS NULL\r\n  OR \"endDate\" IS NULL\r\n  OR \"endDate\" >= \"startDate\"\r\n)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "Project_access_check",
                table: "Project");

            migrationBuilder.DropColumn(
                name: "projectType",
                table: "Project");

            migrationBuilder.AddCheckConstraint(
                name: "Project_access_check",
                table: "Project",
                sql: "\"accessType\" IN ('Public', 'Private', 'Department')\r\nAND (\r\n  (\"accessType\" = 'Department' AND \"departmentId\" IS NOT NULL)\r\n  OR (\"accessType\" IN ('Public', 'Private') AND \"departmentId\" IS NULL)\r\n)\r\nAND (\r\n  \"startDate\" IS NULL\r\n  OR \"endDate\" IS NULL\r\n  OR \"endDate\" >= \"startDate\"\r\n)");
        }
    }
}
