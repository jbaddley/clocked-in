import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

const primary = "#001836";
const highlight = "#D4AC59";
const success = "#4EBFAE";
const surface = "#FFFFFF";
const foreground = "#001836";
const muted = "#5C6B7A";
const page = "#F4F6F8";
const fontFamily = '"Nunito Sans", "Segoe UI", Helvetica, Arial, sans-serif';

export function EmailLayout({ preview, title, children }: { preview: string; title: string; children: ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: page, fontFamily, margin: 0, padding: "32px 12px" }}>
        <Container
          style={{
            backgroundColor: surface,
            borderRadius: "12px",
            margin: "0 auto",
            maxWidth: "560px",
            overflow: "hidden",
          }}
        >
          <Section style={{ backgroundColor: primary, padding: "28px 32px 24px" }}>
            <Text
              style={{
                color: highlight,
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.16em",
                lineHeight: "16px",
                margin: 0,
              }}
            >
              VolunTime
            </Text>
            <Heading
              style={{
                color: surface,
                fontSize: "28px",
                fontWeight: 650,
                lineHeight: "34px",
                margin: "14px 0 0",
              }}
            >
              {title}
            </Heading>
            <Section style={{ backgroundColor: success, height: "3px", marginTop: "22px", width: "48px" }} />
          </Section>
          <Section style={{ padding: "28px 32px 8px" }}>{children}</Section>
          <Hr style={{ borderColor: "#E6E8EB", margin: "8px 32px 0" }} />
          <Text style={{ color: muted, fontSize: "13px", lineHeight: "20px", margin: "16px 32px 28px" }}>
            Every volunteer hour, counted and valued.
          </Text>
        </Container>
        <Text style={{ color: muted, fontSize: "12px", lineHeight: "18px", margin: "16px 0 0", textAlign: "center" }}>
          This message was sent by VolunTime.
        </Text>
      </Body>
    </Html>
  );
}

export const bodyText = {
  color: foreground,
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

export const codeText = {
  color: primary,
  fontSize: "32px",
  fontWeight: 700,
  letterSpacing: "0.18em",
  lineHeight: "40px",
  margin: 0,
  textAlign: "center" as const,
};

export const codeBox = {
  backgroundColor: "#FBF7EE",
  border: `1px solid ${highlight}`,
  borderRadius: "10px",
  margin: "0 0 20px",
  padding: "18px 12px",
};

export const quietText = {
  color: muted,
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 8px",
};

export const linkText = {
  color: primary,
  textDecoration: "underline",
};
