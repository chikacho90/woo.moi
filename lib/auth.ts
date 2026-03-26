const COOKIE_NAME = "labs_token";

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function makeLabsToken(secret: string) {
  const data = new TextEncoder().encode(`${secret}|wooo-labs-v1`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

export { COOKIE_NAME };
