"use client";

import { useState, useEffect, useCallback } from "react";

interface Memory { id: string; text: string; owner: string; shared: boolean; ts: string; }
interface Skill { id: string; name: string; desc: string; by: string; bots: Record<string, boolean>; }

const BOTS = [
  { id: "woovis", name: "우비스", emoji: "🦄" },
  { id: "9oovis", name: "구비스", emoji: "🐙" },
  { id: "pulmang", name: "풀망", emoji: "🔥" },
];

type View = null | "brain" | "woovis" | "9oovis" | "pulmang";
type BotTab = "memory" | "skills";

export default function AIPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [memSha, setMemSha] = useState<string | null>(null);
  const [skillSha, setSkillSha] = useState<string | null>(null);
  const [view, setView] = useState<View>(null);
  const [botTab, setBotTab] = useState<BotTab>("memory");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 1500); };

  const load = useCallback(async () => {
    const [mRes, sRes] = await Promise.all([
      fetch("/ai/api/data?type=memories"),
      fetch("/ai/api/data?type=skills"),
    ]);
    const mData = await mRes.json();
    const sData = await sRes.json();
    setMemories(mData.items || []);
    setMemSha(mData.sha);
    setSkills(sData.items || []);
    setSkillSha(sData.sha);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Save helpers
  const saveMemories = async (next: Memory[]) => {
    setSaving(true);
    const r = await fetch("/ai/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "memories", items: next, sha: memSha }),
    });
    const d = await r.json();
    if (d.ok) { setMemories(next); setMemSha(d.sha); }
    setSaving(false);
    return d.ok;
  };

  const saveSkills = async (next: Skill[]) => {
    setSaving(true);
    const r = await fetch("/ai/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "skills", items: next, sha: skillSha }),
    });
    const d = await r.json();
    if (d.ok) { setSkills(next); setSkillSha(d.sha); }
    setSaving(false);
    return d.ok;
  };

  // Memory actions
  const toggleShare = async (id: string) => {
    const next = memories.map((m) => m.id === id ? { ...m, shared: !m.shared } : m);
    if (await saveMemories(next)) showToast("updated");
  };

  const deleteMemory = async (id: string) => {
    const next = memories.filter((m) => m.id !== id);
    if (await saveMemories(next)) showToast("deleted");
  };

  // Skill actions
  const toggleSkill = async (skillId: string, botId: string) => {
    const next = skills.map((s) =>
      s.id === skillId ? { ...s, bots: { ...s.bots, [botId]: !s.bots[botId] } } : s
    );
    if (await saveSkills(next)) showToast("updated");
  };

  // Filtered data
  const botMemories = (id: string) => memories.filter((m) => m.owner === id);
  const sharedMemories = memories.filter((m) => m.shared);

  const activeBot = BOTS.find((b) => b.id === view);

  return (
    <div className="fixed inset-0 bg-[#06060f] overflow-y-auto">
      <div className="w-full max-w-lg mx-auto px-5 py-8 sm:py-12 min-h-screen">

        {/* Back to home */}
        <div className="mb-10">
          <a href="/" className="text-[11px] font-mono text-white/15 hover:text-white/30">← home</a>
        </div>

        {/* Hub: Brain center + 3 bots */}
        <div className="flex flex-col items-center gap-6 mb-10">
          {/* Brain */}
          <button
            onClick={() => { setView(view === "brain" ? null : "brain"); }}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all ${
              view === "brain"
                ? "bg-white/10 ring-1 ring-white/20 scale-110"
                : "bg-white/4 hover:bg-white/8"
            }`}
          >
            🧠
          </button>
          <div className="text-[10px] font-mono text-white/15 -mt-4">shared brain</div>

          {/* Bots row */}
          <div className="flex gap-6">
            {BOTS.map((bot) => (
              <button
                key={bot.id}
                onClick={() => { setView(view === bot.id ? null : (bot.id as View)); setBotTab("memory"); }}
                className={`flex flex-col items-center gap-2 transition-all ${
                  view === bot.id ? "scale-110" : ""
                }`}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all ${
                  view === bot.id
                    ? "bg-white/10 ring-1 ring-white/20"
                    : "bg-white/4 hover:bg-white/8"
                }`}>
                  {bot.emoji}
                </div>
                <span className={`text-[10px] font-mono transition-colors ${
                  view === bot.id ? "text-white/50" : "text-white/15"
                }`}>
                  {bot.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content panel */}
        {view === "brain" && (
          <div className="space-y-2">
            <div className="text-[10px] font-mono text-white/20 mb-4 text-center">
              shared memories · {sharedMemories.length}
            </div>
            {sharedMemories.length === 0 ? (
              <div className="text-center py-8 text-xs font-mono text-white/10">no shared memories yet</div>
            ) : (
              sharedMemories.map((m) => {
                const bot = BOTS.find((b) => b.id === m.owner);
                return (
                  <div key={m.id} className="group border border-white/5 rounded-xl px-4 py-3 hover:border-white/10 transition-all">
                    <div className="flex items-start gap-3">
                      <span className="text-xs mt-0.5">{bot?.emoji || "📝"}</span>
                      <p className="flex-1 text-sm font-mono text-white/45 leading-relaxed">{m.text}</p>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-[10px] font-mono text-white/10">{m.ts}</span>
                      <span className="text-[10px] font-mono text-white/10">from {m.owner}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeBot && (
          <div>
            {/* Bot tabs */}
            <div className="flex justify-center gap-1 mb-6">
              {(["memory", "skills"] as BotTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setBotTab(t)}
                  className={`px-5 py-2 text-[11px] font-mono rounded-full transition-all ${
                    botTab === t ? "bg-white/8 text-white/60" : "text-white/15 hover:text-white/30"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Bot memories */}
            {botTab === "memory" && (
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-white/15 mb-4 text-center">
                  {activeBot.name} memories · {botMemories(activeBot.id).length}
                </div>
                {botMemories(activeBot.id).length === 0 ? (
                  <div className="text-center py-8 text-xs font-mono text-white/10">no memories</div>
                ) : (
                  botMemories(activeBot.id).map((m) => (
                    <div key={m.id} className="group border border-white/5 rounded-xl px-4 py-3 hover:border-white/10 transition-all">
                      <p className="text-sm font-mono text-white/45 leading-relaxed mb-3">{m.text}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-white/10">{m.ts}</span>
                        <div className="flex gap-3">
                          <button
                            onClick={() => toggleShare(m.id)}
                            disabled={saving}
                            className={`text-[11px] font-mono transition-colors ${
                              m.shared
                                ? "text-green-400/50 hover:text-green-400/70"
                                : "text-white/15 hover:text-white/30"
                            }`}
                          >
                            {m.shared ? "shared ✓" : "share"}
                          </button>
                          <button
                            onClick={() => deleteMemory(m.id)}
                            disabled={saving}
                            className="text-[11px] font-mono text-white/10 hover:text-red-400/50 transition-colors"
                          >
                            delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Bot skills */}
            {botTab === "skills" && (
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-white/15 mb-4 text-center">
                  skills & permissions · {skills.length}
                </div>
                {skills.map((s) => {
                  const isOn = s.bots[activeBot.id] || false;
                  const isOrigin = s.by === activeBot.id;
                  return (
                    <div key={s.id} className="border border-white/5 rounded-xl px-4 py-3 hover:border-white/10 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-white/50">{s.name}</span>
                            {isOrigin && <span className="text-[9px] font-mono text-white/15 bg-white/5 px-1.5 py-0.5 rounded">origin</span>}
                          </div>
                          <p className="text-[11px] font-mono text-white/20 mt-1">{s.desc}</p>
                        </div>
                        <button
                          onClick={() => toggleSkill(s.id, activeBot.id)}
                          disabled={saving}
                          className={`w-10 h-5 rounded-full flex items-center transition-all ml-4 flex-shrink-0 ${
                            isOn ? "bg-green-500/30 justify-end" : "bg-white/5 justify-start"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full mx-0.5 transition-all ${
                            isOn ? "bg-green-400/70" : "bg-white/15"
                          }`} />
                        </button>
                      </div>
                      {/* Other bots status */}
                      <div className="flex gap-3 mt-2">
                        {BOTS.filter((b) => b.id !== activeBot.id).map((b) => (
                          <span key={b.id} className={`text-[10px] font-mono ${s.bots[b.id] ? "text-white/25" : "text-white/8"}`}>
                            {b.emoji} {s.bots[b.id] ? "on" : "off"}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!view && (
          <div className="text-center py-8 text-xs font-mono text-white/10">
            tap a bot or the brain
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/8 backdrop-blur rounded-full text-[11px] font-mono text-white/50 z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
