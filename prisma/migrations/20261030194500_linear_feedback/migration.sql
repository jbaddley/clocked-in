-- DropConstraint
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_values_check";

-- DropForeignKey
ALTER TABLE "FeedbackAction" DROP CONSTRAINT "FK_FeedbackAction_User_takenByUserId";

-- AlterTable
ALTER TABLE "Feedback" DROP COLUMN "githubIssueNumber",
ADD COLUMN     "linearIssueId" TEXT,
ADD COLUMN     "linearIssueIdentifier" TEXT;

-- AlterTable
ALTER TABLE "FeedbackAction" ALTER COLUMN "takenByUserId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "IX_Feedback_linearIssueId" ON "Feedback"("linearIssueId") WHERE ("linearIssueId" IS NOT NULL);

-- AddForeignKey
ALTER TABLE "FeedbackAction" ADD CONSTRAINT "FK_FeedbackAction_User_takenByUserId" FOREIGN KEY ("takenByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddConstraint
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_values_check" CHECK (((type = ANY (ARRAY['Bug'::text, 'Feature'::text])) AND (priority = ANY (ARRAY['Urgent'::text, 'High'::text, 'Medium'::text, 'Low'::text])) AND (area = ANY (ARRAY['Dashboard'::text, 'LogTime'::text, 'Entries'::text, 'Reports'::text, 'Settings'::text, 'Other'::text])) AND (status = ANY (ARRAY['Pending'::text, 'Acknowledged'::text, 'Planned'::text, 'InProgress'::text, 'Resolved'::text, 'Cancelled'::text, 'CouldNotReproduce'::text, 'Archived'::text])) AND ((char_length(title) >= 1) AND (char_length(title) <= 120)) AND ((char_length(description) >= 1) AND (char_length(description) <= 4000)) AND ("left"(("screenshotUrls")::text, 1) = '['::text) AND (("linearIssueId" IS NULL) OR (char_length(btrim("linearIssueId")) >= 1)) AND (("linearIssueIdentifier" IS NULL) OR (char_length(btrim("linearIssueIdentifier")) >= 1))));
