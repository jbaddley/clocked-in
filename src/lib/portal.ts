export function publicSignupEnabled() {
  const value = process.env.PUBLIC_SIGNUP?.trim().toLowerCase();
  return value !== "false" && value !== "0" && value !== "no";
}

export function defaultOrganizationId() {
  return process.env.DEFAULT_ORGANIZATION_ID?.trim() || "";
}

export function portalName() {
  return process.env.PORTAL_NAME?.trim() || "VolunTime";
}
