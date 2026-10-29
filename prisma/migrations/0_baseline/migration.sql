-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "TimeEntryMode" AS ENUM ('Punch', 'Duration', 'Total');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PK_User" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "phone" TEXT,
    "notes" TEXT,
    "zipCode" TEXT,
    "memberNumber" TEXT,
    "avatarUrl" TEXT,
    "description" TEXT,

    CONSTRAINT "PK_UserProfile" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" UUID,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT NOT NULL DEFAULT 'organization',

    CONSTRAINT "PK_Role" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "permission" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PK_RolePermission" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "defaultRateType" TEXT NOT NULL DEFAULT 'Volunteer',
    "preferences" JSONB NOT NULL DEFAULT '{"allowTimeEntryEditing": false}',
    "accentImageUrl" TEXT,
    "markUrl" TEXT,
    "wordmarkUrl" TEXT,
    "themeId" UUID NOT NULL DEFAULT '44444444-4444-4444-8444-444444444441'::uuid,
    "wordmarkOnLightUrl" TEXT,
    "description" TEXT,
    "websiteUrl" TEXT,
    "publicSlug" TEXT,
    "slug" CITEXT,

    CONSTRAINT "PK_Organization" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "joinedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "professionalBillingRate" DECIMAL(10,2),
    "rateType" TEXT NOT NULL DEFAULT 'Volunteer',
    "primaryDepartmentId" UUID,
    "orgUserDescription" TEXT,
    "orgUserTitle" TEXT,

    CONSTRAINT "PK_OrganizationMembership" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" CITEXT NOT NULL,

    CONSTRAINT "PK_Department" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentMembership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "joinedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_DepartmentMembership" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" CITEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PK_Tag" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCategory" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" CITEXT NOT NULL,

    CONSTRAINT "PK_TaskCategory" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID,
    "ownerUserId" UUID NOT NULL,
    "title" CITEXT NOT NULL,
    "description" TEXT,
    "accessType" TEXT NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "projectType" TEXT NOT NULL DEFAULT 'Project',

    CONSTRAINT "PK_Project" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTimeEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID,
    "mode" "TimeEntryMode" NOT NULL,
    "startedAt" TIMESTAMPTZ(6),
    "endedAt" TIMESTAMPTZ(6),
    "durationMinutes" INTEGER,
    "occurredOn" DATE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enteredByUserId" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    "hourlyRate" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "inKindValue" DECIMAL(12,2),
    "projectId" UUID,
    "taskCategoryId" UUID,
    "sourceRef" TEXT,
    "hourlyRateId" UUID,

    CONSTRAINT "PK_UserTimeEntry" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectiveTimeEntry" (
    "id" UUID NOT NULL,
    "recordedByUserId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID,
    "startedAt" TIMESTAMPTZ(6) NOT NULL,
    "endedAt" TIMESTAMPTZ(6) NOT NULL,
    "participantCount" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hourlyRate" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "inKindValue" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "projectId" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    "taskCategoryId" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    "hourlyRateId" UUID,

    CONSTRAINT "PK_CollectiveTimeEntry" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "PK_RefreshToken" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID,
    "roleId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "invitedByUserId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstName" TEXT,
    "lastName" TEXT,
    "username" TEXT,

    CONSTRAINT "PK_Invitation" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "usedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_PasswordResetCode" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectiveTimeEntryTag" (
    "collectiveTimeEntryId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "PK_CollectiveTimeEntryTag" PRIMARY KEY ("collectiveTimeEntryId","tagId")
);

-- CreateTable
CREATE TABLE "ProjectEditor" (
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "PK_ProjectEditor" PRIMARY KEY ("projectId","userId")
);

-- CreateTable
CREATE TABLE "UserTimeEntryTag" (
    "userTimeEntryId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "PK_UserTimeEntryTag" PRIMARY KEY ("userTimeEntryId","tagId")
);

