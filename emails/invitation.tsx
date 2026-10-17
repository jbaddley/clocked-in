import { Link, Section, Text } from "@react-email/components";
import { bodyText, codeBox, codeText, EmailLayout, linkText, quietText } from "./components/layout";

export const invitation = {
  id: "invitation",
  subject: "You are invited to join the {{targetKind}} {{targetName}}",
  variables: ["targetKind", "targetName", "roleName", "code", "url"],
};

export default function InvitationEmail({
  targetKind = "Organization",
  targetName = "Harbor Volunteers",
  roleName = "Member",
  code = "482913",
  url = "http://localhost:3025/accept?code=482913",
}: {
  targetKind?: string;
  targetName?: string;
  roleName?: string;
  code?: string;
  url?: string;
}) {
  return (
    <EmailLayout preview={`You are invited to join the ${targetKind} ${targetName}.`} title="You have an invite">
      <Text style={bodyText}>
        You have been invited to join the {targetKind} {targetName} as {roleName}.
      </Text>
      <Text style={bodyText}>Use this code to accept the invite:</Text>
      <Section style={codeBox}>
        <Text style={codeText}>{code}</Text>
      </Section>
      <Text style={quietText}>The code expires in 7 days.</Text>
      <Text style={bodyText}>
        Enter the code at <Link href={url} style={linkText}>{url}</Link>
      </Text>
    </EmailLayout>
  );
}
