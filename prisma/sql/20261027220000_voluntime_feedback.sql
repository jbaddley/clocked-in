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

ALTER TABLE "Role" ADD CONSTRAINT "FK_Role_Organization_organizationId"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

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

INSERT INTO "RolePermission" ("id", "roleId", "permission", "allowed")
SELECT gen_random_uuid(), r."id", p.permission, true
FROM "Role" r
CROSS JOIN (
  VALUES
    ('manage_organization'),
    ('manage_roles'),
    ('manage_members'),
    ('invite_members'),
    ('import_people'),
    ('approve_access_requests'),
    ('log_own_time'),
    ('log_member_time'),
    ('log_group_sessions'),
    ('log_event_totals'),
    ('view_reports'),
    ('export_reports'),
    ('design_reports'),
    ('create_needs'),
    ('approve_needs'),
    ('publish_needs'),
    ('create_projects'),
    ('archive_projects'),
    ('manage_lists'),
    ('manage_connections'),
    ('manage_api_keys')
) AS p(permission)
WHERE r."code" = 'ADMIN' AND r."organizationId" IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permission", "allowed")
SELECT gen_random_uuid(), r."id", p.permission, true
FROM "Role" r
CROSS JOIN (VALUES ('log_own_time'), ('view_reports'), ('export_reports')) AS p(permission)
WHERE r."code" = 'MEMBER' AND r."organizationId" IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permission", "allowed")
SELECT gen_random_uuid(), r."id", 'log_own_time', true
FROM "Role" r
WHERE r."code" = 'VOLUNTEER' AND r."organizationId" IS NULL
ON CONFLICT DO NOTHING;

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
  CONSTRAINT "PK_AccessRequest" PRIMARY KEY ("id"),
  CONSTRAINT "FK_AccessRequest_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_AccessRequest_User_userId" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_AccessRequest_Guest_guestId" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "FK_AccessRequest_Role_requestedRoleId" FOREIGN KEY ("requestedRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "FK_AccessRequest_User_reviewedByUserId" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "FK_AccessRequest_VolunteerNeed_volunteerNeedId" FOREIGN KEY ("volunteerNeedId") REFERENCES "VolunteerNeed"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "IX_AccessRequest_organizationId" ON "AccessRequest" ("organizationId");
CREATE INDEX IF NOT EXISTS "IX_AccessRequest_userId" ON "AccessRequest" ("userId");
CREATE INDEX IF NOT EXISTS "IX_AccessRequest_status" ON "AccessRequest" ("status");
