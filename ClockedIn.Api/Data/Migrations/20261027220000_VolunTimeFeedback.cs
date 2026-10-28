using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClockedIn.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class VolunTimeFeedback : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "organizationId" uuid;
                ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "isSystem" boolean NOT NULL DEFAULT false;
                ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "scope" text NOT NULL DEFAULT 'organization';
                UPDATE "Role" SET "isSystem" = true, "scope" = CASE WHEN "code" = 'VOLUNTEER' THEN 'self' ELSE 'organization' END
                WHERE "organizationId" IS NULL;
                ALTER TABLE "Role" DROP CONSTRAINT IF EXISTS "IX_Role_code";
                DROP INDEX IF EXISTS "IX_Role_code";
                CREATE UNIQUE INDEX IF NOT EXISTS "Role_system_code_key" ON "Role" ("code") WHERE "organizationId" IS NULL;
                CREATE UNIQUE INDEX IF NOT EXISTS "Role_org_code_key" ON "Role" ("organizationId", "code") WHERE "organizationId" IS NOT NULL;
                CREATE INDEX IF NOT EXISTS "IX_Role_organizationId" ON "Role" ("organizationId");

                CREATE TABLE IF NOT EXISTS "RolePermission" (
                  "id" uuid NOT NULL,
                  "roleId" uuid NOT NULL,
                  "permission" text NOT NULL,
                  "allowed" boolean NOT NULL DEFAULT true,
                  CONSTRAINT "PK_RolePermission" PRIMARY KEY ("id"),
                  CONSTRAINT "FK_RolePermission_Role_roleId" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE NO ACTION
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_RolePermission_roleId_permission" ON "RolePermission" ("roleId", "permission");
                CREATE INDEX IF NOT EXISTS "IX_RolePermission_roleId" ON "RolePermission" ("roleId");

                ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "publicSlug" text;
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_Organization_publicSlug" ON "Organization" ("publicSlug") WHERE "publicSlug" IS NOT NULL;
                ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "firstName" text;
                ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "lastName" text;
                ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "username" text;
                ALTER TABLE "Tag" ADD COLUMN IF NOT EXISTS "isArchived" boolean NOT NULL DEFAULT false;
                ALTER TABLE "VolunteerNeed" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'published';

                CREATE TABLE IF NOT EXISTS "AccessRequest" (
                  "id" uuid NOT NULL,
                  "organizationId" uuid NOT NULL,
                  "userId" uuid,
                  "guestId" uuid,
                  "requestedRoleId" uuid,
                  "requestedDepartmentIds" jsonb NOT NULL DEFAULT '[]',
                  "message" text,
                  "status" text NOT NULL DEFAULT 'pending',
                  "reviewedByUserId" uuid,
                  "reviewedAt" timestamptz,
                  "volunteerNeedId" uuid,
                  "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  CONSTRAINT "PK_AccessRequest" PRIMARY KEY ("id")
                );
                CREATE INDEX IF NOT EXISTS "IX_AccessRequest_organizationId" ON "AccessRequest" ("organizationId");
                CREATE INDEX IF NOT EXISTS "IX_AccessRequest_userId" ON "AccessRequest" ("userId");
                CREATE INDEX IF NOT EXISTS "IX_AccessRequest_status" ON "AccessRequest" ("status");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
