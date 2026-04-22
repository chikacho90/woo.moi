import { neon } from "@neondatabase/serverless";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { makeSiteToken, COOKIE_NAME } from "@/lib/auth";

// Single Neon client for this project. DATABASE_URL is provisioned by Vercel.
export const sql = neon(process.env.DATABASE_URL!);

let schemaReady = false;

/**
 * Lazily create the ledger_transactions table + indexes on the first API call
 * per cold start. Idempotent (IF NOT EXISTS). Avoids a separate migration step.
 */
export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS ledger_transactions (
      id          SERIAL PRIMARY KEY,
      date        DATE NOT NULL,
      type        TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
      amount      BIGINT NOT NULL,
      category    TEXT NOT NULL,
      subcategory TEXT,
      account     TEXT,
      memo        TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS ledger_transactions_date_idx ON ledger_transactions (date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS ledger_transactions_category_idx ON ledger_transactions (category)`;
  await sql`CREATE INDEX IF NOT EXISTS ledger_transactions_type_idx ON ledger_transactions (type)`;
  schemaReady = true;
}

/**
 * SITE_SECRET cookie gate. Returns null if authorized, or a 401 response to
 * propagate back from the route. Matches /aibot + /api/auth patterns.
 */
export async function authCheck(): Promise<NextResponse | null> {
  const secret = process.env.SITE_SECRET;
  if (!secret) return null;
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const expected = await makeSiteToken(secret);
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
