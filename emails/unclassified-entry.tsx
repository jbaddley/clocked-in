import { Link, Text } from "@react-email/components";
import { bodyText, EmailLayout, linkText } from "./components/layout";

export const unclassifiedEntry = {
  id: "unclassified-entry",
  subject: "Please classify your volunteer time",
  variables: ["name", "url"],
};

export default function UnclassifiedEntryEmail({
  name = "there",
  url = "https://example.com/entries",
}: {
  name?: string;
  url?: string;
}) {
  return (
    <EmailLayout preview="Your last time entry needs a project, task category, or group." title="Unclassified time">
      <Text style={bodyText}>
        Hi {name}, your last timer save has no project, task category, or group. Classify it or delete it so grant reports stay accurate.
      </Text>
      <Text style={bodyText}>
        <Link href={url} style={linkText}>
          Review unclassified entries
        </Link>
      </Text>
    </EmailLayout>
  );
}
