import dotenv from "dotenv";

dotenv.config();

export const apiBaseUrl = process.env.API_BASE_URL || "http://127.0.0.1:3025";

export const mailSinkUrl = process.env.MAIL_SINK_URL || "http://127.0.0.1:5399";

export const githubSinkUrl = process.env.GITHUB_SINK_URL || "http://127.0.0.1:5400";

export function databaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not set.");
  }

  const url = new URL(raw);
  url.searchParams.delete("schema");
  return url.toString();
}
