"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Todo {
  id: string;
  title: string;
  status: "open" | "done" | "cancelled";
  priority?: "low" | "medium" | "high";
  dueDate?: string;
  category?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

type Filter = "all" | "open" | "done";

const PRIO_COLOR: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#60a5fa",
};

function formatDate(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntil(dueDate?: string): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate + "T23:59:59+09:00").getTime();
  const now = Date.now();
  return Math.ceil((due - now) / 86400000);
}

export default function TodoPage() {
  const router = useRouter();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [newTitle, setNewTitle] = useState("");
  const [newPrio, setNewPrio] = useState<"low" | "medium" | "high">("medium");
  const [newDue, setNewDue] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/todo", { credentials: "same-origin", cache: "no-store" });
      if (r.status === 401) { router.push("/"); return; }
      if (!r.ok) throw new Error(`${r.status}`);
      const data = await r.json();
      setTodos(data.todos ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { refresh(); }, [refresh]);

  const visible = useMemo(() => {
    const filtered = todos.filter((t) =>
      filter === "all" ? true : filter === "open" ? t.status === "open" : t.status === "done"
    );
    // Sort: open first by priority+due, done by recency
    const prioRank = (p?: string) => p === "high" ? 0 : p === "medium" ? 1 : 2;
    filtered.sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      if (a.status === "open") {
        const pr = prioRank(a.priority) - prioRank(b.priority);
        if (pr !== 0) return pr;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return filtered;
  }, [todos, filter]);

  const counts = useMemo(() => ({
    open: todos.filter((t) => t.status === "open").length,
    done: todos.filter((t) => t.status === "done").length,
    all: todos.length,
  }), [todos]);

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/todo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ title: newTitle.trim(), priority: newPrio, dueDate: newDue || undefined }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      setNewTitle(""); setNewDue(""); setNewPrio("medium");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "add failed");
    } finally { setBusy(false); }
  }

  async function patchTodo(id: string, patch: Partial<Todo>) {
    setBusy(true);
    try {
      const r = await fetch("/api/todo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id, patch }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      await refresh();
    } finally { setBusy(false); }
  }

  async function removeTodo(id: string) {
    if (!confirm("정말 삭제할까요?")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/todo?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!r.ok) throw new Error(`${r.status}`);
      await refresh();
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-[#06060f] text-white/90 font-mono">
      <header className="sticky top-0 z-40 bg-[#06060f]/85 backdrop-blur-md border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")} className="text-white/30 hover:text-white/60 text-sm">&larr;</button>
            <h1 className="text-base text-white/70 tracking-wide">todo</h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/30">
            <span>{counts.open} open · {counts.done} done</span>
            <button onClick={refresh} disabled={loading || busy}
              className="px-2 py-1 rounded border border-white/10 hover:border-white/20 disabled:opacity-30">
              {loading || busy ? "..." : "refresh"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* add form */}
        <form onSubmit={addTodo} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 mb-6">
          <input
            type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="할 일 입력 후 Enter..."
            className="w-full bg-transparent text-white/80 placeholder:text-white/25 border-none focus:outline-none text-sm mb-3"
          />
          <div className="flex items-center gap-2 text-xs">
            <select value={newPrio} onChange={(e) => setNewPrio(e.target.value as typeof newPrio)}
              className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-white/70">
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
            <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-white/70" />
            <button type="submit" disabled={busy || !newTitle.trim()}
              className="ml-auto px-3 py-1 rounded bg-white/[0.08] border border-white/[0.12] hover:bg-white/[0.12] disabled:opacity-30 text-white/80">
              add
            </button>
          </div>
        </form>

        {/* filter tabs */}
        <div className="flex gap-2 mb-4 text-xs">
          {(["open", "done", "all"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded border transition-all ${
                filter === f
                  ? "bg-white/[0.06] border-white/20 text-white/80"
                  : "border-white/[0.08] text-white/40 hover:border-white/[0.16]"
              }`}>
              {f} ({counts[f]})
            </button>
          ))}
        </div>

        {error && <div className="text-red-400/70 text-sm mb-4">error: {error}</div>}
        {loading && todos.length === 0 && (
          <div className="text-white/20 text-sm text-center py-16 animate-pulse">loading todos...</div>
        )}

        <div className="space-y-1">
          {visible.length === 0 && !loading && (
            <div className="text-white/20 text-sm text-center py-12 border border-dashed border-white/[0.06] rounded-xl">
              {filter === "open" ? "열린 할 일 없음" : filter === "done" ? "완료된 할 일 없음" : "비어있음"}
            </div>
          )}
          {visible.map((t) => {
            const daysLeft = daysUntil(t.dueDate);
            const overdue = t.status === "open" && daysLeft !== null && daysLeft < 0;
            return (
              <div key={t.id}
                className={`group rounded-lg border transition-all p-3 ${
                  t.status === "done"
                    ? "border-white/[0.04] bg-white/[0.01] opacity-50"
                    : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"
                }`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={t.status === "done"}
                    onChange={() => patchTodo(t.id, { status: t.status === "done" ? "open" : "done" })}
                    disabled={busy}
                    className="mt-1 w-4 h-4 accent-emerald-500 shrink-0 cursor-pointer" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {t.priority && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider"
                          style={{ backgroundColor: PRIO_COLOR[t.priority] + "22", color: PRIO_COLOR[t.priority] }}>
                          {t.priority.toUpperCase()}
                        </span>
                      )}
                      <span className={`text-sm ${t.status === "done" ? "line-through text-white/40" : "text-white/80"}`}>
                        {t.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-white/25 mt-1">
                      {t.dueDate && (
                        <span className={overdue ? "text-red-400/80" : daysLeft !== null && daysLeft <= 3 ? "text-amber-400/80" : ""}>
                          due {t.dueDate}{daysLeft !== null && ` (${daysLeft >= 0 ? "D-" + daysLeft : "D+" + (-daysLeft)})`}
                        </span>
                      )}
                      {t.category && <span>#{t.category}</span>}
                      <span>{formatDate(t.createdAt)}</span>
                    </div>
                    {t.notes && (
                      <div className="mt-2 text-[11px] text-white/40 whitespace-pre-wrap">{t.notes}</div>
                    )}
                  </div>

                  <button onClick={() => removeTodo(t.id)} disabled={busy}
                    className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400/80 text-xs transition-opacity px-2 py-1">
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
