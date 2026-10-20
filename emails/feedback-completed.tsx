import { Text } from "@react-email/components";
import { bodyText, EmailLayout, quietText } from "./components/layout";

export const feedbackCompleted = {
  id: "feedback-completed",
  subject: "Update on your {{typeLabel}}",
  variables: ["firstName", "title", "typeLabel", "outcome", "note"],
};

export default function FeedbackCompletedEmail({
  firstName = "Ada",
  title = "Timer keeps running",
  typeLabel = "bug",
  outcome = "we completed the work you asked for",
  note = "This shipped in the latest release.",
}: {
  firstName?: string;
  title?: string;
  typeLabel?: string;
  outcome?: string;
  note?: string;
}) {
  return (
    <EmailLayout preview={`An update on ${title}.`} title="Your feedback is complete">
      <Text style={bodyText}>Hi {firstName},</Text>
      <Text style={bodyText}>
        About your {typeLabel} "{title}": {outcome}.
      </Text>
      <Text style={bodyText}>{note}</Text>
      <Text style={quietText}>Thank you for helping us improve Clocked In.</Text>
    </EmailLayout>
  );
}
