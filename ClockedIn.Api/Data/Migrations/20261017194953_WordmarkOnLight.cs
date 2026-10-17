using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class WordmarkOnLight : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "wordmarkOnLightUrl",
                table: "Organization",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "wordmarkOnLightUrl",
                table: "Organization");
        }
    }
}
