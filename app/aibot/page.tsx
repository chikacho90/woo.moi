"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

interface MemoryFile {
  fileName: string;
  name: string;
  description: string;
  type: string;
  content: string;
}

interface Bot {
  id: string;
  name: string;
  platform: "discord" | "telegram";
  host: string;
  hostTailscaleIp: string;
  sessionUuid: string;
  memoryIndex: string | null;
  memories: MemoryFile[];
  lastUpdated: string | null;
}

const PLATFORM_ICON: Record<string, string> = { discord: "D", telegram: "T" };
const PLATFORM_COLOR: Record<string, string> = { discord: "#5865F2", telegram: "#26A5E4" };
const HOST_LABEL: Record<string, string> = { "personal-mac": "개인맥", "company-mac": "회사맥" };

const TYPE_LABEL: Record<string, string> = {
  user: "USER",
  feedback: "FEEDBACK",
  project: "PROJECT",
  reference: "REF",
  unknown: "OTHER",
};
const TYPE_COLOR: Record<string, string> = {
  user: "#a78bfa",
  feedback: "#f59e0b",
  project: "#34d399",
  reference: "#60a5fa",
  unknown: "#9ca3af",
};

function formatKoreanTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AibotPage() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string>("");
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/aibot/memories", { credentials: "same-origin" });
      if (res.status === 401) {
        router.push("/");
        return;
      }
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setBots(data.bots);
      setFetchedAt(data.fetchedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedBot = useMemo(
    () => bots.find((b) => b.id === selectedBotId) ?? null,
    [bots, selectedBotId]
  );

  const selectedMemoryFile = useMemo(
    () => selectedBot?.memories.find((m) => m.fileName === selectedMemory) ?? null,
    [selectedBot, selectedMemory]
  );

  const filteredMemories = useMemo(() => {
    if (!selectedBot || !query.trim()) return selectedBot?.memories ?? [];
    const q = query.toLowerCase();
    return selectedBot.memories.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        m.fileName.toLowerCase().includes(q)
    );
  }, [selectedBot, query]);

  const totalMemories = bots.reduce((s, b) => s + b.memories.length, 0);

  const byHost = useMemo(() => {
    const g: Record<string, Bot[]> = {};
    for (const b of bots) (g[b.host] ??= []).push(b);
    return g;
  }, [bots]);

  return (
    <main className="min-h-screen bg-[#06060f] text-white/90 font-mono">
      <header className="sticky top-0 z-40 bg-[#06060f]/85 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (selectedBotId) {
                  setSelectedBotId(null);
                  setSelectedMemory(null);
                  setQuery("");
                } else router.push("/");
              }}
              className="text-white/30 hover:text-white/60 transition-colors text-sm"
            >
              &larr;
            </button>
            <h1 className="text-base text-white/70 tracking-wide">
              aibot <span className="text-white/30">/ memories</span>
            </h1>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/30">
            <span>
              {bots.length} bots · {totalMemories} memories
            </span>
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-2 py-1 rounded border border-white/10 hover:border-white/20 hover:text-white/50 transition-all disabled:opacity-30"
            >
              {loading ? "..." : "refresh"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading && bots.length === 0 && (
          <div className="flex items-center justify-center py-32 text-white/20 text-sm">
            <span className="animate-pulse">loading bot memories...</span>
          </div>
        )}
        {error && (
          <div className="text-red-400/70 text-sm text-center py-8">error: {error}</div>
        )}

        {!selectedBot &&
          Object.entries(byHost).map(([host, hostBots]) => (
            <section key={host} className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: hostBots.some((b) => b.lastUpdated) ? "#34d399" : "#6b7280",
                  }}
                />
                <h2 className="text-sm text-white/50 uppercase tracking-widest">
                  {HOST_LABEL[host] ?? host}
                </h2>
                <span className="text-xs text-white/20 ml-2">{hostBots[0]?.hostTailscaleIp}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hostBots.map((bot) => (
                  <button
                    key={bot.id}
                    onClick={() => setSelectedBotId(bot.id)}
                    className="text-left rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all p-5"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                        style={{
                          backgroundColor: PLATFORM_COLOR[bot.platform] + "20",
                          color: PLATFORM_COLOR[bot.platform],
                        }}
                      >
                        {PLATFORM_ICON[bot.platform]}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white/80">{bot.name}</span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider"
                            style={{
                              backgroundColor: PLATFORM_COLOR[bot.platform] + "15",
                              color: PLATFORM_COLOR[bot.platform] + "cc",
                            }}
                          >
                            {bot.platform}
                          </span>
                        </div>
                        <div className="text-[11px] text-white/30 mt-0.5">{bot.id}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/40 mt-3">
                      <span>{bot.memories.length} memories</span>
                      <span className="text-white/25">
                        last sync · {formatKoreanTime(bot.lastUpdated)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}

        {selectedBot && (
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
            <aside>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold"
                    style={{
                      backgroundColor: PLATFORM_COLOR[selectedBot.platform] + "20",
                      color: PLATFORM_COLOR[selectedBot.platform],
                    }}
                  >
                    {PLATFORM_ICON[selectedBot.platform]}
                  </div>
                  <span className="text-sm text-white/80">{selectedBot.name}</span>
                </div>
                <div className="text-[11px] text-white/25 ml-9">
                  {HOST_LABEL[selectedBot.host] ?? selectedBot.host} · {selectedBot.platform}
                </div>
              </div>

              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search memories..."
                className="w-full bg-white/[0.02] border border-white/[0.08] rounded px-3 py-2 text-xs text-white/70 placeholder:text-white/20 focus:outline-none focus:border-white/20 mb-3"
              />

              <div className="space-y-1">
                {filteredMemories.length === 0 && (
                  <div className="text-[11px] text-white/20 px-3 py-2">no memories</div>
                )}
                {filteredMemories.map((m) => (
                  <button
                    key={m.fileName}
                    onClick={() => setSelectedMemory(m.fileName)}
                    className={`w-full text-left px-3 py-2 rounded border transition-all ${
                      selectedMemory === m.fileName
                        ? "bg-white/[0.05] border-white/20"
                        : "border-transparent hover:bg-white/[0.02] hover:border-white/[0.08]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded shrink-0 font-bold tracking-wider"
                        style={{
                          backgroundColor: (TYPE_COLOR[m.type] ?? TYPE_COLOR.unknown) + "18",
                          color: (TYPE_COLOR[m.type] ?? TYPE_COLOR.unknown) + "cc",
                        }}
                      >
                        {TYPE_LABEL[m.type] ?? "OTHER"}
                      </span>
                      <span className="text-xs text-white/70 truncate">{m.name}</span>
                    </div>
                    <div className="text-[10px] text-white/25 mt-1 truncate">{m.description}</div>
                  </button>
                ))}
              </div>

              {selectedBot.memoryIndex && (
                <details className="mt-5">
                  <summary className="text-[11px] text-white/30 cursor-pointer hover:text-white/50">
                    MEMORY.md (index)
                  </summary>
                  <pre className="mt-2 text-[10px] leading-relaxed text-white/35 whitespace-pre-wrap bg-white/[0.02] rounded p-3 border border-white/[0.05]">
                    {selectedBot.memoryIndex}
                  </pre>
                </details>
              )}
            </aside>

            <section>
              {selectedMemoryFile ? (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <div className="flex items-start gap-3 mb-4 pb-4 border-b border-white/[0.04]">
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded mt-1 shrink-0 font-bold tracking-wider"
                      style={{
                        backgroundColor:
                          (TYPE_COLOR[selectedMemoryFile.type] ?? TYPE_COLOR.unknown) + "18",
                        color:
                          (TYPE_COLOR[selectedMemoryFile.type] ?? TYPE_COLOR.unknown) + "cc",
                      }}
                    >
                      {TYPE_LABEL[selectedMemoryFile.type] ?? "OTHER"}
                    </span>
                    <div className="flex-1">
                      <h3 className="text-base text-white/85">{selectedMemoryFile.name}</h3>
                      <p className="text-xs text-white/40 mt-1">{selectedMemoryFile.description}</p>
                      <p className="text-[10px] text-white/20 mt-2">{selectedMemoryFile.fileName}</p>
                    </div>
                  </div>
                  <pre className="text-[12px] leading-relaxed text-white/65 whitespace-pre-wrap break-words">
                    {selectedMemoryFile.content}
                  </pre>
                </div>
              ) : (
                <div className="text-white/25 text-sm text-center py-20 border border-dashed border-white/[0.06] rounded-xl">
                  ← select a memory to view
                </div>
              )}
            </section>
          </div>
        )}

        {fetchedAt && (
          <div className="text-center text-[10px] text-white/15 mt-12 pb-8">
            fetched at {formatKoreanTime(fetchedAt)}
          </div>
        )}
      </div>
    </main>
  );
}
