export const COOKIE_NAME = "labs_token";

export async function makeLabsToken(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`wooo-labs-v1:${secret}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
