import { fail, validation } from "@/lib/api/errors";

export async function verifyCaptcha(token: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    const env = process.env.APP_ENV;
    if (env === "production" || env === "staging") {
      fail(503, "captcha_unavailable", "Captcha is not configured.");
    }
    return;
  }

  if (!token?.trim()) validation("Captcha verification failed.");
  let response: Response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
  } catch {
    validation("Captcha verification failed.");
  }

  const payload = (await response.json()) as { success?: boolean };
  if (!payload.success) validation("Captcha verification failed.");
}
