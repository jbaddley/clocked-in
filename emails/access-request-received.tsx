import { Text } from "@react-email/components";
import { bodyText, EmailLayout } from "./components/layout";

export const accessRequestReceived = {
  id: "access-request-received",
  subject: "Access request for {{organizationName}}",
  variables: ["organizationName", "requesterEmail"],
};

export default function AccessRequestReceivedEmail({
  organizationName = "Harbor Volunteers",
  requesterEmail = "volunteer@example.com",
}: {
  organizationName?: string;
  requesterEmail?: string;
}) {
  return (
    <EmailLayout preview={`${requesterEmail} asked for more access in ${organizationName}.`} title="Access request">
      <Text style={bodyText}>
        {requesterEmail} requested more access in {organizationName}. Review the request in People settings.
      </Text>
    </EmailLayout>
  );
}
