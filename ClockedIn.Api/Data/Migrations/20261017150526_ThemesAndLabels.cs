using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ThemesAndLabels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "UserTimeEntry_mode_check",
                table: "UserTimeEntry");

            migrationBuilder.AddColumn<string>(
                name: "memberNumber",
                table: "UserProfile",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "accentImageUrl",
                table: "Organization",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "markUrl",
                table: "Organization",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "wordmarkUrl",
                table: "Organization",
                type: "text",
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE "Organization" AS organization
                SET
                  "wordmarkUrl" = brand."wordmarkUrl",
                  "markUrl" = brand."markUrl",
                  "accentImageUrl" = brand."accentImageUrl"
                FROM "OrganizationBrand" AS brand
                WHERE brand."organizationId" = organization.id;
                """);

            migrationBuilder.DropTable(
                name: "OrganizationBrand");

            migrationBuilder.AddColumn<Guid>(
                name: "themeId",
                table: "Organization",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("44444444-4444-4444-8444-444444444441"));

            migrationBuilder.CreateTable(
                name: "Theme",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: true),
                    primary = table.Column<string>(type: "text", nullable: false),
                    primaryForeground = table.Column<string>(type: "text", nullable: false),
                    highlight = table.Column<string>(type: "text", nullable: false),
                    accent = table.Column<string>(type: "text", nullable: false),
                    success = table.Column<string>(type: "text", nullable: false),
                    surface = table.Column<string>(type: "text", nullable: false),
                    surfaceForeground = table.Column<string>(type: "text", nullable: false),
                    foreground = table.Column<string>(type: "text", nullable: false),
                    headingFont = table.Column<string>(type: "text", nullable: false),
                    bodyFont = table.Column<string>(type: "text", nullable: false),
                    categoricalPalette = table.Column<string>(type: "text", nullable: false),
                    sequentialPalette = table.Column<string>(type: "text", nullable: false),
                    divergingPalette = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Theme", x => x.id);
                    table.CheckConstraint("Theme_token_check", "\"primary\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"primaryForeground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"highlight\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"accent\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"success\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"surface\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"surfaceForeground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"foreground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"headingFont\" IN ('SourceSans3', 'NunitoSans', 'Geist')\r\nAND \"bodyFont\" IN ('SourceSans3', 'NunitoSans', 'Geist')\r\nAND left(\"categoricalPalette\", 1) = '['\r\nAND left(\"sequentialPalette\", 1) = '['\r\nAND left(\"divergingPalette\", 1) = '['");
                    table.ForeignKey(
                        name: "FK_Theme_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Theme",
                columns: new[] { "id", "accent", "bodyFont", "categoricalPalette", "divergingPalette", "foreground", "headingFont", "highlight", "name", "organizationId", "primary", "primaryForeground", "sequentialPalette", "success", "surface", "surfaceForeground" },
                values: new object[,]
                {
                    { new Guid("44444444-4444-4444-8444-444444444441"), "#FF5E9F", "NunitoSans", "[\"#001836\",\"#D4AC59\",\"#2A6F97\",\"#4EBFAE\",\"#C17B4A\",\"#6B7C93\"]", "[\"#8B3A2A\",\"#C17B4A\",\"#E8C9A8\",\"#F7F4EE\",\"#A8C4D4\",\"#2A6F97\",\"#001836\"]", "#001836", "SourceSans3", "#D4AC59", "Clocked In", null, "#001836", "#FFFFFF", "[\"#F4F0E6\",\"#E8D7A8\",\"#D4AC59\",\"#8A6E2F\",\"#3D3014\"]", "#4EBFAE", "#FFFFFF", "#001836" },
                    { new Guid("44444444-4444-4444-8444-444444444442"), "#E9C46A", "NunitoSans", "[\"#1B3A4B\",\"#2A9D8F\",\"#E9C46A\",\"#3D5A80\",\"#8A9BA8\",\"#C17B4A\"]", "[\"#C17B4A\",\"#E0B089\",\"#F3E0C8\",\"#F7FBFC\",\"#A8D4E0\",\"#3D5A80\",\"#1B3A4B\"]", "#1B3A4B", "Geist", "#2A9D8F", "Harbor", null, "#1B3A4B", "#F4FAFB", "[\"#E6F4F2\",\"#A8D9D3\",\"#2A9D8F\",\"#1B6B61\",\"#0E3A35\"]", "#2A9D8F", "#F7FBFC", "#1B3A4B" },
                    { new Guid("44444444-4444-4444-8444-444444444443"), "#7A8F6A", "NunitoSans", "[\"#3D2B1F\",\"#C4784A\",\"#7A8F6A\",\"#8B6B4A\",\"#D4A574\",\"#5C6B7A\"]", "[\"#7A3B2E\",\"#C4784A\",\"#E8C4A0\",\"#FFF8F0\",\"#C5D1B8\",\"#7A8F6A\",\"#3D4A32\"]", "#3D2B1F", "SourceSans3", "#C4784A", "Atelier", null, "#3D2B1F", "#FFF8F0", "[\"#FFF1E4\",\"#E8C4A0\",\"#C4784A\",\"#8A4E2A\",\"#3D2B1F\"]", "#6B8F71", "#FFF8F0", "#3D2B1F" },
                    { new Guid("44444444-4444-4444-8444-444444444444"), "#D4A017", "SourceSans3", "[\"#1A2F23\",\"#5B8A6A\",\"#D4A017\",\"#3D5C6A\",\"#8A9B7A\",\"#C4784A\"]", "[\"#8B3A2A\",\"#C4784A\",\"#E8C9A8\",\"#F6F8F4\",\"#A8C4B0\",\"#3D7A54\",\"#1A2F23\"]", "#1A2F23", "Geist", "#5B8A6A", "Evergreen", null, "#1A2F23", "#F3F7F2", "[\"#E8F0EA\",\"#A8C4B0\",\"#5B8A6A\",\"#2F5A3E\",\"#1A2F23\"]", "#3D7A54", "#F6F8F4", "#1A2F23" },
                    { new Guid("44444444-4444-4444-8444-444444444445"), "#E8A838", "Geist", "[\"#2C2156\",\"#8B6FBF\",\"#E8A838\",\"#5A9E8F\",\"#C46B8A\",\"#4A6B8A\"]", "[\"#C46B8A\",\"#E0A8B8\",\"#F3D8E0\",\"#FBFAFE\",\"#C4B0E0\",\"#8B6FBF\",\"#2C2156\"]", "#2C2156", "NunitoSans", "#8B6FBF", "Orchid", null, "#2C2156", "#F8F5FF", "[\"#F0EAF8\",\"#C4B0E0\",\"#8B6FBF\",\"#5A3F8A\",\"#2C2156\"]", "#5A9E8F", "#FBFAFE", "#2C2156" },
                    { new Guid("44444444-4444-4444-8444-444444444446"), "#E69F00", "NunitoSans", "[\"#E69F00\",\"#56B4E9\",\"#009E73\",\"#F0E442\",\"#0072B2\",\"#D55E00\",\"#CC79A7\",\"#000000\"]", "[\"#D55E00\",\"#E69F00\",\"#F0E442\",\"#FFFFFF\",\"#56B4E9\",\"#0072B2\",\"#000000\"]", "#000000", "SourceSans3", "#0072B2", "Okabe-Ito", null, "#000000", "#FFFFFF", "[\"#E6F2F8\",\"#9ED0E8\",\"#56B4E9\",\"#0072B2\",\"#003D5C\"]", "#009E73", "#FFFFFF", "#000000" },
                    { new Guid("44444444-4444-4444-8444-444444444447"), "#DDCC77", "NunitoSans", "[\"#4477AA\",\"#EE6677\",\"#228833\",\"#CCBB44\",\"#66CCEE\",\"#AA3377\",\"#BBBBBB\"]", "[\"#EE6677\",\"#F4A8B0\",\"#FAD8DC\",\"#FFFFFF\",\"#A8D4E8\",\"#4477AA\",\"#332288\"]", "#332288", "Geist", "#117733", "Tol Bright", null, "#332288", "#FFFFFF", "[\"#E8F0F6\",\"#A8C4DC\",\"#4477AA\",\"#2A4F7A\",\"#1A3048\"]", "#44AA99", "#FFFFFF", "#332288" }
                });

            migrationBuilder.AddCheckConstraint(
                name: "UserTimeEntry_mode_check",
                table: "UserTimeEntry",
                sql: "(\r\n  (\"mode\" IN ('Punch', 'Duration') AND \"hourlyRate\" > 0)\r\n  OR (\"mode\" = 'Total' AND \"hourlyRate\" >= 0)\r\n)\r\nAND (\r\n  (\r\n    \"mode\" = 'Punch'\r\n    AND \"startedAt\" IS NOT NULL\r\n    AND (\r\n      (\r\n        \"endedAt\" IS NULL\r\n        AND \"durationMinutes\" IS NULL\r\n        AND \"inKindValue\" IS NULL\r\n      )\r\n      OR (\r\n        \"endedAt\" IS NOT NULL\r\n        AND \"endedAt\" > \"startedAt\"\r\n        AND \"durationMinutes\" BETWEEN 1 AND 1440\r\n        AND \"durationMinutes\" = FLOOR(EXTRACT(EPOCH FROM (\"endedAt\" - \"startedAt\")) / 60)::integer\r\n        AND \"inKindValue\" IS NOT NULL\r\n        AND \"inKindValue\" = ROUND((\"durationMinutes\"::numeric * \"hourlyRate\") / 60, 2)\r\n      )\r\n    )\r\n  )\r\n  OR (\r\n    \"mode\" = 'Duration'\r\n    AND \"durationMinutes\" BETWEEN 1 AND 1440\r\n    AND \"inKindValue\" IS NOT NULL\r\n    AND \"inKindValue\" = ROUND((\"durationMinutes\"::numeric * \"hourlyRate\") / 60, 2)\r\n    AND (\r\n      (\"startedAt\" IS NULL AND \"endedAt\" IS NULL)\r\n      OR (\r\n        \"startedAt\" IS NOT NULL\r\n        AND \"endedAt\" IS NOT NULL\r\n        AND \"endedAt\" > \"startedAt\"\r\n        AND \"durationMinutes\" = FLOOR(EXTRACT(EPOCH FROM (\"endedAt\" - \"startedAt\")) / 60)::integer\r\n      )\r\n    )\r\n  )\r\n  OR (\r\n    \"mode\" = 'Total'\r\n    AND \"durationMinutes\" BETWEEN 1 AND 59940\r\n    AND \"hourlyRate\" >= 0\r\n    AND \"inKindValue\" IS NOT NULL\r\n    AND \"inKindValue\" = ROUND((\"durationMinutes\"::numeric * \"hourlyRate\") / 60, 2)\r\n  )\r\n)");

            migrationBuilder.CreateIndex(
                name: "IX_Organization_themeId",
                table: "Organization",
                column: "themeId");

            migrationBuilder.CreateIndex(
                name: "Theme_global_name_key",
                table: "Theme",
                column: "name",
                unique: true,
                filter: "\"organizationId\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "Theme_organization_name_key",
                table: "Theme",
                columns: new[] { "organizationId", "name" },
                unique: true,
                filter: "\"organizationId\" IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_Organization_Theme_themeId",
                table: "Organization",
                column: "themeId",
                principalTable: "Theme",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Organization_Theme_themeId",
                table: "Organization");

            migrationBuilder.DropTable(
                name: "Theme");

            migrationBuilder.DropCheckConstraint(
                name: "UserTimeEntry_mode_check",
                table: "UserTimeEntry");

            migrationBuilder.DropIndex(
                name: "IX_Organization_themeId",
                table: "Organization");

            migrationBuilder.DropColumn(
                name: "memberNumber",
                table: "UserProfile");

            migrationBuilder.DropColumn(
                name: "accentImageUrl",
                table: "Organization");

            migrationBuilder.DropColumn(
                name: "markUrl",
                table: "Organization");

            migrationBuilder.DropColumn(
                name: "themeId",
                table: "Organization");

            migrationBuilder.DropColumn(
                name: "wordmarkUrl",
                table: "Organization");

            migrationBuilder.CreateTable(
                name: "OrganizationBrand",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    accent = table.Column<string>(type: "text", nullable: false),
                    accentImageUrl = table.Column<string>(type: "text", nullable: true),
                    bodyFont = table.Column<string>(type: "text", nullable: false),
                    foreground = table.Column<string>(type: "text", nullable: false),
                    headingFont = table.Column<string>(type: "text", nullable: false),
                    highlight = table.Column<string>(type: "text", nullable: false),
                    markUrl = table.Column<string>(type: "text", nullable: true),
                    primary = table.Column<string>(type: "text", nullable: false),
                    primaryForeground = table.Column<string>(type: "text", nullable: false),
                    success = table.Column<string>(type: "text", nullable: false),
                    surface = table.Column<string>(type: "text", nullable: false),
                    surfaceForeground = table.Column<string>(type: "text", nullable: false),
                    wordmarkUrl = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationBrand", x => x.id);
                    table.CheckConstraint("OrganizationBrand_token_check", "\"primary\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"primaryForeground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"highlight\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"accent\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"success\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"surface\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"surfaceForeground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"foreground\" ~ '^#[0-9A-Fa-f]{6}$'\r\nAND \"headingFont\" IN ('SourceSans3', 'NunitoSans', 'Geist')\r\nAND \"bodyFont\" IN ('SourceSans3', 'NunitoSans', 'Geist')");
                    table.ForeignKey(
                        name: "FK_OrganizationBrand_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "UserTimeEntry_mode_check",
                table: "UserTimeEntry",
                sql: "\"hourlyRate\" > 0\r\nAND (\r\n  (\r\n    \"mode\" = 'Punch'\r\n    AND \"startedAt\" IS NOT NULL\r\n    AND (\r\n      (\r\n        \"endedAt\" IS NULL\r\n        AND \"durationMinutes\" IS NULL\r\n        AND \"inKindValue\" IS NULL\r\n      )\r\n      OR (\r\n        \"endedAt\" IS NOT NULL\r\n        AND \"endedAt\" > \"startedAt\"\r\n        AND \"durationMinutes\" BETWEEN 1 AND 1440\r\n        AND \"durationMinutes\" = FLOOR(EXTRACT(EPOCH FROM (\"endedAt\" - \"startedAt\")) / 60)::integer\r\n        AND \"inKindValue\" IS NOT NULL\r\n        AND \"inKindValue\" = ROUND((\"durationMinutes\"::numeric * \"hourlyRate\") / 60, 2)\r\n      )\r\n    )\r\n  )\r\n  OR (\r\n    \"mode\" = 'Duration'\r\n    AND \"durationMinutes\" BETWEEN 1 AND 1440\r\n    AND \"inKindValue\" IS NOT NULL\r\n    AND \"inKindValue\" = ROUND((\"durationMinutes\"::numeric * \"hourlyRate\") / 60, 2)\r\n    AND (\r\n      (\"startedAt\" IS NULL AND \"endedAt\" IS NULL)\r\n      OR (\r\n        \"startedAt\" IS NOT NULL\r\n        AND \"endedAt\" IS NOT NULL\r\n        AND \"endedAt\" > \"startedAt\"\r\n        AND \"durationMinutes\" = FLOOR(EXTRACT(EPOCH FROM (\"endedAt\" - \"startedAt\")) / 60)::integer\r\n      )\r\n    )\r\n  )\r\n  OR (\r\n    \"mode\" = 'Total'\r\n    AND \"durationMinutes\" BETWEEN 1 AND 59940\r\n    AND \"startedAt\" IS NULL\r\n    AND \"endedAt\" IS NULL\r\n    AND \"inKindValue\" IS NOT NULL\r\n    AND \"inKindValue\" = ROUND((\"durationMinutes\"::numeric * \"hourlyRate\") / 60, 2)\r\n  )\r\n)");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationBrand_organizationId",
                table: "OrganizationBrand",
                column: "organizationId",
                unique: true);
        }
    }
}
