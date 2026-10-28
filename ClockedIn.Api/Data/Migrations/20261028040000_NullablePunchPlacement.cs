using ClockedIn.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    [DbContext(typeof(ClockedInDbContext))]
    [Migration("20261028040000_NullablePunchPlacement")]
    public partial class NullablePunchPlacement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "UserTimeEntry" ALTER COLUMN "projectId" DROP NOT NULL;
                ALTER TABLE "UserTimeEntry" ALTER COLUMN "projectId" DROP DEFAULT;
                ALTER TABLE "UserTimeEntry" ALTER COLUMN "taskCategoryId" DROP NOT NULL;
                ALTER TABLE "UserTimeEntry" ALTER COLUMN "taskCategoryId" DROP DEFAULT;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "UserTimeEntry" ALTER COLUMN "projectId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
                ALTER TABLE "UserTimeEntry" ALTER COLUMN "projectId" SET NOT NULL;
                ALTER TABLE "UserTimeEntry" ALTER COLUMN "taskCategoryId" SET DEFAULT '00000000-0000-0000-0000-000000000000';
                ALTER TABLE "UserTimeEntry" ALTER COLUMN "taskCategoryId" SET NOT NULL;
                """);
        }
    }
}
