"use client";

import { useState, useEffect, useCallback } from "react";

interface BrainFile {
  path: string;
  size: number;
}

interface FileContent {
  path: string;
  content: string;
  sha: string;
}

const BOTS = [
  { id: "woovis", name: "우비스", role: "개인 맥북", emoji: "🦄", color: "#8b5cf6" },
  { id: "9oovis", name: "구비스", role: "회사 맥북", emoji: "🐙", color: "#06b6d4" },
  { id: "pulmang", name: "풀망", role: "Windows", emoji: "🔥", color: "#f97316" },
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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

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
    const data = await r.json();
    if (data.ok) {
      setSelected(null);
      showToast("deleted");
      loadFiles();
    }
  };

  const back = () => { setSelected(null); setEditing(false); };

  // Categorize
  const memoryFiles = files.filter((f) => f.path.startsWith("memory/") && !f.path.endsWith(".gitkeep"));
  const logFiles = files.filter((f) => f.path.startsWith("logs/") && !f.path.endsWith(".gitkeep")).sort((a, b) => b.path.localeCompare(a.path));
  const taskFiles = files.filter((f) => f.path.startsWith("tasks/") && !f.path.endsWith(".gitkeep"));
  const setupFiles = files.filter((f) => f.path.startsWith("setup/") && !f.path.endsWith(".gitkeep"));

  const tabFiles = tab === "memory" ? memoryFiles : tab === "logs" ? logFiles : tab === "tasks" ? taskFiles : setupFiles;

  const botActivity = (botId: string) => {
    const botLogs = logFiles.filter((f) => f.path.includes(botId));
    if (botLogs.length === 0) return "—";
    const m = botLogs[0].path.match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : "—";
  };

  // Detail view (mobile: full screen, desktop: right panel)
  const detailView = selected && (
    <div className="absolute inset-0 sm:relative bg-[#06060f] z-10 flex flex-col">
      {/* Detail header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <button onClick={back} className="text-white/40 hover:text-white/70 text-sm font-mono">←</button>
        <span className="text-xs font-mono text-white/30 truncate flex-1">{selected.path}</span>
        <div className="flex gap-3">
          {editing ? (
            <>
              <button onClick={saveFile} disabled={saving} className="text-xs font-mono text-green-400/60 hover:text-green-400/90 active:scale-95">
                {saving ? "..." : "save"}
              </button>
              <button onClick={() => { setEditing(false); setEditContent(selected.content); }} className="text-xs font-mono text-white/30">
                cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="text-xs font-mono text-white/30 hover:text-white/60">edit</button>
              <button onClick={deleteFile} className="text-xs font-mono text-red-400/30 hover:text-red-400/60">delete</button>
            </>
          )}
        </div>
      </div>

      {/* Detail content */}
      <div className="flex-1 overflow-y-auto p-4">
        {editing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-full min-h-[60vh] bg-transparent border border-white/8 rounded-lg p-4 text-sm font-mono text-white/60 focus:outline-none focus:border-white/15 resize-none"
            spellCheck={false}
            autoCapitalize="off"
          />
        ) : (
          <pre className="text-sm font-mono text-white/50 whitespace-pre-wrap leading-relaxed">{selected.content}</pre>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#06060f] text-white/80 flex flex-col overflow-hidden">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-white/10 backdrop-blur rounded text-xs font-mono text-white/70">
          {toast}
        </div>
      )}

      {/* Tabs - horizontal scroll on mobile */}
      <div className="flex items-center border-b border-white/5 overflow-x-auto scrollbar-none">
        <a href="/" className="px-4 py-3 text-white/20 hover:text-white/40 text-xs font-mono shrink-0">←</a>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelected(null); setEditing(false); }}
            className={`px-4 py-3 text-xs font-mono tracking-wider shrink-0 transition-colors border-b-2 ${
              tab === t ? "border-white/30 text-white/80" : "border-transparent text-white/25 hover:text-white/40"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden relative">
        {tab === "bots" ? (
          /* Bot cards */
          <div className="h-full overflow-y-auto p-4 space-y-3">
            {BOTS.map((bot) => (
              <div key={bot.id} className="border border-white/8 rounded-xl p-4 active:bg-white/5 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">{bot.emoji}</span>
                  <div className="flex-1">
                    <div className="text-sm font-mono text-white/80">{bot.name}</div>
                    <div className="text-[11px] font-mono text-white/25">{bot.role}</div>
                  </div>
                  <div className="text-[10px] font-mono text-white/20">{botActivity(bot.id)}</div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setTab("memory"); setTimeout(() => openFile(`memory/${bot.id}.md`), 100); }}
                    className="flex-1 py-2 text-[11px] font-mono text-white/30 border border-white/8 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors"
                  >
                    memory
                  </button>
                  <button
                    onClick={() => { setTab("setup"); setTimeout(() => openFile(`setup/${bot.id}.md`), 100); }}
                    className="flex-1 py-2 text-[11px] font-mono text-white/30 border border-white/8 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors"
                  >
                    setup
                  </button>
                </div>
              </div>
            ))}

            {/* Shared */}
            <button
              onClick={() => { setTab("memory"); setTimeout(() => openFile("memory/shared-facts.md"), 100); }}
              className="w-full border border-white/8 rounded-xl p-4 text-left hover:bg-white/5 active:bg-white/10 transition-colors"
            >
              <div className="text-[10px] font-mono text-white/20 mb-1">shared</div>
              <div className="text-sm font-mono text-white/50">shared-facts.md</div>
            </button>

            {/* Quick actions */}
            <div className="border border-white/8 rounded-xl p-4">
              <div className="text-[10px] font-mono text-white/20 mb-3">quick</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTab("logs")}
                  className="flex-1 py-2.5 text-[11px] font-mono text-white/30 border border-white/8 rounded-lg hover:bg-white/5 active:bg-white/10"
                >
                  logs ({logFiles.length})
                </button>
                <button
                  onClick={() => setTab("tasks")}
                  className="flex-1 py-2.5 text-[11px] font-mono text-white/30 border border-white/8 rounded-lg hover:bg-white/5 active:bg-white/10"
                >
                  tasks ({taskFiles.length})
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* File list + detail */
          <div className="h-full flex flex-col sm:flex-row">
            {/* File list - hidden on mobile when detail open */}
            <div className={`${selected ? "hidden sm:block" : ""} sm:w-64 sm:border-r sm:border-white/5 overflow-y-auto flex-shrink-0`}>
              {loading ? (
                <div className="p-4 text-xs font-mono text-white/15">loading...</div>
              ) : tabFiles.length === 0 ? (
                <div className="p-4 text-xs font-mono text-white/15">empty</div>
              ) : (
                <div className="p-2">
                  {tabFiles.map((f) => {
                    const name = f.path.split("/").pop() || f.path;
                    const bot = BOTS.find((b) => name.includes(b.id));
                    return (
                      <button
                        key={f.path}
                        onClick={() => openFile(f.path)}
                        className={`w-full text-left px-3 py-3 sm:py-2 rounded-lg text-sm sm:text-xs font-mono truncate transition-colors flex items-center gap-2 ${
                          selected?.path === f.path
                            ? "bg-white/10 text-white/80"
                            : "text-white/40 hover:bg-white/5 active:bg-white/10"
                        }`}
                      >
                        {bot && <span className="text-xs">{bot.emoji}</span>}
                        <span className="truncate">{name}</span>
                        <span className="ml-auto text-[10px] text-white/15">{(f.size / 1024).toFixed(1)}k</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Detail */}
            {detailView || (
              <div className="hidden sm:flex flex-1 items-center justify-center text-xs font-mono text-white/10">
                select a file
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
