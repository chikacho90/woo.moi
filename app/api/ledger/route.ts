import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema, authCheck } from "./_db";
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

/** GET /api/ledger?from=2026-04-01&to=2026-04-30&type=expense&category=식비 */
export async function GET(req: NextRequest) {
  const blocked = await authCheck();
  if (blocked) return blocked;
  await ensureSchema();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from"); // YYYY-MM-DD
  const to = searchParams.get("to");
  const type = searchParams.get("type");
  const category = searchParams.get("category");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 500, 2000) : 500;

  // Neon's tagged template needs distinct queries per WHERE combo.
  let rows: SqlRow[];
  if (from && to && type && category) {
    rows = (await sql`SELECT * FROM ledger_transactions WHERE date >= ${from} AND date <= ${to} AND type = ${type} AND category = ${category} ORDER BY date DESC, id DESC LIMIT ${limit}`) as SqlRow[];
  } else if (from && to && type) {
    rows = (await sql`SELECT * FROM ledger_transactions WHERE date >= ${from} AND date <= ${to} AND type = ${type} ORDER BY date DESC, id DESC LIMIT ${limit}`) as SqlRow[];
  } else if (from && to) {
    rows = (await sql`SELECT * FROM ledger_transactions WHERE date >= ${from} AND date <= ${to} ORDER BY date DESC, id DESC LIMIT ${limit}`) as SqlRow[];
  } else if (type) {
    rows = (await sql`SELECT * FROM ledger_transactions WHERE type = ${type} ORDER BY date DESC, id DESC LIMIT ${limit}`) as SqlRow[];
  } else {
    rows = (await sql`SELECT * FROM ledger_transactions ORDER BY date DESC, id DESC LIMIT ${limit}`) as SqlRow[];
  }

  const transactions = rows.map(rowToTransaction);

  // Month summary if month range supplied
  let summary = null;
  if (from && to) {
    const [s] = (await sql`
      SELECT
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0)::bigint AS income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0)::bigint AS expense,
        COUNT(*)::bigint AS count
      FROM ledger_transactions WHERE date >= ${from} AND date <= ${to}
    `) as SqlRow[];
    const income = Number(s.income);
    const expense = Number(s.expense);
    summary = { income, expense, net: income - expense, count: Number(s.count) };
  }

  return NextResponse.json({ transactions, summary });
}

/** POST /api/ledger  { date, type, amount, category, subcategory?, account?, memo? } */
export async function POST(req: NextRequest) {
  const blocked = await authCheck();
  if (blocked) return blocked;
  await ensureSchema();

  const body = (await req.json()) as Partial<Transaction>;
  if (!body.date || !body.type || !body.amount || !body.category) {
    return NextResponse.json({ error: "date, type, amount, category required" }, { status: 400 });
  }
  if (!["income", "expense", "transfer"].includes(body.type)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }
  if (!Number.isFinite(body.amount) || body.amount === 0) {
    return NextResponse.json({ error: "amount must be non-zero number" }, { status: 400 });
  }

  const [r] = (await sql`
    INSERT INTO ledger_transactions (date, type, amount, category, subcategory, account, memo)
    VALUES (${body.date}, ${body.type}, ${Math.trunc(Math.abs(body.amount))}, ${body.category},
            ${body.subcategory ?? null}, ${body.account ?? null}, ${body.memo ?? null})
    RETURNING *
  `) as SqlRow[];
  return NextResponse.json({ transaction: rowToTransaction(r) });
}
