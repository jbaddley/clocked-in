using ClockedIn.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    [DbContext(typeof(ClockedInDbContext))]
    [Migration("20261028010000_ReportDashboard")]
    public partial class ReportDashboard : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "isDashboard" boolean NOT NULL DEFAULT false;
                CREATE UNIQUE INDEX IF NOT EXISTS "Report_one_dashboard" ON "Report" ("organizationId") WHERE "isDashboard" = TRUE;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP INDEX IF EXISTS "Report_one_dashboard";
                ALTER TABLE "Report" DROP COLUMN IF EXISTS "isDashboard";
                """);
        }
    }
}
