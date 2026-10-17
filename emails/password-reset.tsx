import { Link, Section, Text } from "@react-email/components";
import { bodyText, codeBox, codeText, EmailLayout, linkText, quietText } from "./components/layout";

export const passwordReset = {
  id: "password-reset",
  subject: "Your Clocked In password reset code",
  variables: ["code", "url"],
};

export default function PasswordResetEmail({
  code = "482913",
  url = "http://localhost:3025/forgot-password?code=482913",
}: {
  code?: string;
  url?: string;
}) {
  return (
    <EmailLayout preview="Your Clocked In password reset code is inside." title="Reset your password">
      <Text style={bodyText}>Use this code to reset your Clocked In password:</Text>
      <Section style={codeBox}>
        <Text style={codeText}>{code}</Text>
      </Section>
      <Text style={quietText}>The code expires in 15 minutes. If you did not ask for this, you can ignore this email.</Text>
      <Text style={bodyText}>
        Enter the code at <Link href={url} style={linkText}>{url}</Link>
      </Text>
    </EmailLayout>
  );
}
