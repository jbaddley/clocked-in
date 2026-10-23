using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ProfileOrgAndMembershipDescriptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "avatarUrl",
                table: "UserProfile",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "description",
                table: "UserProfile",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "orgUserDescription",
                table: "OrganizationMembership",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "orgUserTitle",
                table: "OrganizationMembership",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "description",
                table: "Organization",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "websiteUrl",
                table: "Organization",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "avatarUrl",
                table: "UserProfile");

            migrationBuilder.DropColumn(
                name: "description",
                table: "UserProfile");

            migrationBuilder.DropColumn(
                name: "orgUserDescription",
                table: "OrganizationMembership");

            migrationBuilder.DropColumn(
                name: "orgUserTitle",
                table: "OrganizationMembership");

            migrationBuilder.DropColumn(
                name: "description",
                table: "Organization");

            migrationBuilder.DropColumn(
                name: "websiteUrl",
                table: "Organization");
        }
    }
}
