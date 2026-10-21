import { Text } from "@react-email/components";
import { bodyText, EmailLayout, quietText } from "./components/layout";

export const feedbackReceived = {
  id: "feedback-received",
  subject: "Thanks for your {{typeLabel}}",
  variables: ["firstName", "title", "typeLabel"],
};

export default function FeedbackReceivedEmail({
  firstName = "Ada",
  title = "Timer keeps running",
  typeLabel = "bug",
}: {
  firstName?: string;
  title?: string;
  typeLabel?: string;
}) {
  return (
    <EmailLayout preview={`Thanks for telling us about ${title}.`} title='We got your feedback'>
      <Text style={bodyText}>Hi {firstName},</Text>
      <Text style={bodyText}>
        Thank you for sending this {typeLabel}: {title}. We read every report and use it to make VolunTime better.
      </Text>
      <Text style={quietText}>We will email you again if this is completed.</Text>
    </EmailLayout>
  );
}
