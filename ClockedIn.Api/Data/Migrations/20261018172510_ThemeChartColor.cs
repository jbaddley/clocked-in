using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ThemeChartColor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "Theme_token_check",
                table: "Theme");

            migrationBuilder.AddColumn<string>(
                name: "chartColor",
                table: "Theme",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("""UPDATE "Theme" SET "chartColor" = "primary";""");

            migrationBuilder.UpdateData(
                table: "Theme",
                keyColumn: "id",
                keyValue: new Guid("44444444-4444-4444-8444-444444444441"),
                column: "chartColor",
                value: "#001836");

            migrationBuilder.UpdateData(
                table: "Theme",
                keyColumn: "id",
                keyValue: new Guid("44444444-4444-4444-8444-444444444442"),
                column: "chartColor",
                value: "#1B3A4B");

            migrationBuilder.UpdateData(
                table: "Theme",
                keyColumn: "id",
                keyValue: new Guid("44444444-4444-4444-8444-444444444443"),
                column: "chartColor",
                value: "#3D2B1F");

            migrationBuilder.UpdateData(
                table: "Theme",
                keyColumn: "id",
                keyValue: new Guid("44444444-4444-4444-8444-444444444444"),
                column: "chartColor",
                value: "#1A2F23");

            migrationBuilder.UpdateData(
                table: "Theme",
                keyColumn: "id",
                keyValue: new Guid("44444444-4444-4444-8444-444444444445"),
                column: "chartColor",
                value: "#2C2156");

            migrationBuilder.UpdateData(
                table: "Theme",
                keyColumn: "id",
                keyValue: new Guid("44444444-4444-4444-8444-444444444446"),
                column: "chartColor",
                value: "#000000");

            migrationBuilder.UpdateData(
                table: "Theme",
                keyColumn: "id",
                keyValue: new Guid("44444444-4444-4444-8444-444444444447"),
                column: "chartColor",
                value: "#332288");

            migrationBuilder.AlterColumn<string>(
                name: "chartColor",
                table: "Theme",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: false,
                oldDefaultValue: "");

            migrationBuilder.AddCheckConstraint(
                name: "Theme_token_check",
                table: "Theme",
                sql: "\"primary\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"primaryForeground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"highlight\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"accent\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"success\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"surface\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"surfaceForeground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"foreground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"chartColor\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"headingFont\" IN ('HelveticaNeue', 'AvenirNext', 'SourceSans3', 'NunitoSans', 'Geist')\r\nAND \"bodyFont\" IN ('HelveticaNeue', 'AvenirNext', 'SourceSans3', 'NunitoSans', 'Geist')\r\nAND left(\"categoricalPalette\", 1) = '['\r\nAND left(\"sequentialPalette\", 1) = '['\r\nAND left(\"divergingPalette\", 1) = '['");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "Theme_token_check",
                table: "Theme");

            migrationBuilder.DropColumn(
                name: "chartColor",
                table: "Theme");

            migrationBuilder.AddCheckConstraint(
                name: "Theme_token_check",
                table: "Theme",
                sql: "\"primary\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"primaryForeground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"highlight\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"accent\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"success\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"surface\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"surfaceForeground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"foreground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"headingFont\" IN ('HelveticaNeue', 'AvenirNext', 'SourceSans3', 'NunitoSans', 'Geist')\r\nAND \"bodyFont\" IN ('HelveticaNeue', 'AvenirNext', 'SourceSans3', 'NunitoSans', 'Geist')\r\nAND left(\"categoricalPalette\", 1) = '['\r\nAND left(\"sequentialPalette\", 1) = '['\r\nAND left(\"divergingPalette\", 1) = '['");
        }
    }
}
