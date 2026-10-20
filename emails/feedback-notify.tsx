import { Link, Text } from "@react-email/components";
import { bodyText, EmailLayout, linkText, quietText } from "./components/layout";

export const feedbackNotify = {
  id: "feedback-notify",
  subject: "New {{typeLabel}}: {{title}}",
  variables: ["submitterName", "typeLabel", "priorityLabel", "areaLabel", "title", "description", "url"],
};

export default function FeedbackNotifyEmail({
  submitterName = "Ada Lovelace",
  typeLabel = "bug",
  priorityLabel = "High",
  areaLabel = "Log time",
  title = "Timer keeps running",
  description = "The timer did not stop when I clocked out.",
  url = "http://localhost:3025/feedback",
}: {
  submitterName?: string;
  typeLabel?: string;
  priorityLabel?: string;
  areaLabel?: string;
  title?: string;
  description?: string;
  url?: string;
}) {
  return (
    <EmailLayout preview={`${submitterName} submitted a ${typeLabel}.`} title="New feedback received">
      <Text style={bodyText}>
        {submitterName} submitted a {typeLabel}: {title}
      </Text>
      <Text style={quietText}>
        Priority {priorityLabel} · {areaLabel}
      </Text>
      <Text style={bodyText}>{description}</Text>
      <Text style={bodyText}>
        Review it at <Link href={url} style={linkText}>{url}</Link>
      </Text>
    </EmailLayout>
  );
}
