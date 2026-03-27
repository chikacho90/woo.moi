"use client";

import { useState, useEffect, useCallback } from "react";

interface Memory { id: string; text: string; shared: boolean; ts: string; }
interface Persona { name: string; emoji: string; tone: string; callUser: string; role: string; bio: string; }
interface BotData { persona: Persona; memories: Memory[]; skills: Record<string, boolean>; updatedAt: string | null; }

const BOT_IDS = ["woovis", "9oovis", "pulmang"] as const;
const EMPTY_PERSONA: Persona = { name: "", emoji: "?", tone: "", callUser: "", role: "", bio: "" };
const EMPTY_BOT: BotData = { persona: EMPTY_PERSONA, memories: [], skills: {}, updatedAt: null };
const BOT_COLORS: Record<string, string> = { woovis: "#8b5cf6", "9oovis": "#06b6d4", pulmang: "#f97316" };
const BOT_ANGLES = [210, 330, 90];
const ORBIT_R = 120;

type Modal = null | "brain" | typeof BOT_IDS[number];
type BrainTab = "memory" | "skills";

export default function AIPage() {
  const [bots, setBots] = useState<Record<string, { data: BotData; sha: string | null }>>({});
  const [modal, setModal] = useState<Modal>(null);
  const [brainTab, setBrainTab] = useState<BrainTab>("memory");
  const [editingPersona, setEditingPersona] = useState(false);
  const [editP, setEditP] = useState<Persona>(EMPTY_PERSONA);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 1800); };

  const load = useCallback(async () => {
    const r = await fetch("/ai/api/data");
    const d = await r.json();
    const mapped: Record<string, { data: BotData; sha: string | null }> = {};
    for (const id of BOT_IDS) {
      mapped[id] = d[id] || { data: EMPTY_BOT, sha: null };
      if (!mapped[id].data) mapped[id].data = EMPTY_BOT;
    }
    setBots(mapped);
  }, []);

  useEffect(() => { load(); }, [load]);

  const bot = (id: string): BotData => bots[id]?.data || EMPTY_BOT;
  const sha = (id: string) => bots[id]?.sha || null;

  const saveBot = async (id: string, data: BotData) => {
    setSaving(true);
    const r = await fetch("/ai/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bot: id, data, sha: sha(id) }),
    });
    const d = await r.json();
    if (d.ok) setBots((prev) => ({ ...prev, [id]: { data, sha: d.sha } }));
    setSaving(false);
    return d.ok;
  };

  // Toggle a memory's visibility for a specific bot
  // If memory belongs to that bot: toggle shared flag
  // If memory belongs to another bot: we need to copy/remove from target bot
  const toggleMemoryForBot = async (memId: string, ownerBot: string, targetBot: string) => {
    if (ownerBot === targetBot) {
      // Toggle shared on the owner's memory
      const b = bot(ownerBot);
      const mem = b.memories.find((m) => m.id === memId);
      if (!mem) return;
      // Can't turn off for owner — owner always has it
      return;
    }
    // For other bots: copy or remove the memory
    const ownerData = bot(ownerBot);
    const mem = ownerData.memories.find((m) => m.id === memId);
    if (!mem) return;
    const targetData = bot(targetBot);
    const has = targetData.memories.some((m) => m.id === memId);
    let next: BotData;
    if (has) {
      next = { ...targetData, memories: targetData.memories.filter((m) => m.id !== memId) };
    } else {
      next = { ...targetData, memories: [...targetData.memories, { ...mem, shared: true }] };
    }
    if (await saveBot(targetBot, next)) showToast(has ? "removed" : "synced");
  };

  // Toggle a skill for a specific bot
  const toggleSkillForBot = async (skill: string, botId: string) => {
    const b = bot(botId);
    const next = { ...b, skills: { ...b.skills, [skill]: !b.skills[skill] } };
    if (await saveBot(botId, next)) showToast("updated");
  };

  const savePersona = async (botId: string) => {
    const next = { ...bot(botId), persona: editP };
    if (await saveBot(botId, next)) { setEditingPersona(false); showToast("saved"); }
  };

  const closeModal = () => { setModal(null); setEditingPersona(false); };

  // All unique memories across all bots (deduplicated by id, keep owner info)
  const allMemories: { id: string; text: string; ts: string; owner: string; bots: string[] }[] = [];
  const seenMem = new Set<string>();
  for (const id of BOT_IDS) {
    for (const m of bot(id).memories) {
      if (!seenMem.has(m.id)) {
        seenMem.add(m.id);
        const inBots = BOT_IDS.filter((bid) => bot(bid).memories.some((bm) => bm.id === m.id));
        allMemories.push({ id: m.id, text: m.text, ts: m.ts, owner: id, bots: [...inBots] });
      }
    }
  }

  // All unique skills across all bots
  const allSkills = [...new Set(BOT_IDS.flatMap((id) => Object.keys(bot(id).skills)))].sort();

  const pos = (angle: number, dist: number) => ({
    x: Math.cos((angle * Math.PI) / 180) * dist,
    y: -Math.sin((angle * Math.PI) / 180) * dist,
  });

  const activeBotId = modal && modal !== "brain" ? modal : null;

  return (
    <div className="fixed inset-0 bg-[#06060f] overflow-hidden select-none" onClick={closeModal}>

      {/* Dot grid */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      <a href="/" onClick={(e) => e.stopPropagation()}
        className="fixed top-5 left-5 text-[10px] font-mono text-white/8 hover:text-white/20 z-50 transition-colors">← home</a>

      {/* Canvas */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ width: 320, height: 320 }}>

          {/* Connection lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 320 320">
            <defs>
              {BOT_IDS.map((id, i) => (
                <linearGradient key={id} id={`line-${id}`} x1="50%" y1="50%"
                  x2={`${50 + Math.cos((BOT_ANGLES[i] * Math.PI) / 180) * 50}%`}
                  y2={`${50 - Math.sin((BOT_ANGLES[i] * Math.PI) / 180) * 50}%`}>
                  <stop offset="0%" stopColor="white" stopOpacity={modal === id ? 0.12 : 0.04} />
                  <stop offset="100%" stopColor={BOT_COLORS[id]} stopOpacity={modal === id ? 0.25 : 0.06} />
                </linearGradient>
              ))}
            </defs>
            {BOT_IDS.map((id, i) => {
              const p = pos(BOT_ANGLES[i], ORBIT_R);
              return <line key={id} x1="160" y1="160" x2={160 + p.x} y2={160 + p.y}
                stroke={`url(#line-${id})`} strokeWidth={modal === id ? 1.5 : 0.5} className="transition-all duration-500" />;
            })}
          </svg>

          {/* Brain glow */}
          <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full transition-all duration-700 ${
            modal === "brain" ? "opacity-100" : "opacity-40"
          }`} style={{ background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)", animation: "breathe 4s ease-in-out infinite" }} />

          {/* Brain */}
          <button
            onClick={(e) => { e.stopPropagation(); setModal(modal === "brain" ? null : "brain"); setEditingPersona(false); }}
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full flex items-center justify-center text-2xl z-20 transition-all duration-300 ${
              modal === "brain" ? "bg-white/10 ring-1 ring-purple-400/20 shadow-lg shadow-purple-500/10 scale-105" : "bg-white/[0.03] hover:bg-white/[0.06] hover:scale-105"
            }`}
          >🧠</button>
          <span className={`absolute left-1/2 -translate-x-1/2 text-[9px] font-mono tracking-wider transition-all duration-300 ${
            modal === "brain" ? "text-white/20" : "text-white/6"
          }`} style={{ top: "calc(50% + 38px)" }}>brain</span>

          {/* Bots */}
          {BOT_IDS.map((id, i) => {
            const p = pos(BOT_ANGLES[i], ORBIT_R);
            const persona = bot(id).persona;
            const isActive = modal === id;
            const color = BOT_COLORS[id];

            return (
              <div key={id} className="absolute left-1/2 top-1/2 z-10"
                style={{ transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px))` }}>
                <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full transition-all duration-500 ${
                  isActive ? "opacity-100" : "opacity-0"
                }`} style={{ background: `radial-gradient(circle, ${color}15 0%, transparent 70%)` }} />
                <button
                  onClick={(e) => { e.stopPropagation(); setModal(isActive ? null : id); setEditingPersona(false); }}
                  className={`relative w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all duration-300 ${
                    isActive ? "bg-white/10 scale-110" : "bg-white/[0.03] hover:bg-white/[0.06] hover:scale-105"
                  }`}
                  style={isActive ? { boxShadow: `0 0 20px ${color}20, inset 0 0 20px ${color}08` } : {}}
                >{persona.emoji}</button>
                <div className="absolute left-1/2 -translate-x-1/2 mt-2 flex flex-col items-center gap-0.5">
                  <span className={`text-[10px] font-mono whitespace-nowrap transition-all duration-300 ${
                    isActive ? "text-white/40" : "text-white/10"
                  }`}>{persona.name || id}</span>
                  {!bot(id).updatedAt && <span className="text-[7px] font-mono text-white/6">not synced</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-5" onClick={closeModal}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn" />
          <div className="relative w-full max-w-sm max-h-[75vh] bg-[#0c0c18]/95 border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl shadow-black/60 animate-modalIn"
            onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="sticky top-0 bg-[#0c0c18]/90 backdrop-blur-md border-b border-white/[0.04] px-5 py-3 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                {modal === "brain" ? (
                  <>
                    <span className="text-sm">🧠</span>
                    <div className="flex gap-0.5 ml-2">
                      {(["memory", "skills"] as BrainTab[]).map((t) => (
                        <button key={t} onClick={() => setBrainTab(t)}
                          className={`px-3 py-1 text-[10px] font-mono rounded-full transition-all ${
                            brainTab === t ? "bg-white/8 text-white/40" : "text-white/12 hover:text-white/25"
                          }`}>{t}</button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-sm">{bot(modal).persona.emoji}</span>
                    <span className="text-[12px] font-mono text-white/30">{bot(modal).persona.name || modal}</span>
                  </>
                )}
              </div>
              <button onClick={closeModal}
                className="w-6 h-6 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/20 text-xs transition-all">✕</button>
            </div>

            {/* Content */}
            <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: "calc(75vh - 52px)" }}>

              {/* Brain → Memory */}
              {modal === "brain" && brainTab === "memory" && (
                allMemories.length === 0 ? (
                  <p className="text-xs font-mono text-white/8 py-8 text-center">no memories</p>
                ) : (
                  <div>
                    <p className="text-[10px] font-mono text-white/10 mb-3">{allMemories.length} memories</p>
                    {allMemories.map((m) => (
                      <div key={m.id} className="py-3 border-b border-white/[0.03] last:border-0">
                        <p className="text-[13px] font-mono text-white/35 leading-relaxed">{m.text}</p>
                        <div className="flex items-center justify-between mt-2.5">
                          <span className="text-[9px] font-mono text-white/8">{m.ts} · from {bot(m.owner).persona.emoji}</span>
                          <div className="flex gap-1">
                            {BOT_IDS.map((bid) => {
                              const has = bot(bid).memories.some((bm) => bm.id === m.id);
                              const isOwner = bid === m.owner;
                              return (
                                <button key={bid}
                                  onClick={() => { if (!isOwner) toggleMemoryForBot(m.id, m.owner, bid); }}
                                  disabled={saving || isOwner}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
                                    has
                                      ? "bg-white/8"
                                      : "bg-white/[0.02] opacity-30 hover:opacity-60"
                                  } ${isOwner ? "ring-1 ring-white/10" : "hover:bg-white/10"}`}
                                  title={`${bot(bid).persona.name}: ${has ? "on" : "off"}${isOwner ? " (owner)" : ""}`}
                                >{bot(bid).persona.emoji}</button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Brain → Skills */}
              {modal === "brain" && brainTab === "skills" && (
                allSkills.length === 0 ? (
                  <p className="text-xs font-mono text-white/8 py-8 text-center">no skills</p>
                ) : (
                  <div>
                    <p className="text-[10px] font-mono text-white/10 mb-3">{allSkills.length} skills</p>
                    {allSkills.map((skill) => (
                      <div key={skill} className="py-3 border-b border-white/[0.03] last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-mono text-white/35">{skill}</span>
                          <div className="flex gap-1">
                            {BOT_IDS.map((bid) => {
                              const on = bot(bid).skills[skill] || false;
                              return (
                                <button key={bid}
                                  onClick={() => toggleSkillForBot(skill, bid)}
                                  disabled={saving}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
                                    on
                                      ? "bg-white/8"
                                      : "bg-white/[0.02] opacity-30 hover:opacity-60"
                                  } hover:bg-white/10`}
                                  title={`${bot(bid).persona.name}: ${on ? "on" : "off"}`}
                                >{bot(bid).persona.emoji}</button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Bot → Persona */}
              {activeBotId && (
                editingPersona ? (
                  <div className="space-y-4">
                    {(Object.keys(EMPTY_PERSONA) as (keyof Persona)[]).map((key) => (
                      <div key={key}>
                        <label className="text-[10px] font-mono text-white/15 block mb-1.5 uppercase tracking-wider">{key}</label>
                        <input value={editP[key]} onChange={(e) => setEditP({ ...editP, [key]: e.target.value })}
                          className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] font-mono text-white/50 focus:outline-none focus:border-white/15 transition-colors text-base" />
                      </div>
                    ))}
                    <div className="flex gap-3 pt-1">
                      <button onClick={() => savePersona(activeBotId)} disabled={saving}
                        className="px-4 py-1.5 rounded-lg bg-white/[0.06] text-[11px] font-mono text-green-400/50 hover:bg-white/10 transition-all">save</button>
                      <button onClick={() => setEditingPersona(false)}
                        className="px-4 py-1.5 text-[11px] font-mono text-white/15 hover:text-white/30 transition-colors">cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {(Object.keys(EMPTY_PERSONA) as (keyof Persona)[]).map((key) => (
                      <div key={key} className="flex items-start justify-between py-2.5 border-b border-white/[0.03] last:border-0">
                        <span className="text-[10px] font-mono text-white/12 uppercase tracking-wider pt-0.5">{key}</span>
                        <span className="text-[13px] font-mono text-white/35 text-right max-w-[65%] leading-relaxed">{bot(activeBotId).persona[key] || "—"}</span>
                      </div>
                    ))}
                    {bot(activeBotId).updatedAt && (
                      <p className="text-[9px] font-mono text-white/8 mt-3">
                        synced {new Date(bot(activeBotId).updatedAt!).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                      </p>
                    )}
                    <button onClick={() => { setEditingPersona(true); setEditP({ ...bot(activeBotId).persona }); }}
                      className="mt-4 px-4 py-1.5 rounded-lg bg-white/[0.04] text-[11px] font-mono text-white/15 hover:bg-white/[0.08] hover:text-white/30 transition-all block mx-auto">edit</button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-white/[0.06] backdrop-blur-md border border-white/[0.06] rounded-full text-[11px] font-mono text-white/40 z-50 animate-modalIn">
          {toast}
        </div>
      )}
    </div>
  );
}
