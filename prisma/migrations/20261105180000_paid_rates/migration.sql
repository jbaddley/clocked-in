-- Paid is compensation: hours times the snapshotted rate, stored with zero in-kind.
ALTER TABLE "HourlyRate" DROP CONSTRAINT "HourlyRate_rate_check";
ALTER TABLE "HourlyRate" ADD CONSTRAINT "HourlyRate_rate_check" CHECK (((type = ANY (ARRAY['Volunteer'::text, 'Professional'::text, 'Paid'::text])) AND ("perHourRate" > (0)::numeric) AND (("isDefault" = false) OR (type = 'Volunteer'::text)) AND ((source IS NULL) OR ((char_length(source) >= 1) AND (char_length(source) <= 200)))));

ALTER TABLE "Organization" DROP CONSTRAINT "Organization_rate_check";
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_rate_check" CHECK (("defaultRateType" = ANY (ARRAY['Volunteer'::text, 'Professional'::text, 'Paid'::text])));

ALTER TABLE "OrganizationMembership" DROP CONSTRAINT "OrganizationMembership_rate_check";
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_rate_check" CHECK ((("rateType" = ANY (ARRAY['Volunteer'::text, 'Professional'::text, 'Paid'::text])) AND ((("rateType" = 'Volunteer'::text) AND ("professionalBillingRate" IS NULL)) OR (("rateType" = ANY (ARRAY['Professional'::text, 'Paid'::text])) AND ("professionalBillingRate" IS NOT NULL) AND ("professionalBillingRate" > (0)::numeric)))));

INSERT INTO "RolePermission" (allowed, id, permission, "roleId")
SELECT true, 'c3b1a9e2-7d44-4f1a-9c20-6e5d8a1b0f77', 'view_payroll', "id"
FROM "Role"
WHERE code = 'ADMIN' AND "organizationId" IS NULL AND "isSystem" = true
ON CONFLICT ("roleId", "permission") DO NOTHING;
