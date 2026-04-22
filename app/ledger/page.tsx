"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS, type Transaction, type TxnType } from "./types";

interface Summary { income: number; expense: number; net: number; count: number }

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function firstOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function lastOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0); // month is 1-indexed in our param; Date month is 0-indexed
  return ymd(d);
}

function krw(n: number): string {
  return n.toLocaleString("ko-KR");
}

function krwSigned(n: number): string {
  return n >= 0 ? `+${krw(n)}` : `-${krw(Math.abs(n))}`;
}

const TYPE_COLOR: Record<TxnType, string> = {
  income: "#34d399",
  expense: "#f87171",
  transfer: "#a78bfa",
};
const TYPE_LABEL: Record<TxnType, string> = { income: "수입", expense: "지출", transfer: "이체" };

export default function LedgerPage() {
  const router = useRouter();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const from = useMemo(() => firstOfMonth(year, month), [year, month]);
  const to = useMemo(() => lastOfMonth(year, month), [year, month]);

  const [txns, setTxns] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // add form
  const [formDate, setFormDate] = useState(ymd(now));
  const [formType, setFormType] = useState<TxnType>("expense");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("식비");
  const [formAccount, setFormAccount] = useState("토스");
  const [formMemo, setFormMemo] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/ledger?from=${from}&to=${to}`, {
        credentials: "same-origin", cache: "no-store",
      });
      if (r.status === 401) { router.push("/"); return; }
      if (!r.ok) throw new Error(`${r.status}`);
      const data = await r.json();
      setTxns(data.transactions);
      setSummary(data.summary);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch failed");
    } finally { setLoading(false); }
  }, [from, to, router]);

  useEffect(() => { refresh(); }, [refresh]);

  async function addTxn(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const amount = parseInt(formAmount.replace(/,/g, ""), 10);
    if (!Number.isFinite(amount) || amount === 0) { setError("금액 잘못됨"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          date: formDate,
          type: formType,
          amount,
          category: formCategory,
          account: formAccount || null,
          memo: formMemo || null,
        }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      setFormAmount(""); setFormMemo("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "add failed");
    } finally { setBusy(false); }
  }

  async function removeTxn(id: number) {
    if (!confirm("삭제?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/ledger/${id}`, { method: "DELETE", credentials: "same-origin" });
      if (!r.ok) throw new Error(`${r.status}`);
      await refresh();
    } finally { setBusy(false); }
  }

  // Category breakdown (expense only) for this month
  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txns) {
      if (t.type !== "expense") continue;
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [txns]);

  const maxCat = breakdown[0]?.total ?? 1;

  // group txns by date
  const grouped = useMemo(() => {
    const g = new Map<string, Transaction[]>();
    for (const t of txns) {
      const arr = g.get(t.date) ?? [];
      arr.push(t);
      g.set(t.date, arr);
    }
    return Array.from(g.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [txns]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  }

  const cats = DEFAULT_CATEGORIES[formType];

  return (
    <main className="min-h-screen bg-[#06060f] text-white/90 font-mono">
      <header className="sticky top-0 z-40 bg-[#06060f]/85 backdrop-blur-md border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="text-white/30 hover:text-white/60 text-sm">&larr;</button>
            <h1 className="text-base text-white/70 tracking-wide">ledger</h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/30">
            <button onClick={prevMonth} className="px-2 py-1 rounded border border-white/10 hover:border-white/20">&lt;</button>
            <span className="text-white/60">{year}.{String(month).padStart(2, "0")}</span>
            <button onClick={nextMonth} className="px-2 py-1 rounded border border-white/10 hover:border-white/20">&gt;</button>
            <button onClick={refresh} disabled={loading || busy}
              className="ml-2 px-2 py-1 rounded border border-white/10 hover:border-white/20 disabled:opacity-30">
              {loading || busy ? "..." : "refresh"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="text-[10px] text-white/40 mb-1">수입</div>
            <div className="text-lg text-emerald-400">+{krw(summary?.income ?? 0)}</div>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="text-[10px] text-white/40 mb-1">지출</div>
            <div className="text-lg text-red-400">-{krw(summary?.expense ?? 0)}</div>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="text-[10px] text-white/40 mb-1">순액</div>
            <div className={`text-lg ${summary && summary.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {summary ? krwSigned(summary.net) : "0"}
            </div>
          </div>
        </div>

        {/* Add form */}
        <form onSubmit={addTxn} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 mb-6">
          <div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-2 text-xs mb-2">
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-white/70" />
            <select value={formType} onChange={(e) => { const t = e.target.value as TxnType; setFormType(t); setFormCategory(DEFAULT_CATEGORIES[t][0]); }}
              className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-white/70">
              <option value="expense">지출</option>
              <option value="income">수입</option>
              <option value="transfer">이체</option>
            </select>
            <input type="text" inputMode="numeric" value={formAmount} onChange={(e) => setFormAmount(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="금액 (원)" required
              className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-white/70" />
            <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-white/70">
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={formAccount} onChange={(e) => setFormAccount(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-white/70">
              <option value="">계정</option>
              {DEFAULT_ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex gap-2 text-xs">
            <input type="text" value={formMemo} onChange={(e) => setFormMemo(e.target.value)}
              placeholder="메모 (선택)"
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-white/70" />
            <button type="submit" disabled={busy || !formAmount}
              className="px-4 py-1.5 rounded bg-white/[0.08] border border-white/[0.12] hover:bg-white/[0.12] disabled:opacity-30 text-white/80">
              add
            </button>
          </div>
        </form>

        {error && <div className="text-red-400/70 text-sm mb-4">error: {error}</div>}

        {/* Category breakdown (expense) */}
        {breakdown.length > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 mb-6">
            <div className="text-[10px] text-white/40 mb-3 uppercase tracking-widest">지출 카테고리</div>
            <div className="space-y-2">
              {breakdown.map(({ category, total }) => (
                <div key={category} className="flex items-center gap-3">
                  <div className="w-20 text-xs text-white/50 shrink-0">{category}</div>
                  <div className="flex-1 h-5 bg-white/[0.04] rounded relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-red-400/40" style={{ width: `${(total / maxCat) * 100}%` }} />
                  </div>
                  <div className="text-xs text-white/60 w-24 text-right tabular-nums">-{krw(total)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transaction list grouped by date */}
        {loading && txns.length === 0 && (
          <div className="text-white/20 text-sm text-center py-12 animate-pulse">loading...</div>
        )}
        {!loading && txns.length === 0 && (
          <div className="text-white/20 text-sm text-center py-16 border border-dashed border-white/[0.06] rounded-xl">
            이 달 거래 없음
          </div>
        )}

        <div className="space-y-4">
          {grouped.map(([date, items]) => {
            const dayIncome = items.filter((t) => t.type === "income").reduce((a, b) => a + b.amount, 0);
            const dayExpense = items.filter((t) => t.type === "expense").reduce((a, b) => a + b.amount, 0);
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2 px-1 text-xs">
                  <div className="text-white/50">{date}</div>
                  <div className="flex gap-3 tabular-nums">
                    {dayIncome > 0 && <span className="text-emerald-400/80">+{krw(dayIncome)}</span>}
                    {dayExpense > 0 && <span className="text-red-400/80">-{krw(dayExpense)}</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  {items.map((t) => (
                    <div key={t.id} className="group rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider shrink-0"
                          style={{ backgroundColor: TYPE_COLOR[t.type] + "22", color: TYPE_COLOR[t.type] }}>
                          {TYPE_LABEL[t.type]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white/80">{t.category}</span>
                            {t.account && <span className="text-[10px] text-white/30">· {t.account}</span>}
                          </div>
                          {t.memo && <div className="text-[11px] text-white/40 mt-0.5">{t.memo}</div>}
                        </div>
                        <div className={`text-sm tabular-nums shrink-0 ${t.type === "income" ? "text-emerald-400" : t.type === "expense" ? "text-red-400" : "text-purple-400"}`}>
                          {t.type === "income" ? "+" : t.type === "expense" ? "-" : ""}{krw(t.amount)}
                        </div>
                        <button onClick={() => removeTxn(t.id)} disabled={busy}
                          className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400/80 text-xs transition-opacity px-2">
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
