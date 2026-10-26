import { Text } from "@react-email/components";
import { bodyText, EmailLayout, quietText } from "./components/layout";

export const volunteerMessage = {
  id: "volunteer-message",
  subject: "{{subject}}",
  variables: ["subject", "body", "needName"],
};

const messageText = { ...bodyText, whiteSpace: "pre-wrap" as const };

export default function VolunteerMessageEmail({
  body = "Thanks for offering to help. We will see you there.",
  needName = "Saturday setup",
}: {
  body?: string;
  needName?: string;
}) {
  return (
    <EmailLayout preview={`A message about ${needName}.`} title={needName}>
      <Text style={messageText}>{body}</Text>
      <Text style={quietText}>This message is about a volunteer need you signed up for. You are not on a mailing list.</Text>
    </EmailLayout>
  );
}
