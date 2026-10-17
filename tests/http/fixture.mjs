import dotenv from "dotenv";

dotenv.config();

const targets = {
  csharp: "http://127.0.0.1:5103",
  next: "http://127.0.0.1:3025",
};

function resolveTarget() {
  const raw = process.env.API_TARGET ?? "next";
  if (raw !== "csharp" && raw !== "next") {
    throw new Error('API_TARGET must be "csharp" or "next".');
  }

  return raw;
}

/**
 * Points every HTTP contract test at one backend.
 * API_TARGET=csharp uses ClockedIn.Api. API_TARGET=next uses the Next.js API.
 * API_BASE_URL overrides the default port for that target.
 */
export const apiTarget = resolveTarget();

export const apiBaseUrl = process.env.API_BASE_URL || targets[apiTarget];

export const mailSinkUrl = process.env.MAIL_SINK_URL || "http://127.0.0.1:5399";

export function databaseUrl() {
  const raw = apiTarget === "csharp" ? process.env.EF_DATABASE_URL : process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(`No database URL is set for API_TARGET=${apiTarget}.`);
  }

  const url = new URL(raw);
  url.searchParams.delete("schema");
  return url.toString();
}
