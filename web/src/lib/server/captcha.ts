import "server-only";

export const CAPTCHA_HEADER = "X-Captcha-Token";

export function captchaHeaders(form: FormData): Record<string, string> {
  const token = form.get("cf-turnstile-response");
  return typeof token === "string" && token.trim() !== "" ? { [CAPTCHA_HEADER]: token.trim() } : {};
}
