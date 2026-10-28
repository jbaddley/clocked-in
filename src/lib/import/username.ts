const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,49}$/;

export function nextAvailableUsername(base: string, taken: (username: string) => boolean) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const username = attempt === 0 ? base : `${base.slice(0, 48)}${attempt}`;
    if (!taken(username)) return { username, collided: attempt > 0, base };
  }
  return { username: base, collided: true, base };
}

export function usernameFromName(firstName: string, lastName: string) {
  const initial = (firstName.trim()[0] ?? "u").toLowerCase().replace(/[^a-z0-9]/g, "u");
  let last = lastName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!last) last = "user";
  let cleaned = `${initial}${last}`;
  if (!/^[a-z0-9]/.test(cleaned)) cleaned = `u${cleaned}`;
  if (cleaned.length < 3) cleaned = `${cleaned}user`.slice(0, 50);
  if (cleaned.length > 50) cleaned = cleaned.slice(0, 50);
  return usernamePattern.test(cleaned) ? cleaned : "user";
}

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
