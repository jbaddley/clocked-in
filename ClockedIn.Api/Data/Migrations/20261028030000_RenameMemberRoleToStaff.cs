using ClockedIn.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    [DbContext(typeof(ClockedInDbContext))]
    [Migration("20261028030000_RenameMemberRoleToStaff")]
    public partial class RenameMemberRoleToStaff : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "Role"
                SET "name" = 'Staff'
                WHERE "id" = '11111111-1111-4111-8111-111111111111' AND "code" = 'MEMBER';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE "Role"
                SET "name" = 'Member'
                WHERE "id" = '11111111-1111-4111-8111-111111111111' AND "code" = 'MEMBER';
                """);
        }
    }
}
