const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,49}$/;

export function usernameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  let cleaned = local.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  cleaned = cleaned.replace(/^[._-]+/, "");
  if (!/^[a-z0-9]/.test(cleaned)) {
    cleaned = `u${cleaned}`;
  }

  if (cleaned.length < 3) {
    cleaned = `${cleaned}user`.slice(0, 50);
  }

  if (cleaned.length > 50) {
    cleaned = cleaned.slice(0, 50);
  }

  return usernamePattern.test(cleaned) ? cleaned : "user";
}
