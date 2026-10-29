export const tenantHeader = "x-voluntime-tenant";

export const reservedTenantSlugs = new Set([
  "www",
  "app",
  "api",
  "staging",
  "mail",
  "admin",
  "static",
  "blob",
  "status",
  "support",
  "help",
  "docs",
]);

const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function portalName() {
  return "VolunTime";
}

export function isValidTenantSlug(value: string) {
  return value.length >= 1 && value.length <= 63 && slugPattern.test(value) && !reservedTenantSlugs.has(value);
}

export function stripPort(host: string | null | undefined) {
  const trimmed = (host ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!trimmed) return "";
  const colon = trimmed.indexOf(":");
  return colon === -1 ? trimmed : trimmed.slice(0, colon);
}

export function appHost(configured = process.env.APP_HOST) {
  return stripPort(configured);
}

export function classifyTenantHost(
  hostHeader: string | null | undefined,
  configuredAppHost: string | null | undefined = process.env.APP_HOST,
): string | null {
  const hostname = stripPort(hostHeader);
  const baseHost = stripPort(configuredAppHost);
  if (!hostname || !baseHost) {
    return null;
  }

  if (
    hostname === baseHost ||
    hostname === `www.${baseHost}` ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  ) {
    return null;
  }

  const suffix = `.${baseHost}`;
  if (!hostname.endsWith(suffix)) {
    return null;
  }

  const label = hostname.slice(0, -suffix.length);
  if (!label || label.includes(".") || reservedTenantSlugs.has(label)) {
    return null;
  }

  return label;
}

export function tenantOrigin(
  slug: string | null | undefined,
  configuredAppUrl: string | null | undefined = process.env.APP_URL,
  configuredAppHost: string | null | undefined = process.env.APP_HOST,
) {
  const rawBase = (configuredAppUrl?.trim() || "http://localhost:3025").replace(/\/$/, "");
  const normalizedSlug = slug?.trim().toLowerCase();
  if (!normalizedSlug) {
    return rawBase;
  }

  try {
    const parsed = new URL(rawBase);
    const baseHost = stripPort(configuredAppHost) || parsed.hostname.toLowerCase();
    const port = parsed.port && parsed.hostname.toLowerCase() === baseHost ? `:${parsed.port}` : "";
    return `${parsed.protocol}//${normalizedSlug}.${baseHost}${port}`;
  } catch {
    const baseHost = stripPort(configuredAppHost) || "voluntime.app";
    return `https://${normalizedSlug}.${baseHost}`;
  }
}
