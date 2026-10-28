import { Text } from "@react-email/components";
import { bodyText, EmailLayout } from "./components/layout";

export const accessRequestDecided = {
  id: "access-request-decided",
  subject: "Your access request was {{decision}}",
  variables: ["organizationName", "decision", "name"],
};

export default function AccessRequestDecidedEmail({
  organizationName = "Harbor Volunteers",
  decision = "approved",
  name = "there",
}: {
  organizationName?: string;
  decision?: string;
  name?: string;
}) {
  return (
    <EmailLayout
      preview={`Your request for more access in ${organizationName} was ${decision}.`}
      title="Access request update"
    >
      <Text style={bodyText}>
        Hi {name}, your request for more access in {organizationName} was {decision}.
      </Text>
    </EmailLayout>
  );
}
