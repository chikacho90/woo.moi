export const COOKIE_NAME = "site_token";

export async function makeSiteToken(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`woo-moi-v1:${secret}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
