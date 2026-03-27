"use client";

import { useState, useEffect, useCallback } from "react";

interface BrainFile { path: string; size: number; }
interface FileContent { path: string; content: string; sha: string; }

const BOTS = [
  { id: "woovis", name: "우비스", role: "home mac", emoji: "🦄", color: "#8b5cf6" },
  { id: "9oovis", name: "구비스", role: "work mac", emoji: "🐙", color: "#06b6d4" },
  { id: "pulmang", name: "풀망", role: "windows", emoji: "🔥", color: "#f97316" },
];

const TABS = ["bots", "memory", "logs", "tasks", "setup"] as const;
type Tab = (typeof TABS)[number];

export default function AIPage() {
  const [files, setFiles] = useState<BrainFile[]>([]);
  const [tab, setTab] = useState<Tab>("bots");
  const [selected, setSelected] = useState<FileContent | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2000); };

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/ai/api/brain");
    const data = await r.json();
    setFiles(data.files || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const openFile = async (path: string) => {
    const r = await fetch(`/ai/api/brain?path=${encodeURIComponent(path)}`);
    if (r.ok) {
      const data = await r.json();
      setSelected(data);
      setEditing(false);
      setEditContent(data.content);
    }
  };

  const saveFile = async () => {
    if (!selected) return;
    setSaving(true);
    const r = await fetch("/ai/api/brain", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: selected.path, content: editContent, sha: selected.sha }),
    });
    const data = await r.json();
    if (data.ok) {
      setSelected({ ...selected, content: editContent, sha: data.sha });
      setEditing(false);
      showToast("saved");
    }
    setSaving(false);
  };

  const deleteFile = async () => {
    if (!selected || !confirm(`delete ${selected.path}?`)) return;
    const r = await fetch("/ai/api/brain", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: selected.path, sha: selected.sha }),
    });
    if ((await r.json()).ok) { setSelected(null); showToast("deleted"); loadFiles(); }
  };

  const filterFiles = (prefix: string) =>
    files.filter((f) => f.path.startsWith(prefix) && !f.path.endsWith(".gitkeep")).sort((a, b) => b.path.localeCompare(a.path));

  const tabFiles = tab === "memory" ? filterFiles("memory/") : tab === "logs" ? filterFiles("logs/") : tab === "tasks" ? filterFiles("tasks/") : filterFiles("setup/");

  const botActivity = (id: string) => {
    const log = filterFiles("logs/").find((f) => f.path.includes(id));
    return log?.path.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || "—";
  };

  // Detail overlay
  if (selected) {
    return (
      <div className="fixed inset-0 bg-[#06060f] flex flex-col">
        <div className="w-full max-w-2xl mx-auto flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4">
            <button
              onClick={() => { setSelected(null); setEditing(false); }}
              className="text-xs font-mono text-white/25 hover:text-white/50 transition-colors"
            >
              ← back
            </button>
            <span className="text-[11px] font-mono text-white/20 truncate mx-4">{selected.path}</span>
            <div className="flex gap-4">
              {editing ? (
                <>
                  <button onClick={saveFile} disabled={saving} className="text-xs font-mono text-green-400/50 hover:text-green-400/80 disabled:opacity-30">
                    {saving ? "..." : "save"}
                  </button>
                  <button onClick={() => { setEditing(false); setEditContent(selected.content); }} className="text-xs font-mono text-white/20 hover:text-white/40">
                    cancel
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setEditing(true)} className="text-xs font-mono text-white/20 hover:text-white/40">edit</button>
                  <button onClick={deleteFile} className="text-xs font-mono text-red-400/20 hover:text-red-400/50">delete</button>
                </>
              )}
            </div>
          </div>

          <div className="h-px bg-white/5 mx-5" />

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {editing ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-full min-h-[70vh] bg-transparent text-sm font-mono text-white/55 leading-relaxed focus:outline-none resize-none"
                spellCheck={false}
                autoCapitalize="off"
              />
            ) : (
              <pre className="text-sm font-mono text-white/45 whitespace-pre-wrap leading-relaxed">{selected.content}</pre>
            )}
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/8 backdrop-blur rounded-full text-[11px] font-mono text-white/50">
            {toast}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#06060f] overflow-y-auto">
      <div className="w-full max-w-2xl mx-auto px-5 py-6 sm:py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <a href="/" className="text-xs font-mono text-white/15 hover:text-white/30 transition-colors">← home</a>
          <h1 className="text-[11px] font-mono tracking-[0.3em] text-white/20 uppercase">shared brain</h1>
          <div className="w-12" />
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-1 mb-8">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-[11px] font-mono tracking-wider rounded-full transition-all ${
                tab === t
                  ? "bg-white/8 text-white/70"
                  : "text-white/20 hover:text-white/40"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Bots */}
        {tab === "bots" && (
          <div className="space-y-4">
            {BOTS.map((bot) => (
              <div key={bot.id} className="group border border-white/6 rounded-2xl p-5 hover:border-white/12 transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-2xl">{bot.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono text-white/70">{bot.name}</div>
                    <div className="text-[11px] font-mono text-white/20">{bot.role}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-mono text-white/15">last active</div>
                    <div className="text-[11px] font-mono text-white/30">{botActivity(bot.id)}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {["memory", "setup", "logs"].map((section) => (
                    <button
                      key={section}
                      onClick={() => {
                        if (section === "logs") { setTab("logs"); }
                        else { setTab(section as Tab); setTimeout(() => openFile(`${section}/${bot.id}.md`), 50); }
                      }}
                      className="flex-1 py-2 text-[11px] font-mono text-white/20 rounded-lg border border-white/5 hover:bg-white/5 hover:text-white/40 active:bg-white/8 transition-all"
                    >
                      {section}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Shared facts */}
            <button
              onClick={() => { setTab("memory"); setTimeout(() => openFile("memory/shared-facts.md"), 50); }}
              className="w-full border border-white/6 rounded-2xl p-5 text-left hover:border-white/12 transition-all"
            >
              <div className="text-[10px] font-mono text-white/15 mb-1">shared knowledge</div>
              <div className="text-sm font-mono text-white/40">shared-facts.md</div>
            </button>
          </div>
        )}

        {/* File list */}
        {tab !== "bots" && (
          <div className="space-y-1">
            {loading ? (
              <div className="text-center py-12 text-xs font-mono text-white/10">loading...</div>
            ) : tabFiles.length === 0 ? (
              <div className="text-center py-12 text-xs font-mono text-white/10">empty</div>
            ) : (
              tabFiles.map((f) => {
                const name = f.path.split("/").pop() || f.path;
                const bot = BOTS.find((b) => name.includes(b.id));
                return (
                  <button
                    key={f.path}
                    onClick={() => openFile(f.path)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left hover:bg-white/4 active:bg-white/6 transition-all"
                  >
                    {bot ? <span className="text-sm">{bot.emoji}</span> : <span className="text-sm opacity-30">📄</span>}
                    <span className="flex-1 text-sm font-mono text-white/40 truncate">{name}</span>
                    <span className="text-[10px] font-mono text-white/10">{f.size < 1024 ? `${f.size}b` : `${(f.size / 1024).toFixed(1)}k`}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/8 backdrop-blur rounded-full text-[11px] font-mono text-white/50">
          {toast}
        </div>
      )}
    </div>
  );
}
