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

/** Hostname of APP_URL, used when APP_HOST was not set on the deployment. */
export function apexHostFromAppUrl(configuredAppUrl: string | null | undefined = process.env.APP_URL) {
  const raw = configuredAppUrl?.trim();
  if (!raw) return "";
  try {
    return stripPort(new URL(raw).hostname);
  } catch {
    return "";
  }
}

function firstForwardedValue(value: string | null | undefined) {
  return (value ?? "").split(",")[0]?.trim() ?? "";
}

function portOf(host: string) {
  const colon = host.lastIndexOf(":");
  if (colon === -1) return "";
  const port = host.slice(colon + 1);
  return /^\d+$/.test(port) ? port : "";
}

function significantPort(protocol: "http" | "https", port: string) {
  if (!port || (protocol === "http" && port === "80") || (protocol === "https" && port === "443")) {
    return "";
  }

  return `:${port}`;
}

function originForHost(configuredUrl: string | null | undefined, host: string) {
  const raw = configuredUrl?.trim();
  if (!raw || !host) return "";
  try {
    const parsed = new URL(raw);
    return parsed.hostname.toLowerCase() === host ? parsed.origin : "";
  } catch {
    return "";
  }
}

function originFromUrl(configuredUrl: string | null | undefined) {
  const raw = configuredUrl?.trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

function isHostOnApex(hostname: string, apex: string) {
  if (!hostname || !apex) return false;
  if (hostname === apex || hostname === `www.${apex}`) return true;
  const suffix = `.${apex}`;
  if (!hostname.endsWith(suffix)) return false;
  const label = hostname.slice(0, -suffix.length);
  return label.length > 0 && !label.includes(".");
}

function requestApex(hostname: string) {
  if (!hostname) return "";
  if (hostname === "localhost" || hostname === "127.0.0.1") return "localhost";
  if (classifyTenantHost(hostname, "localhost")) return "localhost";
  if (hostname.startsWith("www.") && hostname.length > 4) return hostname.slice(4);
  return hostname;
}

function configuredOption(
  options: { configuredAppHost?: string | null; configuredAppUrl?: string | null } | undefined,
  key: "configuredAppHost" | "configuredAppUrl",
  envValue: string | undefined,
) {
  if (options && key in options) return options[key];
  return envValue;
}

/** Apex origin for white-label addresses: APP_HOST, otherwise the request host, otherwise APP_URL. */
export function displayAppOrigin(options?: {
  requestHost?: string | null;
  requestProtocol?: string | null;
  configuredAppHost?: string | null;
  configuredAppUrl?: string | null;
}) {
  const configuredHost = stripPort(configuredOption(options, "configuredAppHost", process.env.APP_HOST));
  const configuredUrl = configuredOption(options, "configuredAppUrl", process.env.APP_URL);
  const requestHost = firstForwardedValue(options?.requestHost).toLowerCase();
  const requestProtocol = firstForwardedValue(options?.requestProtocol).toLowerCase().replace(/:$/, "");
  const requestHostname = stripPort(requestHost);
  const requestPort = portOf(requestHost);

  if (configuredHost) {
    const fromUrl = originForHost(configuredUrl, configuredHost);
    if (fromUrl) return fromUrl;

    const onConfiguredHost = isHostOnApex(requestHostname, configuredHost);
    const protocol: "http" | "https" =
      onConfiguredHost && (requestProtocol === "http" || requestProtocol === "https")
        ? requestProtocol
        : configuredHost === "localhost"
          ? "http"
          : "https";
    const port = onConfiguredHost ? requestPort : configuredHost === "localhost" ? "3025" : "";
    return `${protocol}://${configuredHost}${significantPort(protocol, port)}`;
  }

  const apex = requestApex(requestHostname);
  if (apex) {
    const fromUrl = !requestPort ? originForHost(configuredUrl, apex) : "";
    if (fromUrl) return fromUrl;

    const protocol: "http" | "https" =
      requestProtocol === "http" || requestProtocol === "https"
        ? requestProtocol
        : apex === "localhost"
          ? "http"
          : "https";
    return `${protocol}://${apex}${significantPort(protocol, requestPort)}`;
  }

  return originFromUrl(configuredUrl) || "http://localhost:3025";
}

export function tenantAddress(apexOrigin: string, slug?: string | null) {
  const base = apexOrigin.trim().replace(/\/$/, "");
  const normalized = slug?.trim().toLowerCase() ?? "";
  if (!base) return "";
  if (!normalized) return base;

  try {
    const parsed = new URL(base);
    return `${parsed.protocol}//${normalized}.${parsed.host}`;
  } catch {
    return base;
  }
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

export function resolveRequestTenantSlug(
  headers: Pick<Headers, "get">,
  configuredAppHost: string | null | undefined = process.env.APP_HOST,
  configuredAppUrl: string | null | undefined = process.env.APP_URL,
): string | null {
  const host = firstForwardedValue(headers.get("x-forwarded-host") ?? headers.get("host"));
  const trimmedAppHost = stripPort(configuredAppHost);
  if (trimmedAppHost) {
    return classifyTenantHost(host, trimmedAppHost);
  }

  // A deployed apex is APP_URL even when APP_HOST was never set. Localhost stays on the
  // development fallback below so the x-voluntime-tenant header still works.
  const apexFromUrl = apexHostFromAppUrl(configuredAppUrl);
  if (apexFromUrl && apexFromUrl !== "localhost" && apexFromUrl !== "127.0.0.1") {
    return classifyTenantHost(host, apexFromUrl);
  }

  if (process.env.NODE_ENV !== "production") {
    const localSubdomain = classifyTenantHost(host, "localhost");
    if (localSubdomain) {
      return localSubdomain;
    }

    const hostname = stripPort(host);
    if (!hostname || hostname === "127.0.0.1" || hostname === "localhost") {
      return headers.get(tenantHeader)?.trim().toLowerCase() || null;
    }
  }

  return null;
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
