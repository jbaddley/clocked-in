using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class HourlyRates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "Organization_rate_check",
                table: "Organization");

            migrationBuilder.CreateTable(
                name: "HourlyRate",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "citext", nullable: false),
                    perHourRate = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    isDefault = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    isArchived = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HourlyRate", x => x.id);
                    table.CheckConstraint("HourlyRate_rate_check", "\"type\" IN ('Volunteer', 'Professional')\r\nAND \"perHourRate\" > 0\r\nAND (\r\n  (\"isDefault\" = FALSE)\r\n  OR (\"type\" = 'Volunteer')\r\n)");
                    table.ForeignKey(
                        name: "FK_HourlyRate_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql(
                """
                INSERT INTO "HourlyRate" ("id", "organizationId", "type", "name", "perHourRate", "isDefault", "isArchived")
                SELECT gen_random_uuid(), "id", 'Volunteer', 'Volunteer', "volunteerHourlyRate", TRUE, FALSE
                FROM "Organization";
                """);

            migrationBuilder.DropColumn(
                name: "volunteerHourlyRate",
                table: "Organization");

            migrationBuilder.AddColumn<Guid>(
                name: "hourlyRateId",
                table: "UserTimeEntry",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "hourlyRateId",
                table: "CollectiveTimeEntry",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserTimeEntry_hourlyRateId",
                table: "UserTimeEntry",
                column: "hourlyRateId");

            migrationBuilder.AddCheckConstraint(
                name: "Organization_rate_check",
                table: "Organization",
                sql: "\"defaultRateType\" IN ('Volunteer', 'Professional')");

            migrationBuilder.CreateIndex(
                name: "IX_CollectiveTimeEntry_hourlyRateId",
                table: "CollectiveTimeEntry",
                column: "hourlyRateId");

            migrationBuilder.CreateIndex(
                name: "HourlyRate_default_volunteer_key",
                table: "HourlyRate",
                column: "organizationId",
                unique: true,
                filter: "\"isDefault\" = TRUE AND \"type\" = 'Volunteer'");

            migrationBuilder.CreateIndex(
                name: "IX_HourlyRate_organizationId_name",
                table: "HourlyRate",
                columns: new[] { "organizationId", "name" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_CollectiveTimeEntry_HourlyRate_hourlyRateId",
                table: "CollectiveTimeEntry",
                column: "hourlyRateId",
                principalTable: "HourlyRate",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UserTimeEntry_HourlyRate_hourlyRateId",
                table: "UserTimeEntry",
                column: "hourlyRateId",
                principalTable: "HourlyRate",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.Sql(
                """
                UPDATE "UserTimeEntry" AS entry
                SET "hourlyRateId" = rate.id
                FROM "HourlyRate" AS rate
                WHERE rate."organizationId" = entry."organizationId" AND rate."isDefault" = TRUE;

                UPDATE "CollectiveTimeEntry" AS entry
                SET "hourlyRateId" = rate.id
                FROM "HourlyRate" AS rate
                WHERE rate."organizationId" = entry."organizationId" AND rate."isDefault" = TRUE;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CollectiveTimeEntry_HourlyRate_hourlyRateId",
                table: "CollectiveTimeEntry");

            migrationBuilder.DropForeignKey(
                name: "FK_UserTimeEntry_HourlyRate_hourlyRateId",
                table: "UserTimeEntry");

            migrationBuilder.DropTable(
                name: "HourlyRate");

            migrationBuilder.DropIndex(
                name: "IX_UserTimeEntry_hourlyRateId",
                table: "UserTimeEntry");

            migrationBuilder.DropCheckConstraint(
                name: "Organization_rate_check",
                table: "Organization");

            migrationBuilder.DropIndex(
                name: "IX_CollectiveTimeEntry_hourlyRateId",
                table: "CollectiveTimeEntry");

            migrationBuilder.DropColumn(
                name: "hourlyRateId",
                table: "UserTimeEntry");

            migrationBuilder.DropColumn(
                name: "hourlyRateId",
                table: "CollectiveTimeEntry");

            migrationBuilder.AddColumn<decimal>(
                name: "volunteerHourlyRate",
                table: "Organization",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 35.47m);

            migrationBuilder.AddCheckConstraint(
                name: "Organization_rate_check",
                table: "Organization",
                sql: "\"volunteerHourlyRate\" > 0 AND \"defaultRateType\" IN ('Volunteer', 'Professional')");
        }
    }
}
