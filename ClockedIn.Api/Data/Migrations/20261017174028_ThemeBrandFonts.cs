using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ThemeBrandFonts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "Theme_token_check",
                table: "Theme");

            migrationBuilder.AddCheckConstraint(
                name: "Theme_token_check",
                table: "Theme",
                sql: "\"primary\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"primaryForeground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"highlight\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"accent\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"success\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"surface\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"surfaceForeground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"foreground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"headingFont\" IN ('HelveticaNeue', 'AvenirNext', 'SourceSans3', 'NunitoSans', 'Geist')\r\nAND \"bodyFont\" IN ('HelveticaNeue', 'AvenirNext', 'SourceSans3', 'NunitoSans', 'Geist')\r\nAND left(\"categoricalPalette\", 1) = '['\r\nAND left(\"sequentialPalette\", 1) = '['\r\nAND left(\"divergingPalette\", 1) = '['");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "Theme_token_check",
                table: "Theme");

            migrationBuilder.AddCheckConstraint(
                name: "Theme_token_check",
                table: "Theme",
                sql: "\"primary\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"primaryForeground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"highlight\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"accent\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"success\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"surface\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"surfaceForeground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"foreground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"headingFont\" IN ('SourceSans3', 'NunitoSans', 'Geist')\r\nAND \"bodyFont\" IN ('SourceSans3', 'NunitoSans', 'Geist')\r\nAND left(\"categoricalPalette\", 1) = '['\r\nAND left(\"sequentialPalette\", 1) = '['\r\nAND left(\"divergingPalette\", 1) = '['");
        }
    }
}
