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
  { id: "woovis", name: "우비스", role: "개인 맥북 (메인)", emoji: "🦄", color: "#8b5cf6" },
  { id: "9oovis", name: "구비스", role: "회사 맥북 (H9)", emoji: "🐙", color: "#06b6d4" },
  { id: "pulmang", name: "풀망", role: "Windows 데스크톱", emoji: "🔥", color: "#f97316" },
];

const TABS = ["overview", "memory", "logs", "tasks", "settings"] as const;
type Tab = (typeof TABS)[number];

export default function AIPage() {
  const [files, setFiles] = useState<BrainFile[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
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

  // Categorize files
  const memoryFiles = files.filter((f) => f.path.startsWith("memory/"));
  const logFiles = files.filter((f) => f.path.startsWith("logs/")).sort((a, b) => b.path.localeCompare(a.path));
  const taskFiles = files.filter((f) => f.path.startsWith("tasks/"));
  const setupFiles = files.filter((f) => f.path.startsWith("setup/"));

  // Bot last activity from logs
  const botActivity = (botId: string) => {
    const botLogs = logFiles.filter((f) => f.path.includes(botId) && !f.path.endsWith(".gitkeep"));
    if (botLogs.length === 0) return "no activity";
    const latest = botLogs[0].path.match(/(\d{4}-\d{2}-\d{2})/);
    return latest ? latest[1] : "unknown";
  };

  return (
    <div className="fixed inset-0 bg-[#06060f] text-white/80 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/5">
        <h1 className="text-sm font-mono tracking-[0.2em] text-white/40 uppercase">ai</h1>
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelected(null); }}
              className={`px-3 py-1.5 text-xs font-mono tracking-wider rounded transition-colors ${
                tab === t ? "bg-white/10 text-white/90" : "text-white/30 hover:text-white/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-white/10 backdrop-blur rounded text-xs font-mono text-white/70">
          {toast}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {tab === "overview" && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {BOTS.map((bot) => (
                <div key={bot.id} className="border border-white/8 rounded-xl p-5 hover:border-white/15 transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">{bot.emoji}</span>
                    <div>
                      <div className="text-sm font-mono text-white/80">{bot.name}</div>
                      <div className="text-[11px] font-mono text-white/30">{bot.id}</div>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-white/30">role</span>
                      <span className="text-white/50">{bot.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/30">last active</span>
                      <span className="text-white/50">{botActivity(bot.id)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/30">memory</span>
                      <button
                        onClick={() => { setTab("memory"); openFile(`memory/${bot.id}.md`); }}
                        className="text-white/50 hover:text-white/80 underline underline-offset-2"
                      >
                        view
                      </button>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/30">setup</span>
                      <button
                        onClick={() => { setTab("settings"); openFile(`setup/${bot.id}.md`); }}
                        className="text-white/50 hover:text-white/80 underline underline-offset-2"
                      >
                        view
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 h-0.5 rounded-full" style={{ backgroundColor: bot.color, opacity: 0.3 }} />
                </div>
              ))}
            </div>

            {/* Shared Facts */}
            <div className="max-w-4xl mx-auto mt-6">
              <button
                onClick={() => { setTab("memory"); openFile("memory/shared-facts.md"); }}
                className="w-full border border-white/8 rounded-xl p-4 text-left hover:border-white/15 transition-colors"
              >
                <div className="text-xs font-mono text-white/40 mb-1">shared knowledge</div>
                <div className="text-sm font-mono text-white/60">shared-facts.md</div>
              </button>
            </div>
          </div>
        )}

        {(tab === "memory" || tab === "logs" || tab === "tasks" || tab === "settings") && (
          <>
            {/* File list */}
            <div className="w-56 sm:w-64 border-r border-white/5 overflow-y-auto flex-shrink-0">
              <div className="p-3">
                <div className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-2">{tab}</div>
                {loading ? (
                  <div className="text-xs font-mono text-white/20 p-2">loading...</div>
                ) : (
                  (tab === "memory" ? memoryFiles : tab === "logs" ? logFiles : tab === "tasks" ? taskFiles : setupFiles)
                    .filter((f) => !f.path.endsWith(".gitkeep"))
                    .map((f) => (
                      <button
                        key={f.path}
                        onClick={() => openFile(f.path)}
                        className={`w-full text-left px-3 py-2 rounded text-xs font-mono truncate transition-colors ${
                          selected?.path === f.path
                            ? "bg-white/10 text-white/80"
                            : "text-white/40 hover:text-white/60 hover:bg-white/5"
                        }`}
                      >
                        {f.path.split("/").pop()}
                      </button>
                    ))
                )}
              </div>
            </div>

            {/* File content */}
            <div className="flex-1 overflow-y-auto">
              {selected ? (
                <div className="p-4 sm:p-6">
                  {/* File header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs font-mono text-white/30">{selected.path}</div>
                    <div className="flex gap-2">
                      {editing ? (
                        <>
                          <button
                            onClick={saveFile}
                            disabled={saving}
                            className="px-3 py-1 text-xs font-mono bg-white/10 rounded hover:bg-white/15 text-white/70 disabled:opacity-40"
                          >
                            {saving ? "..." : "save"}
                          </button>
                          <button
                            onClick={() => { setEditing(false); setEditContent(selected.content); }}
                            className="px-3 py-1 text-xs font-mono text-white/30 hover:text-white/50"
                          >
                            cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditing(true)}
                            className="px-3 py-1 text-xs font-mono text-white/30 hover:text-white/50"
                          >
                            edit
                          </button>
                          <button
                            onClick={deleteFile}
                            className="px-3 py-1 text-xs font-mono text-red-400/40 hover:text-red-400/70"
                          >
                            delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {editing ? (
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full h-[calc(100vh-160px)] bg-transparent border border-white/8 rounded-lg p-4 text-sm font-mono text-white/60 focus:outline-none focus:border-white/15 resize-none"
                      spellCheck={false}
                    />
                  ) : (
                    <pre className="text-sm font-mono text-white/50 whitespace-pre-wrap leading-relaxed">
                      {selected.content}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs font-mono text-white/15">
                  select a file
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
