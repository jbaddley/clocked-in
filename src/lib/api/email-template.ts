export type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
  variables: string[];
};

export function htmlEncode(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function forSubject(value: string) {
  return value.replace(/[\r\n]+/g, " ");
}

export function fillTemplate(template: EmailTemplate, variables: Record<string, string>) {
  for (const name of template.variables) {
    if (typeof variables[name] !== "string") {
      throw new Error(`Missing email variable ${name}.`);
    }
  }

  const fill = (source: string, encode: (value: string) => string) =>
    source.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, name: string) => {
      const value = variables[name];
      return typeof value === "string" ? encode(value) : match;
    });

  return {
    subject: fill(template.subject, forSubject),
    html: fill(template.html, htmlEncode),
    text: fill(template.text, (value) => value),
  };
}