-- CreateTable
CREATE TABLE "HourlyRate" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" CITEXT NOT NULL,
    "perHourRate" DECIMAL(10,2) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,

    CONSTRAINT "PK_HourlyRate" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Theme" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" UUID,
    "primary" TEXT NOT NULL,
    "primaryForeground" TEXT NOT NULL,
    "highlight" TEXT NOT NULL,
    "accent" TEXT NOT NULL,
    "success" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "surfaceForeground" TEXT NOT NULL,
    "foreground" TEXT NOT NULL,
    "headingFont" TEXT NOT NULL,
    "bodyFont" TEXT NOT NULL,
    "categoricalPalette" TEXT NOT NULL,
    "sequentialPalette" TEXT NOT NULL,
    "divergingPalette" TEXT NOT NULL,
    "chartColor" TEXT NOT NULL,

    CONSTRAINT "PK_Theme" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "screenshotUrls" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "githubIssueNumber" INTEGER,
    "ticketUrl" TEXT,

    CONSTRAINT "PK_Feedback" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackAction" (
    "id" UUID NOT NULL,
    "feedbackId" UUID NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "updatedStatus" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "description" TEXT NOT NULL,
    "takenByUserId" UUID NOT NULL,
    "ticketUrl" TEXT,

    CONSTRAINT "PK_FeedbackAction" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationApiKey" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "PK_OrganizationApiKey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformApiKey" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "PK_PlatformApiKey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberConnection" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userAId" UUID NOT NULL,
    "userBId" UUID NOT NULL,
    "relationship" TEXT NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_MemberConnection" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" CITEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isDashboard" BOOLEAN NOT NULL DEFAULT false,
    "layout" JSONB NOT NULL DEFAULT '{"version": 1, "cards": []}',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_Report" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "for" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_EmailTemplate" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "key" TEXT,
    "name" CITEXT NOT NULL,
    "layout" JSONB NOT NULL DEFAULT '{"version": 1, "cards": []}',
    "baseTemplateId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_ReportTemplate" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "userId" UUID,

    CONSTRAINT "PK_Guest" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID,
    "guestId" UUID,
    "requestedRoleId" UUID,
    "requestedDepartmentIds" JSONB NOT NULL DEFAULT '[]',
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMPTZ(6),
    "volunteerNeedId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_AccessRequest" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerNeed" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "publicToken" TEXT NOT NULL,
    "name" CITEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "countNeeded" INTEGER NOT NULL,
    "countVetted" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATE,
    "endDate" DATE,
    "requiredBy" TIMESTAMPTZ(6),
    "allowPublic" BOOLEAN NOT NULL DEFAULT false,
    "requireVetting" BOOLEAN NOT NULL DEFAULT false,
    "questions" JSONB NOT NULL DEFAULT '{"items": [], "version": 1}',
    "projectId" UUID,
    "taskCategoryId" UUID,
    "departmentId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'published',

    CONSTRAINT "PK_VolunteerNeed" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolunteerSignup" (
    "id" UUID NOT NULL,
    "volunteerNeedId" UUID NOT NULL,
    "userId" UUID,
    "guestId" UUID,
    "comment" TEXT,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "vetted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_VolunteerSignup" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IX_User_username" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "IX_User_email" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "IX_UserProfile_userId" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "IX_Role_organizationId" ON "Role"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_system_code_key" ON "Role"("code") WHERE ("organizationId" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "Role_org_code_key" ON "Role"("organizationId", "code") WHERE ("organizationId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "IX_RolePermission_roleId" ON "RolePermission"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "IX_RolePermission_roleId_permission" ON "RolePermission"("roleId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "IX_Organization_publicSlug" ON "Organization"("publicSlug") WHERE ("publicSlug" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "IX_Organization_slug" ON "Organization"("slug") WHERE (slug IS NOT NULL);

-- CreateIndex
CREATE INDEX "IX_Organization_themeId" ON "Organization"("themeId");

-- CreateIndex
CREATE INDEX "IX_OrganizationMembership_organizationId" ON "OrganizationMembership"("organizationId");

-- CreateIndex
CREATE INDEX "IX_OrganizationMembership_primaryDepartmentId" ON "OrganizationMembership"("primaryDepartmentId");

-- CreateIndex
CREATE INDEX "IX_OrganizationMembership_roleId" ON "OrganizationMembership"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "IX_OrganizationMembership_userId_organizationId" ON "OrganizationMembership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "IX_Department_organizationId_name" ON "Department"("organizationId", "name");

-- CreateIndex
CREATE INDEX "IX_DepartmentMembership_departmentId" ON "DepartmentMembership"("departmentId");

-- CreateIndex
CREATE INDEX "IX_DepartmentMembership_roleId" ON "DepartmentMembership"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "IX_DepartmentMembership_userId_departmentId" ON "DepartmentMembership"("userId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "IX_Tag_organizationId_name" ON "Tag"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "IX_TaskCategory_organizationId_name" ON "TaskCategory"("organizationId", "name");

-- CreateIndex
CREATE INDEX "IX_Project_departmentId" ON "Project"("departmentId");

-- CreateIndex
CREATE INDEX "IX_Project_ownerUserId" ON "Project"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "IX_Project_organizationId_title" ON "Project"("organizationId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "IX_UserTimeEntry_sourceRef" ON "UserTimeEntry"("sourceRef");

-- CreateIndex
CREATE INDEX "IX_UserTimeEntry_departmentId" ON "UserTimeEntry"("departmentId");

-- CreateIndex
CREATE INDEX "IX_UserTimeEntry_enteredByUserId" ON "UserTimeEntry"("enteredByUserId");

-- CreateIndex
CREATE INDEX "IX_UserTimeEntry_organizationId_occurredOn" ON "UserTimeEntry"("organizationId", "occurredOn");

-- CreateIndex
CREATE INDEX "IX_UserTimeEntry_projectId" ON "UserTimeEntry"("projectId");

-- CreateIndex
CREATE INDEX "IX_UserTimeEntry_taskCategoryId" ON "UserTimeEntry"("taskCategoryId");

-- CreateIndex
CREATE INDEX "IX_UserTimeEntry_userId_occurredOn" ON "UserTimeEntry"("userId", "occurredOn");

-- CreateIndex
CREATE INDEX "IX_UserTimeEntry_hourlyRateId" ON "UserTimeEntry"("hourlyRateId");

-- CreateIndex
CREATE INDEX "IX_CollectiveTimeEntry_departmentId" ON "CollectiveTimeEntry"("departmentId");

-- CreateIndex
CREATE INDEX "IX_CollectiveTimeEntry_organizationId_startedAt" ON "CollectiveTimeEntry"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "IX_CollectiveTimeEntry_projectId" ON "CollectiveTimeEntry"("projectId");

-- CreateIndex
CREATE INDEX "IX_CollectiveTimeEntry_recordedByUserId" ON "CollectiveTimeEntry"("recordedByUserId");

-- CreateIndex
CREATE INDEX "IX_CollectiveTimeEntry_taskCategoryId" ON "CollectiveTimeEntry"("taskCategoryId");

-- CreateIndex
CREATE INDEX "IX_CollectiveTimeEntry_hourlyRateId" ON "CollectiveTimeEntry"("hourlyRateId");

-- CreateIndex
CREATE UNIQUE INDEX "IX_RefreshToken_tokenHash" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "IX_RefreshToken_userId" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IX_Invitation_codeHash" ON "Invitation"("codeHash");

-- CreateIndex
CREATE INDEX "IX_Invitation_departmentId" ON "Invitation"("departmentId");

-- CreateIndex
CREATE INDEX "IX_Invitation_email" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "IX_Invitation_invitedByUserId" ON "Invitation"("invitedByUserId");

-- CreateIndex
CREATE INDEX "IX_Invitation_organizationId" ON "Invitation"("organizationId");

-- CreateIndex
CREATE INDEX "IX_Invitation_roleId" ON "Invitation"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_pending_department_key" ON "Invitation"("email", "departmentId") WHERE (("departmentId" IS NOT NULL) AND ("acceptedAt" IS NULL) AND ("revokedAt" IS NULL));

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_pending_org_key" ON "Invitation"("email", "organizationId") WHERE (("departmentId" IS NULL) AND ("acceptedAt" IS NULL) AND ("revokedAt" IS NULL));

-- CreateIndex
CREATE UNIQUE INDEX "IX_PasswordResetCode_codeHash" ON "PasswordResetCode"("codeHash");

-- CreateIndex
CREATE INDEX "IX_PasswordResetCode_userId" ON "PasswordResetCode"("userId");

-- CreateIndex
CREATE INDEX "IX_CollectiveTimeEntryTag_tagId" ON "CollectiveTimeEntryTag"("tagId");

-- CreateIndex
CREATE INDEX "IX_ProjectEditor_userId" ON "ProjectEditor"("userId");

-- CreateIndex
CREATE INDEX "IX_UserTimeEntryTag_tagId" ON "UserTimeEntryTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "HourlyRate_default_volunteer_key" ON "HourlyRate"("organizationId") WHERE (("isDefault" = true) AND (type = 'Volunteer'::text));

-- CreateIndex
CREATE UNIQUE INDEX "IX_HourlyRate_organizationId_name" ON "HourlyRate"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Theme_global_name_key" ON "Theme"("name") WHERE ("organizationId" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "Theme_organization_name_key" ON "Theme"("organizationId", "name") WHERE ("organizationId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "IX_Feedback_createdAt" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "IX_Feedback_organizationId" ON "Feedback"("organizationId");

-- CreateIndex
CREATE INDEX "IX_Feedback_status" ON "Feedback"("status");

-- CreateIndex
CREATE INDEX "IX_Feedback_userId" ON "Feedback"("userId");

-- CreateIndex
CREATE INDEX "IX_FeedbackAction_feedbackId" ON "FeedbackAction"("feedbackId");

-- CreateIndex
CREATE INDEX "IX_FeedbackAction_takenByUserId" ON "FeedbackAction"("takenByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "IX_OrganizationApiKey_keyHash" ON "OrganizationApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "IX_OrganizationApiKey_createdByUserId" ON "OrganizationApiKey"("createdByUserId");

-- CreateIndex
CREATE INDEX "IX_OrganizationApiKey_organizationId" ON "OrganizationApiKey"("organizationId");

-- CreateIndex
CREATE INDEX "IX_OrganizationApiKey_prefix" ON "OrganizationApiKey"("prefix");

-- CreateIndex
CREATE UNIQUE INDEX "IX_PlatformApiKey_keyHash" ON "PlatformApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "IX_PlatformApiKey_createdByUserId" ON "PlatformApiKey"("createdByUserId");

-- CreateIndex
CREATE INDEX "IX_PlatformApiKey_prefix" ON "PlatformApiKey"("prefix");

-- CreateIndex
CREATE INDEX "IX_MemberConnection_createdByUserId" ON "MemberConnection"("createdByUserId");

-- CreateIndex
CREATE INDEX "IX_MemberConnection_userAId" ON "MemberConnection"("userAId");

-- CreateIndex
CREATE INDEX "IX_MemberConnection_userBId" ON "MemberConnection"("userBId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberConnection_pair_key" ON "MemberConnection"("organizationId", "userAId", "userBId");

-- CreateIndex
CREATE UNIQUE INDEX "IX_Report_organizationId_name" ON "Report"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Report_one_default" ON "Report"("organizationId") WHERE ("isDefault" = true);

-- CreateIndex
CREATE UNIQUE INDEX "Report_one_dashboard" ON "Report"("organizationId") WHERE ("isDashboard" = true);

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_organization_for" ON "EmailTemplate"("organizationId", "for");

-- CreateIndex
CREATE INDEX "IX_ReportTemplate_baseTemplateId" ON "ReportTemplate"("baseTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportTemplate_global_key" ON "ReportTemplate"("key") WHERE ("organizationId" IS NULL AND "key" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "ReportTemplate_global_name" ON "ReportTemplate"("name") WHERE ("organizationId" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "ReportTemplate_override" ON "ReportTemplate"("organizationId", "baseTemplateId") WHERE ("baseTemplateId" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "ReportTemplate_org_name" ON "ReportTemplate"("organizationId", "name") WHERE ("organizationId" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "IX_Guest_email" ON "Guest"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_user" ON "Guest"("userId") WHERE ("userId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "IX_AccessRequest_organizationId" ON "AccessRequest"("organizationId");

-- CreateIndex
CREATE INDEX "IX_AccessRequest_userId" ON "AccessRequest"("userId");

-- CreateIndex
CREATE INDEX "IX_AccessRequest_status" ON "AccessRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IX_VolunteerNeed_publicToken" ON "VolunteerNeed"("publicToken");

-- CreateIndex
CREATE INDEX "IX_VolunteerNeed_createdByUserId" ON "VolunteerNeed"("createdByUserId");

-- CreateIndex
CREATE INDEX "IX_VolunteerNeed_departmentId" ON "VolunteerNeed"("departmentId");

-- CreateIndex
CREATE INDEX "IX_VolunteerNeed_organizationId" ON "VolunteerNeed"("organizationId");

-- CreateIndex
CREATE INDEX "IX_VolunteerNeed_projectId" ON "VolunteerNeed"("projectId");

-- CreateIndex
CREATE INDEX "IX_VolunteerNeed_taskCategoryId" ON "VolunteerNeed"("taskCategoryId");

-- CreateIndex
CREATE INDEX "IX_VolunteerSignup_guestId" ON "VolunteerSignup"("guestId");

-- CreateIndex
CREATE INDEX "IX_VolunteerSignup_userId" ON "VolunteerSignup"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerSignup_need_guest" ON "VolunteerSignup"("volunteerNeedId", "guestId") WHERE ("guestId" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "VolunteerSignup_need_user" ON "VolunteerSignup"("volunteerNeedId", "userId") WHERE ("userId" IS NOT NULL);

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "FK_UserProfile_User_userId" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "FK_Role_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "FK_RolePermission_Role_roleId" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "FK_Organization_Theme_themeId" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "FK_OrganizationMembership_Department_primaryDepartmentId" FOREIGN KEY ("primaryDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "FK_OrganizationMembership_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "FK_OrganizationMembership_Role_roleId" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "FK_OrganizationMembership_User_userId" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "FK_Department_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "FK_DepartmentMembership_Department_departmentId" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "FK_DepartmentMembership_Role_roleId" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "FK_DepartmentMembership_User_userId" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "FK_Tag_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "TaskCategory" ADD CONSTRAINT "FK_TaskCategory_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "FK_Project_Department_departmentId" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "FK_Project_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "FK_Project_User_ownerUserId" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserTimeEntry" ADD CONSTRAINT "FK_UserTimeEntry_Department_departmentId" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserTimeEntry" ADD CONSTRAINT "FK_UserTimeEntry_HourlyRate_hourlyRateId" FOREIGN KEY ("hourlyRateId") REFERENCES "HourlyRate"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserTimeEntry" ADD CONSTRAINT "FK_UserTimeEntry_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserTimeEntry" ADD CONSTRAINT "FK_UserTimeEntry_Project_projectId" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserTimeEntry" ADD CONSTRAINT "FK_UserTimeEntry_TaskCategory_taskCategoryId" FOREIGN KEY ("taskCategoryId") REFERENCES "TaskCategory"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserTimeEntry" ADD CONSTRAINT "FK_UserTimeEntry_User_enteredByUserId" FOREIGN KEY ("enteredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserTimeEntry" ADD CONSTRAINT "FK_UserTimeEntry_User_userId" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CollectiveTimeEntry" ADD CONSTRAINT "FK_CollectiveTimeEntry_Department_departmentId" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CollectiveTimeEntry" ADD CONSTRAINT "FK_CollectiveTimeEntry_HourlyRate_hourlyRateId" FOREIGN KEY ("hourlyRateId") REFERENCES "HourlyRate"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CollectiveTimeEntry" ADD CONSTRAINT "FK_CollectiveTimeEntry_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CollectiveTimeEntry" ADD CONSTRAINT "FK_CollectiveTimeEntry_Project_projectId" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CollectiveTimeEntry" ADD CONSTRAINT "FK_CollectiveTimeEntry_TaskCategory_taskCategoryId" FOREIGN KEY ("taskCategoryId") REFERENCES "TaskCategory"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CollectiveTimeEntry" ADD CONSTRAINT "FK_CollectiveTimeEntry_User_recordedByUserId" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "FK_RefreshToken_User_userId" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "FK_Invitation_Department_departmentId" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "FK_Invitation_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "FK_Invitation_Role_roleId" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "FK_Invitation_User_invitedByUserId" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PasswordResetCode" ADD CONSTRAINT "FK_PasswordResetCode_User_userId" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CollectiveTimeEntryTag" ADD CONSTRAINT "FK_CollectiveTimeEntryTag_CollectiveTimeEntry_collectiveTimeEn~" FOREIGN KEY ("collectiveTimeEntryId") REFERENCES "CollectiveTimeEntry"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CollectiveTimeEntryTag" ADD CONSTRAINT "FK_CollectiveTimeEntryTag_Tag_tagId" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProjectEditor" ADD CONSTRAINT "FK_ProjectEditor_Project_projectId" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProjectEditor" ADD CONSTRAINT "FK_ProjectEditor_User_userId" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserTimeEntryTag" ADD CONSTRAINT "FK_UserTimeEntryTag_Tag_tagId" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "UserTimeEntryTag" ADD CONSTRAINT "FK_UserTimeEntryTag_UserTimeEntry_userTimeEntryId" FOREIGN KEY ("userTimeEntryId") REFERENCES "UserTimeEntry"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "HourlyRate" ADD CONSTRAINT "FK_HourlyRate_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Theme" ADD CONSTRAINT "FK_Theme_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "FK_Feedback_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "FK_Feedback_User_userId" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "FeedbackAction" ADD CONSTRAINT "FK_FeedbackAction_Feedback_feedbackId" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "FeedbackAction" ADD CONSTRAINT "FK_FeedbackAction_User_takenByUserId" FOREIGN KEY ("takenByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrganizationApiKey" ADD CONSTRAINT "FK_OrganizationApiKey_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrganizationApiKey" ADD CONSTRAINT "FK_OrganizationApiKey_User_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PlatformApiKey" ADD CONSTRAINT "FK_PlatformApiKey_User_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MemberConnection" ADD CONSTRAINT "FK_MemberConnection_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MemberConnection" ADD CONSTRAINT "FK_MemberConnection_User_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MemberConnection" ADD CONSTRAINT "FK_MemberConnection_User_userAId" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MemberConnection" ADD CONSTRAINT "FK_MemberConnection_User_userBId" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "FK_Report_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "FK_EmailTemplate_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "FK_ReportTemplate_ReportTemplate_baseTemplateId" FOREIGN KEY ("baseTemplateId") REFERENCES "ReportTemplate"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "FK_ReportTemplate_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "FK_Guest_User_userId" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "FK_AccessRequest_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "FK_AccessRequest_User_userId" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "FK_AccessRequest_Guest_guestId" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "FK_AccessRequest_Role_requestedRoleId" FOREIGN KEY ("requestedRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "FK_AccessRequest_User_reviewedByUserId" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "FK_AccessRequest_VolunteerNeed_volunteerNeedId" FOREIGN KEY ("volunteerNeedId") REFERENCES "VolunteerNeed"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VolunteerNeed" ADD CONSTRAINT "FK_VolunteerNeed_Department_departmentId" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VolunteerNeed" ADD CONSTRAINT "FK_VolunteerNeed_Organization_organizationId" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VolunteerNeed" ADD CONSTRAINT "FK_VolunteerNeed_Project_projectId" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VolunteerNeed" ADD CONSTRAINT "FK_VolunteerNeed_TaskCategory_taskCategoryId" FOREIGN KEY ("taskCategoryId") REFERENCES "TaskCategory"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VolunteerNeed" ADD CONSTRAINT "FK_VolunteerNeed_User_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VolunteerSignup" ADD CONSTRAINT "FK_VolunteerSignup_Guest_guestId" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VolunteerSignup" ADD CONSTRAINT "FK_VolunteerSignup_User_userId" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "VolunteerSignup" ADD CONSTRAINT "FK_VolunteerSignup_VolunteerNeed_volunteerNeedId" FOREIGN KEY ("volunteerNeedId") REFERENCES "VolunteerNeed"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "CollectiveTimeEntry" ADD CONSTRAINT "CollectiveTimeEntry_span_check" CHECK ((("endedAt" > "startedAt") AND ("participantCount" >= 1) AND ("hourlyRate" > (0)::numeric) AND ("inKindValue" = round((((EXTRACT(epoch FROM ("endedAt" - "startedAt")) / 3600.0) * ("participantCount")::numeric) * "hourlyRate"), 2))));

ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 80 AND char_length(btrim("subject")) BETWEEN 1 AND 200);

ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_values_check" CHECK (((type = ANY (ARRAY['Bug'::text, 'Feature'::text])) AND (priority = ANY (ARRAY['Urgent'::text, 'High'::text, 'Medium'::text, 'Low'::text])) AND (area = ANY (ARRAY['Dashboard'::text, 'LogTime'::text, 'Entries'::text, 'Reports'::text, 'Settings'::text, 'Other'::text])) AND (status = ANY (ARRAY['Pending'::text, 'Acknowledged'::text, 'Planned'::text, 'InProgress'::text, 'Resolved'::text, 'Cancelled'::text, 'CouldNotReproduce'::text, 'Archived'::text])) AND ((char_length(title) >= 1) AND (char_length(title) <= 120)) AND ((char_length(description) >= 1) AND (char_length(description) <= 4000)) AND ("left"(("screenshotUrls")::text, 1) = '['::text) AND (("githubIssueNumber" IS NULL) OR ("githubIssueNumber" > 0))));

ALTER TABLE "FeedbackAction" ADD CONSTRAINT "FeedbackAction_values_check" CHECK ((("previousStatus" = ANY (ARRAY['Pending'::text, 'Acknowledged'::text, 'Planned'::text, 'InProgress'::text, 'Resolved'::text, 'Cancelled'::text, 'CouldNotReproduce'::text, 'Archived'::text])) AND ("updatedStatus" = ANY (ARRAY['Pending'::text, 'Acknowledged'::text, 'Planned'::text, 'InProgress'::text, 'Resolved'::text, 'Cancelled'::text, 'CouldNotReproduce'::text, 'Archived'::text])) AND ((char_length(description) >= 1) AND (char_length(description) <= 2000))));

ALTER TABLE "Guest" ADD CONSTRAINT "Guest_values_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 120 AND "email" = lower("email") AND char_length(btrim("phone")) BETWEEN 1 AND 40);

ALTER TABLE "HourlyRate" ADD CONSTRAINT "HourlyRate_rate_check" CHECK (((type = ANY (ARRAY['Volunteer'::text, 'Professional'::text])) AND ("perHourRate" > (0)::numeric) AND (("isDefault" = false) OR (type = 'Volunteer'::text)) AND ((source IS NULL) OR ((char_length(source) >= 1) AND (char_length(source) <= 200)))));

ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_lowercase_email_check" CHECK ((email = lower(email)));

ALTER TABLE "MemberConnection" ADD CONSTRAINT "MemberConnection_pair_check" CHECK ((("userAId" <> "userBId") AND (("userAId")::text < ("userBId")::text) AND (relationship = ANY (ARRAY['Parent'::text, 'Child'::text, 'Spouse'::text, 'Sibling'::text, 'Grandparent'::text, 'Grandchild'::text, 'Guardian'::text, 'Dependent'::text, 'Friend'::text, 'Colleague'::text, 'Associate'::text]))));

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_rate_check" CHECK (("defaultRateType" = ANY (ARRAY['Volunteer'::text, 'Professional'::text])));

ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_rate_check" CHECK ((("rateType" = ANY (ARRAY['Volunteer'::text, 'Professional'::text])) AND ((("rateType" = 'Volunteer'::text) AND ("professionalBillingRate" IS NULL)) OR (("rateType" = 'Professional'::text) AND ("professionalBillingRate" IS NOT NULL) AND ("professionalBillingRate" > (0)::numeric)))));

ALTER TABLE "Project" ADD CONSTRAINT "Project_access_check" CHECK ((("projectType" = ANY (ARRAY['Project'::text, 'Event'::text])) AND ("accessType" = ANY (ARRAY['Public'::text, 'Private'::text, 'Department'::text])) AND ((("accessType" = 'Department'::text) AND ("departmentId" IS NOT NULL)) OR (("accessType" = ANY (ARRAY['Public'::text, 'Private'::text])) AND ("departmentId" IS NULL))) AND (("startDate" IS NULL) OR ("endDate" IS NULL) OR ("endDate" >= "startDate"))));

ALTER TABLE "Report" ADD CONSTRAINT "Report_name_check" CHECK (((char_length(btrim((name)::text)) >= 1) AND (char_length(btrim((name)::text)) <= 80)));

ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_shape_check" CHECK (char_length(btrim("name"::text)) BETWEEN 1 AND 80 AND (("organizationId" IS NULL AND "baseTemplateId" IS NULL AND "key" IN ('summary', 'people', 'groups', 'staff')) OR ("organizationId" IS NOT NULL AND "key" IS NULL AND "baseTemplateId" IS NULL) OR ("organizationId" IS NOT NULL AND "key" IS NULL AND "baseTemplateId" IS NOT NULL)));

ALTER TABLE "Theme" ADD CONSTRAINT "Theme_token_check" CHECK ((("primary" ~ '^#[0-9A-Fa-f]{6}$'::text) AND ("primaryForeground" ~ '^#[0-9A-Fa-f]{6}$'::text) AND (highlight ~ '^#[0-9A-Fa-f]{6}$'::text) AND (accent ~ '^#[0-9A-Fa-f]{6}$'::text) AND (success ~ '^#[0-9A-Fa-f]{6}$'::text) AND (surface ~ '^#[0-9A-Fa-f]{6}$'::text) AND ("surfaceForeground" ~ '^#[0-9A-Fa-f]{6}$'::text) AND (foreground ~ '^#[0-9A-Fa-f]{6}$'::text) AND ("chartColor" ~ '^#[0-9A-Fa-f]{6}$'::text) AND ("headingFont" = ANY (ARRAY['HelveticaNeue'::text, 'AvenirNext'::text, 'SourceSans3'::text, 'NunitoSans'::text, 'Geist'::text])) AND ("bodyFont" = ANY (ARRAY['HelveticaNeue'::text, 'AvenirNext'::text, 'SourceSans3'::text, 'NunitoSans'::text, 'Geist'::text])) AND ("left"("categoricalPalette", 1) = '['::text) AND ("left"("sequentialPalette", 1) = '['::text) AND ("left"("divergingPalette", 1) = '['::text)));

ALTER TABLE "User" ADD CONSTRAINT "User_lowercase_identity_check" CHECK (((username = lower(username)) AND (email = lower(email))));

ALTER TABLE "UserTimeEntry" ADD CONSTRAINT "UserTimeEntry_mode_check" CHECK (((((mode = ANY (ARRAY['Punch'::"TimeEntryMode", 'Duration'::"TimeEntryMode"])) AND ("hourlyRate" > (0)::numeric)) OR ((mode = 'Total'::"TimeEntryMode") AND ("hourlyRate" >= (0)::numeric))) AND (((mode = 'Punch'::"TimeEntryMode") AND ("startedAt" IS NOT NULL) AND ((("endedAt" IS NULL) AND ("durationMinutes" IS NULL) AND ("inKindValue" IS NULL)) OR (("endedAt" IS NOT NULL) AND ("endedAt" > "startedAt") AND (("durationMinutes" >= 1) AND ("durationMinutes" <= 1440)) AND ("durationMinutes" = (floor((EXTRACT(epoch FROM ("endedAt" - "startedAt")) / (60)::numeric)))::integer) AND ("inKindValue" IS NOT NULL) AND ("inKindValue" = round(((("durationMinutes")::numeric * "hourlyRate") / (60)::numeric), 2))))) OR ((mode = 'Duration'::"TimeEntryMode") AND (("durationMinutes" >= 1) AND ("durationMinutes" <= 1440)) AND ("inKindValue" IS NOT NULL) AND ("inKindValue" = round(((("durationMinutes")::numeric * "hourlyRate") / (60)::numeric), 2)) AND ((("startedAt" IS NULL) AND ("endedAt" IS NULL)) OR (("startedAt" IS NOT NULL) AND ("endedAt" IS NOT NULL) AND ("endedAt" > "startedAt") AND ("durationMinutes" = (floor((EXTRACT(epoch FROM ("endedAt" - "startedAt")) / (60)::numeric)))::integer)))) OR ((mode = 'Total'::"TimeEntryMode") AND (("durationMinutes" >= 1) AND ("durationMinutes" <= 59940)) AND ("hourlyRate" >= (0)::numeric) AND ("inKindValue" IS NOT NULL) AND ("inKindValue" = round(((("durationMinutes")::numeric * "hourlyRate") / (60)::numeric), 2))))));

ALTER TABLE "VolunteerNeed" ADD CONSTRAINT "VolunteerNeed_values_check" CHECK (((type = ANY (ARRAY['Position'::text, 'Task'::text])) AND ((char_length(btrim((name)::text)) >= 1) AND (char_length(btrim((name)::text)) <= 200)) AND ((description IS NULL) OR ((char_length(description) >= 1) AND (char_length(description) <= 4000))) AND (("countNeeded" >= 1) AND ("countNeeded" <= 10000)) AND ("countVetted" >= 0) AND ("countVetted" <= "countNeeded") AND (("endDate" IS NULL) OR ("startDate" IS NULL) OR ("endDate" >= "startDate")) AND (char_length("publicToken") = 32) AND ("publicToken" = lower("publicToken")) AND ("left"((questions)::text, 1) = '{'::text)));

ALTER TABLE "VolunteerSignup" ADD CONSTRAINT "VolunteerSignup_person_check" CHECK ((((("userId" IS NOT NULL) AND ("guestId" IS NULL)) OR (("userId" IS NULL) AND ("guestId" IS NOT NULL))) AND ((comment IS NULL) OR ((char_length(comment) >= 1) AND (char_length(comment) <= 2000))) AND ("left"((answers)::text, 1) = '['::text)));

INSERT INTO "Role" (code, id, "isSystem", name, "organizationId", scope) VALUES ('MEMBER', '11111111-1111-4111-8111-111111111111', 'true', 'Staff', NULL, 'organization');

INSERT INTO "Role" (code, id, "isSystem", name, "organizationId", scope) VALUES ('ADMIN', '22222222-2222-4222-8222-222222222222', 'true', 'Admin', NULL, 'organization');

INSERT INTO "Role" (code, id, "isSystem", name, "organizationId", scope) VALUES ('VOLUNTEER', '33333333-3333-4333-8333-333333333333', 'true', 'Volunteer', NULL, 'self');

INSERT INTO "Theme" (accent, "bodyFont", "categoricalPalette", "chartColor", "divergingPalette", foreground, "headingFont", highlight, id, name, "organizationId", "primary", "primaryForeground", "sequentialPalette", success, surface, "surfaceForeground") VALUES ('#FF5E9F', 'NunitoSans', '["#001836","#D4AC59","#2A6F97","#4EBFAE","#C17B4A","#6B7C93"]', '#001836', '["#8B3A2A","#C17B4A","#E8C9A8","#F7F4EE","#A8C4D4","#2A6F97","#001836"]', '#001836', 'SourceSans3', '#D4AC59', '44444444-4444-4444-8444-444444444441', 'VolunTime', NULL, '#001836', '#FFFFFF', '["#F4F0E6","#E8D7A8","#D4AC59","#8A6E2F","#3D3014"]', '#4EBFAE', '#FFFFFF', '#001836');

INSERT INTO "Theme" (accent, "bodyFont", "categoricalPalette", "chartColor", "divergingPalette", foreground, "headingFont", highlight, id, name, "organizationId", "primary", "primaryForeground", "sequentialPalette", success, surface, "surfaceForeground") VALUES ('#E9C46A', 'NunitoSans', '["#1B3A4B","#2A9D8F","#E9C46A","#3D5A80","#8A9BA8","#C17B4A"]', '#1B3A4B', '["#C17B4A","#E0B089","#F3E0C8","#F7FBFC","#A8D4E0","#3D5A80","#1B3A4B"]', '#1B3A4B', 'Geist', '#2A9D8F', '44444444-4444-4444-8444-444444444442', 'Harbor', NULL, '#1B3A4B', '#F4FAFB', '["#E6F4F2","#A8D9D3","#2A9D8F","#1B6B61","#0E3A35"]', '#2A9D8F', '#F7FBFC', '#1B3A4B');

INSERT INTO "Theme" (accent, "bodyFont", "categoricalPalette", "chartColor", "divergingPalette", foreground, "headingFont", highlight, id, name, "organizationId", "primary", "primaryForeground", "sequentialPalette", success, surface, "surfaceForeground") VALUES ('#7A8F6A', 'NunitoSans', '["#3D2B1F","#C4784A","#7A8F6A","#8B6B4A","#D4A574","#5C6B7A"]', '#3D2B1F', '["#7A3B2E","#C4784A","#E8C4A0","#FFF8F0","#C5D1B8","#7A8F6A","#3D4A32"]', '#3D2B1F', 'SourceSans3', '#C4784A', '44444444-4444-4444-8444-444444444443', 'Atelier', NULL, '#3D2B1F', '#FFF8F0', '["#FFF1E4","#E8C4A0","#C4784A","#8A4E2A","#3D2B1F"]', '#6B8F71', '#FFF8F0', '#3D2B1F');

INSERT INTO "Theme" (accent, "bodyFont", "categoricalPalette", "chartColor", "divergingPalette", foreground, "headingFont", highlight, id, name, "organizationId", "primary", "primaryForeground", "sequentialPalette", success, surface, "surfaceForeground") VALUES ('#D4A017', 'SourceSans3', '["#1A2F23","#5B8A6A","#D4A017","#3D5C6A","#8A9B7A","#C4784A"]', '#1A2F23', '["#8B3A2A","#C4784A","#E8C9A8","#F6F8F4","#A8C4B0","#3D7A54","#1A2F23"]', '#1A2F23', 'Geist', '#5B8A6A', '44444444-4444-4444-8444-444444444444', 'Evergreen', NULL, '#1A2F23', '#F3F7F2', '["#E8F0EA","#A8C4B0","#5B8A6A","#2F5A3E","#1A2F23"]', '#3D7A54', '#F6F8F4', '#1A2F23');

INSERT INTO "Theme" (accent, "bodyFont", "categoricalPalette", "chartColor", "divergingPalette", foreground, "headingFont", highlight, id, name, "organizationId", "primary", "primaryForeground", "sequentialPalette", success, surface, "surfaceForeground") VALUES ('#E8A838', 'Geist', '["#2C2156","#8B6FBF","#E8A838","#5A9E8F","#C46B8A","#4A6B8A"]', '#2C2156', '["#C46B8A","#E0A8B8","#F3D8E0","#FBFAFE","#C4B0E0","#8B6FBF","#2C2156"]', '#2C2156', 'NunitoSans', '#8B6FBF', '44444444-4444-4444-8444-444444444445', 'Orchid', NULL, '#2C2156', '#F8F5FF', '["#F0EAF8","#C4B0E0","#8B6FBF","#5A3F8A","#2C2156"]', '#5A9E8F', '#FBFAFE', '#2C2156');

INSERT INTO "Theme" (accent, "bodyFont", "categoricalPalette", "chartColor", "divergingPalette", foreground, "headingFont", highlight, id, name, "organizationId", "primary", "primaryForeground", "sequentialPalette", success, surface, "surfaceForeground") VALUES ('#E69F00', 'NunitoSans', '["#E69F00","#56B4E9","#009E73","#F0E442","#0072B2","#D55E00","#CC79A7","#000000"]', '#000000', '["#D55E00","#E69F00","#F0E442","#FFFFFF","#56B4E9","#0072B2","#000000"]', '#000000', 'SourceSans3', '#0072B2', '44444444-4444-4444-8444-444444444446', 'Okabe-Ito', NULL, '#000000', '#FFFFFF', '["#E6F2F8","#9ED0E8","#56B4E9","#0072B2","#003D5C"]', '#009E73', '#FFFFFF', '#000000');

INSERT INTO "Theme" (accent, "bodyFont", "categoricalPalette", "chartColor", "divergingPalette", foreground, "headingFont", highlight, id, name, "organizationId", "primary", "primaryForeground", "sequentialPalette", success, surface, "surfaceForeground") VALUES ('#DDCC77', 'NunitoSans', '["#4477AA","#EE6677","#228833","#CCBB44","#66CCEE","#AA3377","#BBBBBB"]', '#332288', '["#EE6677","#F4A8B0","#FAD8DC","#FFFFFF","#A8D4E8","#4477AA","#332288"]', '#332288', 'Geist', '#117733', '44444444-4444-4444-8444-444444444447', 'Tol Bright', NULL, '#332288', '#FFFFFF', '["#E8F0F6","#A8C4DC","#4477AA","#2A4F7A","#1A3048"]', '#44AA99', '#FFFFFF', '#332288');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', '00142e28-441a-47d1-bc32-2bb6440bd5a3', 'log_own_time', '11111111-1111-4111-8111-111111111111');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', '1e7a11be-5710-4419-980f-d4ae75cf7cea', 'manage_members', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', '4326ee74-bcdd-4aba-ac76-9f252f76f03b', 'log_own_time', '33333333-3333-4333-8333-333333333333');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', '4a6705a3-0fbd-4038-abcf-4d8779bf7f89', 'manage_lists', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', '56740fe3-e02a-4918-9ab9-915ed53f109a', 'log_member_time', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', '56be2065-b9da-433e-88a2-0982b55e35e2', 'create_needs', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', '6830cc69-cf43-415e-857b-cf8413307a7b', 'import_people', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', '6daffe4b-0977-4a1c-abbb-98a63cb9728c', 'manage_roles', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', '744ab48f-90a0-46b3-a9cd-6734da469cd0', 'export_reports', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', '749e0a24-eeca-4b4a-a0bc-23a2a1994bb9', 'log_event_totals', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', '76c4b667-81d2-4400-8db3-daa4122f4aed', 'archive_projects', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', '7a8c03c3-37c9-4786-9124-aead2a7693ce', 'view_reports', '11111111-1111-4111-8111-111111111111');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', '8083c19f-1cff-4326-97f5-73924356a69a', 'design_reports', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', '89b1149a-8afc-4f60-87fb-e676ccc75fd1', 'log_group_sessions', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', 'a4ca0f83-a1a2-44df-81e2-48f522fc15dc', 'log_own_time', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', 'af799620-d6c5-4d96-9b78-2c3650ef632e', 'manage_organization', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', 'afd2e91f-a988-4bdb-a153-2e03c17cd359', 'invite_members', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', 'b2dcb682-ca53-4481-ab1b-7e3bbdcb3965', 'approve_access_requests', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', 'bae1306c-c1a9-46c1-a256-4970bf94d816', 'publish_needs', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', 'd58602e8-37dc-4c11-a582-7582646eec9a', 'create_projects', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', 'd731f2e8-d5b4-41aa-bad2-9f532b364af2', 'manage_connections', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', 'db605ba4-2320-4f0f-a081-feae87e3ec89', 'export_reports', '11111111-1111-4111-8111-111111111111');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', 'ed1ba262-37df-40d7-a24d-d9d7b242b14d', 'view_reports', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', 'ed563f70-c690-43c2-86dd-38d79f036264', 'manage_api_keys', '22222222-2222-4222-8222-222222222222');

INSERT INTO "RolePermission" (allowed, id, permission, "roleId") VALUES ('true', 'f507ddc6-a93f-417b-babb-e3f03d9ba6ed', 'approve_needs', '22222222-2222-4222-8222-222222222222');

INSERT INTO "ReportTemplate" ("baseTemplateId", "createdAt", id, key, layout, name, "organizationId", "updatedAt") VALUES (NULL, '2026-10-28T23:59:06.089475+00:00', '11111111-1111-4111-8111-111111111101', 'summary', '{"cards": [{"id": "00000000-0000-4000-8000-000000000001", "row": 1, "icon": "clock", "kind": "value", "rows": 1, "color": "primary", "title": "Total volunteer hours", "column": 1, "format": "hours", "columns": 3, "pattern": "0,0.[00]", "accessor": "user.hours", "description": ""}, {"id": "00000000-0000-4000-8000-000000000002", "row": 1, "icon": "hand-coins", "kind": "value", "rows": 1, "color": "success", "title": "In-kind value", "column": 4, "format": "currency", "columns": 3, "pattern": "$0,0.00", "accessor": "user.inKind", "description": ""}, {"id": "00000000-0000-4000-8000-000000000003", "row": 1, "icon": "users", "kind": "value", "rows": 1, "color": "highlight", "title": "Volunteers", "column": 7, "format": "number", "columns": 3, "pattern": "0,0.[00]", "accessor": "user.volunteers", "description": ""}, {"id": "00000000-0000-4000-8000-000000000004", "row": 1, "icon": "list-checks", "kind": "value", "rows": 1, "color": "accent", "title": "Entries", "column": 10, "format": "number", "columns": 3, "pattern": "0,0.[00]", "accessor": "user.entries", "description": ""}, {"id": "00000000-0000-4000-8000-000000000005", "row": 2, "kind": "chart", "rows": 4, "title": "Hours by department", "column": 1, "format": "hours", "columns": 6, "palette": "single", "pattern": "0,0.[00]", "accessor": "user.byDepartment", "valueKey": "hours", "chartType": "column", "description": ""}, {"id": "00000000-0000-4000-8000-000000000006", "row": 2, "kind": "chart", "rows": 4, "title": "Hours by task category", "column": 7, "format": "hours", "columns": 6, "palette": "single", "pattern": "0,0.[00]", "accessor": "user.byCategory", "valueKey": "hours", "chartType": "column", "description": ""}, {"id": "00000000-0000-4000-8000-000000000007", "row": 6, "kind": "chart", "rows": 4, "title": "In-kind by month", "column": 1, "format": "currency", "columns": 6, "palette": "single", "pattern": "$0,0.00", "accessor": "user.byMonth", "valueKey": "inKind", "chartType": "column", "description": ""}, {"id": "00000000-0000-4000-8000-000000000008", "row": 6, "kind": "chart", "rows": 4, "title": "Hours by volunteer", "column": 7, "format": "hours", "columns": 6, "palette": "single", "pattern": "0,0.[00]", "accessor": "user.byVolunteer", "valueKey": "hours", "chartType": "bar", "description": ""}, {"id": "00000000-0000-4000-8000-000000000009", "row": 10, "kind": "chart", "rows": 4, "title": "Hours by month", "column": 1, "format": "hours", "columns": 6, "palette": "single", "pattern": "0,0.[00]", "accessor": "user.byMonth", "valueKey": "hours", "chartType": "column", "description": ""}, {"id": "00000000-0000-4000-8000-00000000000a", "row": 10, "kind": "chart", "rows": 4, "title": "Hours by project", "column": 7, "format": "hours", "columns": 6, "palette": "single", "pattern": "0,0.[00]", "accessor": "user.byProject", "valueKey": "hours", "chartType": "bar", "description": ""}], "version": 1}', 'Summary', NULL, '2026-10-28T23:59:06.089475+00:00');

INSERT INTO "ReportTemplate" ("baseTemplateId", "createdAt", id, key, layout, name, "organizationId", "updatedAt") VALUES (NULL, '2026-10-28T23:59:06.089475+00:00', '11111111-1111-4111-8111-111111111102', 'people', '{"cards": [{"id": "00000000-0000-4000-8000-000000000014", "row": 1, "icon": "clock", "kind": "value", "rows": 1, "color": "primary", "title": "Total volunteer hours", "column": 1, "format": "hours", "columns": 3, "pattern": "0,0.[00]", "accessor": "user.hours", "description": ""}, {"id": "00000000-0000-4000-8000-000000000015", "row": 1, "icon": "hand-coins", "kind": "value", "rows": 1, "color": "success", "title": "In-kind value", "column": 4, "format": "currency", "columns": 3, "pattern": "$0,0.00", "accessor": "user.inKind", "description": ""}, {"id": "00000000-0000-4000-8000-000000000016", "row": 1, "icon": "users", "kind": "value", "rows": 1, "color": "highlight", "title": "Volunteers", "column": 7, "format": "number", "columns": 3, "pattern": "0,0.[00]", "accessor": "user.volunteers", "description": ""}, {"id": "00000000-0000-4000-8000-000000000017", "row": 1, "icon": "list-checks", "kind": "value", "rows": 1, "color": "accent", "title": "Entries", "column": 10, "format": "number", "columns": 3, "pattern": "0,0.[00]", "accessor": "user.entries", "description": ""}, {"id": "00000000-0000-4000-8000-000000000018", "row": 2, "kind": "list", "rows": 5, "title": "By project", "column": 1, "format": "hours", "columns": 6, "pattern": "0,0.[00]", "accessor": "user.byProject", "description": "", "visibleColumns": ["name", "type", "hours", "share", "people", "inKind"]}, {"id": "00000000-0000-4000-8000-000000000019", "row": 2, "kind": "list", "rows": 5, "title": "By person", "column": 7, "format": "hours", "columns": 6, "pattern": "0,0.[00]", "accessor": "user.byPerson", "description": "", "visibleColumns": ["name", "hours", "share", "inKind"]}, {"id": "00000000-0000-4000-8000-00000000001a", "row": 7, "kind": "list", "rows": 5, "title": "By department", "column": 1, "format": "hours", "columns": 6, "pattern": "0,0.[00]", "accessor": "user.byDepartment", "description": "", "visibleColumns": ["name", "hours", "share", "people", "inKind"]}, {"id": "00000000-0000-4000-8000-00000000001b", "row": 7, "kind": "list", "rows": 5, "title": "By task category", "column": 7, "format": "hours", "columns": 6, "pattern": "0,0.[00]", "accessor": "user.byCategory", "description": "", "visibleColumns": ["name", "hours", "share", "people", "inKind"]}], "version": 1}', 'People', NULL, '2026-10-28T23:59:06.089475+00:00');

INSERT INTO "ReportTemplate" ("baseTemplateId", "createdAt", id, key, layout, name, "organizationId", "updatedAt") VALUES (NULL, '2026-10-28T23:59:06.089475+00:00', '11111111-1111-4111-8111-111111111103', 'groups', '{"cards": [{"id": "00000000-0000-4000-8000-00000000001e", "row": 1, "icon": "clock", "kind": "value", "rows": 1, "color": "primary", "title": "Hours", "column": 1, "format": "hours", "columns": 4, "pattern": "0,0.[00]", "accessor": "collective.hours", "description": ""}, {"id": "00000000-0000-4000-8000-00000000001f", "row": 1, "icon": "hand-coins", "kind": "value", "rows": 1, "color": "success", "title": "In-kind value", "column": 5, "format": "currency", "columns": 4, "pattern": "$0,0.00", "accessor": "collective.inKind", "description": ""}, {"id": "00000000-0000-4000-8000-000000000020", "row": 1, "icon": "list-checks", "kind": "value", "rows": 1, "color": "accent", "title": "Sessions", "column": 9, "format": "number", "columns": 4, "pattern": "0,0.[00]", "accessor": "collective.entries", "description": ""}, {"id": "00000000-0000-4000-8000-000000000021", "row": 2, "kind": "list", "rows": 5, "title": "By project", "column": 1, "format": "hours", "columns": 6, "pattern": "0,0.[00]", "accessor": "collective.byProject", "description": "", "visibleColumns": ["name", "type", "hours", "share", "inKind"]}, {"id": "00000000-0000-4000-8000-000000000022", "row": 2, "kind": "list", "rows": 5, "title": "By department", "column": 7, "format": "hours", "columns": 6, "pattern": "0,0.[00]", "accessor": "collective.byDepartment", "description": "", "visibleColumns": ["name", "hours", "share", "inKind"]}, {"id": "00000000-0000-4000-8000-000000000023", "row": 7, "kind": "list", "rows": 5, "title": "By task category", "column": 1, "format": "hours", "columns": 6, "pattern": "0,0.[00]", "accessor": "collective.byCategory", "description": "", "visibleColumns": ["name", "hours", "share", "inKind"]}], "version": 1}', 'Group sessions', NULL, '2026-10-28T23:59:06.089475+00:00');

INSERT INTO "ReportTemplate" ("baseTemplateId", "createdAt", id, key, layout, name, "organizationId", "updatedAt") VALUES (NULL, '2026-10-28T23:59:06.089475+00:00', '11111111-1111-4111-8111-111111111104', 'staff', '{"cards": [{"id": "00000000-0000-4000-8000-000000000028", "row": 1, "icon": "clock", "kind": "value", "rows": 1, "color": "primary", "title": "Staff hours", "column": 1, "format": "hours", "columns": 3, "pattern": "0,0.[00]", "accessor": "staff.hours", "description": ""}, {"id": "00000000-0000-4000-8000-000000000029", "row": 1, "icon": "hand-coins", "kind": "value", "rows": 1, "color": "success", "title": "In-kind value", "column": 4, "format": "currency", "columns": 3, "pattern": "$0,0.00", "accessor": "staff.inKind", "description": ""}, {"id": "00000000-0000-4000-8000-00000000002a", "row": 1, "icon": "users", "kind": "value", "rows": 1, "color": "highlight", "title": "Staff", "column": 7, "format": "number", "columns": 3, "pattern": "0,0.[00]", "accessor": "staff.volunteers", "description": ""}, {"id": "00000000-0000-4000-8000-00000000002b", "row": 1, "icon": "list-checks", "kind": "value", "rows": 1, "color": "accent", "title": "Entries", "column": 10, "format": "number", "columns": 3, "pattern": "0,0.[00]", "accessor": "staff.entries", "description": ""}, {"id": "00000000-0000-4000-8000-00000000002c", "row": 2, "kind": "list", "rows": 5, "title": "By department", "column": 1, "format": "hours", "columns": 6, "pattern": "0,0.[00]", "accessor": "staff.byDepartment", "description": "", "visibleColumns": ["name", "hours", "share", "inKind"]}, {"id": "00000000-0000-4000-8000-00000000002d", "row": 2, "kind": "list", "rows": 5, "title": "By project", "column": 7, "format": "hours", "columns": 6, "pattern": "0,0.[00]", "accessor": "staff.byProject", "description": "", "visibleColumns": ["name", "type", "hours", "share", "inKind"]}, {"id": "00000000-0000-4000-8000-00000000002e", "row": 7, "kind": "list", "rows": 5, "title": "By person", "column": 1, "format": "hours", "columns": 6, "pattern": "0,0.[00]", "accessor": "staff.byPerson", "description": "", "visibleColumns": ["name", "hours", "share", "inKind"]}], "version": 1}', 'Staff', NULL, '2026-10-28T23:59:06.089475+00:00');
