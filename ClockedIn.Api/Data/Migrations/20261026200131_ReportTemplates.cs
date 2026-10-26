using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ReportTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ReportTemplate",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    organizationId = table.Column<Guid>(type: "uuid", nullable: true),
                    key = table.Column<string>(type: "text", nullable: true),
                    name = table.Column<string>(type: "citext", nullable: false),
                    layout = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{\"version\":1,\"cards\":[]}'::jsonb"),
                    baseTemplateId = table.Column<Guid>(type: "uuid", nullable: true),
                    createdAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReportTemplate", x => x.id);
                    table.CheckConstraint("ReportTemplate_shape_check", "char_length(btrim(\"name\"::text)) BETWEEN 1 AND 80\r\nAND (\r\n  (\"organizationId\" IS NULL AND \"baseTemplateId\" IS NULL AND \"key\" IN ('summary', 'people', 'groups', 'staff'))\r\n  OR (\"organizationId\" IS NOT NULL AND \"key\" IS NULL AND \"baseTemplateId\" IS NULL)\r\n  OR (\"organizationId\" IS NOT NULL AND \"key\" IS NULL AND \"baseTemplateId\" IS NOT NULL)\r\n)");
                    table.ForeignKey(
                        name: "FK_ReportTemplate_Organization_organizationId",
                        column: x => x.organizationId,
                        principalTable: "Organization",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ReportTemplate_ReportTemplate_baseTemplateId",
                        column: x => x.baseTemplateId,
                        principalTable: "ReportTemplate",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReportTemplate_baseTemplateId",
                table: "ReportTemplate",
                column: "baseTemplateId");

            migrationBuilder.CreateIndex(
                name: "ReportTemplate_global_key",
                table: "ReportTemplate",
                column: "key",
                unique: true,
                filter: "\"organizationId\" IS NULL AND \"key\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ReportTemplate_global_name",
                table: "ReportTemplate",
                column: "name",
                unique: true,
                filter: "\"organizationId\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "ReportTemplate_org_name",
                table: "ReportTemplate",
                columns: new[] { "organizationId", "name" },
                unique: true,
                filter: "\"organizationId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ReportTemplate_override",
                table: "ReportTemplate",
                columns: new[] { "organizationId", "baseTemplateId" },
                unique: true,
                filter: "\"baseTemplateId\" IS NOT NULL");

            migrationBuilder.Sql("""
                INSERT INTO "ReportTemplate" ("id", "key", "name", "layout")
                VALUES ('11111111-1111-4111-8111-111111111101'::uuid, 'summary', 'Summary', $json${"version":1,"cards":[{"id":"00000000-0000-4000-8000-000000000001","kind":"value","column":1,"row":1,"columns":3,"rows":1,"description":"","pattern":"0,0.[00]","title":"Total volunteer hours","accessor":"user.hours","color":"primary","format":"hours","icon":"clock"},{"id":"00000000-0000-4000-8000-000000000002","kind":"value","column":4,"row":1,"columns":3,"rows":1,"description":"","pattern":"$0,0.00","title":"In-kind value","accessor":"user.inKind","color":"success","format":"currency","icon":"hand-coins"},{"id":"00000000-0000-4000-8000-000000000003","kind":"value","column":7,"row":1,"columns":3,"rows":1,"description":"","pattern":"0,0.[00]","title":"Volunteers","accessor":"user.volunteers","color":"highlight","format":"number","icon":"users"},{"id":"00000000-0000-4000-8000-000000000004","kind":"value","column":10,"row":1,"columns":3,"rows":1,"description":"","pattern":"0,0.[00]","title":"Entries","accessor":"user.entries","color":"accent","format":"number","icon":"list-checks"},{"id":"00000000-0000-4000-8000-000000000005","kind":"chart","description":"","palette":"single","pattern":"0,0.[00]","column":1,"row":2,"columns":6,"rows":4,"title":"Hours by department","accessor":"user.byDepartment","chartType":"column","valueKey":"hours","format":"hours"},{"id":"00000000-0000-4000-8000-000000000006","kind":"chart","description":"","palette":"single","pattern":"0,0.[00]","column":7,"row":2,"columns":6,"rows":4,"title":"Hours by task category","accessor":"user.byCategory","chartType":"column","valueKey":"hours","format":"hours"},{"id":"00000000-0000-4000-8000-000000000007","kind":"chart","description":"","palette":"single","pattern":"$0,0.00","column":1,"row":6,"columns":6,"rows":4,"title":"In-kind by month","accessor":"user.byMonth","chartType":"column","valueKey":"inKind","format":"currency"},{"id":"00000000-0000-4000-8000-000000000008","kind":"chart","description":"","palette":"single","pattern":"0,0.[00]","column":7,"row":6,"columns":6,"rows":4,"title":"Hours by volunteer","accessor":"user.byVolunteer","chartType":"bar","valueKey":"hours","format":"hours"},{"id":"00000000-0000-4000-8000-000000000009","kind":"chart","description":"","palette":"single","pattern":"0,0.[00]","column":1,"row":10,"columns":6,"rows":4,"title":"Hours by month","accessor":"user.byMonth","chartType":"column","valueKey":"hours","format":"hours"},{"id":"00000000-0000-4000-8000-00000000000a","kind":"chart","description":"","palette":"single","pattern":"0,0.[00]","column":7,"row":10,"columns":6,"rows":4,"title":"Hours by project","accessor":"user.byProject","chartType":"bar","valueKey":"hours","format":"hours"}]}$json$::jsonb);
                """);

            migrationBuilder.Sql("""
                INSERT INTO "ReportTemplate" ("id", "key", "name", "layout")
                VALUES ('11111111-1111-4111-8111-111111111102'::uuid, 'people', 'People', $json${"version":1,"cards":[{"id":"00000000-0000-4000-8000-000000000014","kind":"value","column":1,"row":1,"columns":3,"rows":1,"description":"","pattern":"0,0.[00]","title":"Total volunteer hours","accessor":"user.hours","color":"primary","format":"hours","icon":"clock"},{"id":"00000000-0000-4000-8000-000000000015","kind":"value","column":4,"row":1,"columns":3,"rows":1,"description":"","pattern":"$0,0.00","title":"In-kind value","accessor":"user.inKind","color":"success","format":"currency","icon":"hand-coins"},{"id":"00000000-0000-4000-8000-000000000016","kind":"value","column":7,"row":1,"columns":3,"rows":1,"description":"","pattern":"0,0.[00]","title":"Volunteers","accessor":"user.volunteers","color":"highlight","format":"number","icon":"users"},{"id":"00000000-0000-4000-8000-000000000017","kind":"value","column":10,"row":1,"columns":3,"rows":1,"description":"","pattern":"0,0.[00]","title":"Entries","accessor":"user.entries","color":"accent","format":"number","icon":"list-checks"},{"id":"00000000-0000-4000-8000-000000000018","kind":"list","description":"","format":"hours","pattern":"0,0.[00]","column":1,"row":2,"columns":6,"rows":5,"title":"By project","accessor":"user.byProject","visibleColumns":["name","type","hours","share","people","inKind"]},{"id":"00000000-0000-4000-8000-000000000019","kind":"list","description":"","format":"hours","pattern":"0,0.[00]","column":7,"row":2,"columns":6,"rows":5,"title":"By person","accessor":"user.byPerson","visibleColumns":["name","hours","share","inKind"]},{"id":"00000000-0000-4000-8000-00000000001a","kind":"list","description":"","format":"hours","pattern":"0,0.[00]","column":1,"row":7,"columns":6,"rows":5,"title":"By department","accessor":"user.byDepartment","visibleColumns":["name","hours","share","people","inKind"]},{"id":"00000000-0000-4000-8000-00000000001b","kind":"list","description":"","format":"hours","pattern":"0,0.[00]","column":7,"row":7,"columns":6,"rows":5,"title":"By task category","accessor":"user.byCategory","visibleColumns":["name","hours","share","people","inKind"]}]}$json$::jsonb);
                """);

            migrationBuilder.Sql("""
                INSERT INTO "ReportTemplate" ("id", "key", "name", "layout")
                VALUES ('11111111-1111-4111-8111-111111111103'::uuid, 'groups', 'Group sessions', $json${"version":1,"cards":[{"id":"00000000-0000-4000-8000-00000000001e","kind":"value","column":1,"row":1,"columns":4,"rows":1,"description":"","pattern":"0,0.[00]","title":"Hours","accessor":"collective.hours","color":"primary","format":"hours","icon":"clock"},{"id":"00000000-0000-4000-8000-00000000001f","kind":"value","column":5,"row":1,"columns":4,"rows":1,"description":"","pattern":"$0,0.00","title":"In-kind value","accessor":"collective.inKind","color":"success","format":"currency","icon":"hand-coins"},{"id":"00000000-0000-4000-8000-000000000020","kind":"value","column":9,"row":1,"columns":4,"rows":1,"description":"","pattern":"0,0.[00]","title":"Sessions","accessor":"collective.entries","color":"accent","format":"number","icon":"list-checks"},{"id":"00000000-0000-4000-8000-000000000021","kind":"list","description":"","format":"hours","pattern":"0,0.[00]","column":1,"row":2,"columns":6,"rows":5,"title":"By project","accessor":"collective.byProject","visibleColumns":["name","type","hours","share","inKind"]},{"id":"00000000-0000-4000-8000-000000000022","kind":"list","description":"","format":"hours","pattern":"0,0.[00]","column":7,"row":2,"columns":6,"rows":5,"title":"By department","accessor":"collective.byDepartment","visibleColumns":["name","hours","share","inKind"]},{"id":"00000000-0000-4000-8000-000000000023","kind":"list","description":"","format":"hours","pattern":"0,0.[00]","column":1,"row":7,"columns":6,"rows":5,"title":"By task category","accessor":"collective.byCategory","visibleColumns":["name","hours","share","inKind"]}]}$json$::jsonb);
                """);

            migrationBuilder.Sql("""
                INSERT INTO "ReportTemplate" ("id", "key", "name", "layout")
                VALUES ('11111111-1111-4111-8111-111111111104'::uuid, 'staff', 'Staff', $json${"version":1,"cards":[{"id":"00000000-0000-4000-8000-000000000028","kind":"value","column":1,"row":1,"columns":3,"rows":1,"description":"","pattern":"0,0.[00]","title":"Staff hours","accessor":"staff.hours","color":"primary","format":"hours","icon":"clock"},{"id":"00000000-0000-4000-8000-000000000029","kind":"value","column":4,"row":1,"columns":3,"rows":1,"description":"","pattern":"$0,0.00","title":"In-kind value","accessor":"staff.inKind","color":"success","format":"currency","icon":"hand-coins"},{"id":"00000000-0000-4000-8000-00000000002a","kind":"value","column":7,"row":1,"columns":3,"rows":1,"description":"","pattern":"0,0.[00]","title":"Staff","accessor":"staff.volunteers","color":"highlight","format":"number","icon":"users"},{"id":"00000000-0000-4000-8000-00000000002b","kind":"value","column":10,"row":1,"columns":3,"rows":1,"description":"","pattern":"0,0.[00]","title":"Entries","accessor":"staff.entries","color":"accent","format":"number","icon":"list-checks"},{"id":"00000000-0000-4000-8000-00000000002c","kind":"list","description":"","format":"hours","pattern":"0,0.[00]","column":1,"row":2,"columns":6,"rows":5,"title":"By department","accessor":"staff.byDepartment","visibleColumns":["name","hours","share","inKind"]},{"id":"00000000-0000-4000-8000-00000000002d","kind":"list","description":"","format":"hours","pattern":"0,0.[00]","column":7,"row":2,"columns":6,"rows":5,"title":"By project","accessor":"staff.byProject","visibleColumns":["name","type","hours","share","inKind"]},{"id":"00000000-0000-4000-8000-00000000002e","kind":"list","description":"","format":"hours","pattern":"0,0.[00]","column":1,"row":7,"columns":6,"rows":5,"title":"By person","accessor":"staff.byPerson","visibleColumns":["name","hours","share","inKind"]}]}$json$::jsonb);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReportTemplate");
        }
    }
}
