import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema, authCheck } from "../_db";
import type { Transaction, TxnType } from "@/app/ledger/types";

export const dynamic = "force-dynamic";

type SqlRow = Record<string, unknown>;

function rowToTransaction(r: SqlRow): Transaction {
  return {
    id: Number(r.id),
    date: typeof r.date === "string" ? r.date : (r.date as Date).toISOString().slice(0, 10),
    type: r.type as TxnType,
    amount: Number(r.amount),
    category: r.category as string,
    subcategory: (r.subcategory as string | null) ?? null,
    account: (r.account as string | null) ?? null,
    memo: (r.memo as string | null) ?? null,
    created_at: (r.created_at as Date).toISOString(),
    updated_at: (r.updated_at as Date).toISOString(),
  };
}

/** PATCH /api/ledger/[id]  Partial<Transaction> */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = await authCheck();
  if (blocked) return blocked;
  await ensureSchema();

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const patch = (await req.json()) as Partial<Transaction>;

  // Build the update dynamically with Neon's tagged templates — do one field at a time.
  // Safer than raw string interpolation; sufficient for small edits.
  if (patch.date !== undefined)
    await sql`UPDATE ledger_transactions SET date = ${patch.date}, updated_at = now() WHERE id = ${id}`;
  if (patch.type !== undefined)
    await sql`UPDATE ledger_transactions SET type = ${patch.type}, updated_at = now() WHERE id = ${id}`;
  if (patch.amount !== undefined)
    await sql`UPDATE ledger_transactions SET amount = ${Math.trunc(Math.abs(patch.amount))}, updated_at = now() WHERE id = ${id}`;
  if (patch.category !== undefined)
    await sql`UPDATE ledger_transactions SET category = ${patch.category}, updated_at = now() WHERE id = ${id}`;
  if (patch.subcategory !== undefined)
    await sql`UPDATE ledger_transactions SET subcategory = ${patch.subcategory}, updated_at = now() WHERE id = ${id}`;
  if (patch.account !== undefined)
    await sql`UPDATE ledger_transactions SET account = ${patch.account}, updated_at = now() WHERE id = ${id}`;
  if (patch.memo !== undefined)
    await sql`UPDATE ledger_transactions SET memo = ${patch.memo}, updated_at = now() WHERE id = ${id}`;

  const rows = (await sql`SELECT * FROM ledger_transactions WHERE id = ${id}`) as SqlRow[];
  if (rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ transaction: rowToTransaction(rows[0]) });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = await authCheck();
  if (blocked) return blocked;
  await ensureSchema();

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const rows = (await sql`DELETE FROM ledger_transactions WHERE id = ${id} RETURNING id`) as SqlRow[];
  if (rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
