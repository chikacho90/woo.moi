import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const COOKIE_NAME = "smokemap_anon";
const MAX_AGE = 60 * 60 * 24 * 365 * 2; // 2 years

export async function getOrCreateAnonId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const id = randomUUID();
  store.set(COOKIE_NAME, id, {
    maxAge: MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return id;
}
