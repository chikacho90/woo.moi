"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Memory { id: string; text: string; shared: boolean; ts: string; }
interface Persona { name: string; emoji: string; tone: string; callUser: string; role: string; bio: string; }
interface BotData { persona: Persona; memories: Memory[]; skills: Record<string, boolean>; updatedAt: string | null; }

const BOT_IDS = ["woovis", "9oovis", "pulmang"] as const;
const EMPTY_PERSONA: Persona = { name: "", emoji: "?", tone: "", callUser: "", role: "", bio: "" };
const EMPTY_BOT: BotData = { persona: EMPTY_PERSONA, memories: [], skills: {}, updatedAt: null };

const BOT_COLORS = { woovis: "#8b5cf6", "9oovis": "#06b6d4", pulmang: "#f97316" };
const BOT_ANGLES = [210, 330, 90]; // degrees from center
const ORBIT_R = 120;

const MENU_ITEMS = [
  { id: "persona" as const, icon: "👤", label: "Identity" },
  { id: "memory" as const, icon: "💭", label: "Memory" },
  { id: "skills" as const, icon: "⚡", label: "Skills" },
];

type ActiveBot = typeof BOT_IDS[number] | null;
type ActiveMenu = "persona" | "memory" | "skills" | "brain" | null;

export default function AIPage() {
  const [bots, setBots] = useState<Record<string, { data: BotData; sha: string | null }>>({});
  const [activeBot, setActiveBot] = useState<ActiveBot>(null);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);
  const [editingPersona, setEditingPersona] = useState(false);
  const [editP, setEditP] = useState<Persona>(EMPTY_PERSONA);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

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

  const toggleShare = async (memId: string) => {
    if (!activeBot) return;
    const b = bot(activeBot);
    const next = { ...b, memories: b.memories.map((m) => m.id === memId ? { ...m, shared: !m.shared } : m) };
    if (await saveBot(activeBot, next)) showToast("updated");
  };
  const deleteMemory = async (memId: string) => {
    if (!activeBot) return;
    const b = bot(activeBot);
    const next = { ...b, memories: b.memories.filter((m) => m.id !== memId) };
    if (await saveBot(activeBot, next)) showToast("deleted");
  };
  const toggleSkill = async (skill: string) => {
    if (!activeBot) return;
    const b = bot(activeBot);
    const next = { ...b, skills: { ...b.skills, [skill]: !b.skills[skill] } };
    if (await saveBot(activeBot, next)) showToast("updated");
  };
  const savePersona = async () => {
    if (!activeBot) return;
    const next = { ...bot(activeBot), persona: editP };
    if (await saveBot(activeBot, next)) { setEditingPersona(false); showToast("saved"); }
  };

  const sharedMemories = BOT_IDS.flatMap((id) =>
    bot(id).memories.filter((m) => m.shared).map((m) => ({ ...m, owner: id }))
  );
  const allSkills = [...new Set(BOT_IDS.flatMap((id) => Object.keys(bot(id).skills)))].sort();

  const closePanel = () => { setActiveMenu(null); setEditingPersona(false); };
  const closeAll = () => { setActiveBot(null); closePanel(); };

  // Position helpers
  const pos = (angle: number, dist: number) => ({
    x: Math.cos((angle * Math.PI) / 180) * dist,
    y: -Math.sin((angle * Math.PI) / 180) * dist,
  });

  return (
    <div className="fixed inset-0 bg-[#06060f] overflow-hidden select-none" onClick={closeAll}>

      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Back */}
      <a href="/" onClick={(e) => e.stopPropagation()}
        className="fixed top-5 left-5 text-[10px] font-mono text-white/8 hover:text-white/20 z-50 transition-colors">← home</a>

      {/* Canvas */}
      <div className="absolute inset-0 flex items-center justify-center" ref={canvasRef}>
        <div className="relative" style={{ width: 320, height: 320 }}>

          {/* SVG connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 320 320">
            <defs>
              {BOT_IDS.map((id, i) => (
                <linearGradient key={id} id={`line-${id}`} x1="50%" y1="50%"
                  x2={`${50 + Math.cos((BOT_ANGLES[i] * Math.PI) / 180) * 50}%`}
                  y2={`${50 - Math.sin((BOT_ANGLES[i] * Math.PI) / 180) * 50}%`}>
                  <stop offset="0%" stopColor="white" stopOpacity={activeBot === id ? 0.12 : 0.04} />
                  <stop offset="100%" stopColor={BOT_COLORS[id]} stopOpacity={activeBot === id ? 0.25 : 0.06} />
                </linearGradient>
              ))}
            </defs>
            {BOT_IDS.map((id, i) => {
              const p = pos(BOT_ANGLES[i], ORBIT_R);
              return (
                <line key={id} x1="160" y1="160" x2={160 + p.x} y2={160 + p.y}
                  stroke={`url(#line-${id})`} strokeWidth={activeBot === id ? 1.5 : 0.5}
                  className="transition-all duration-500" />
              );
            })}
          </svg>

          {/* Brain glow */}
          <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full transition-all duration-700 ${
            activeMenu === "brain" ? "opacity-100" : "opacity-40"
          }`} style={{
            background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
            animation: "breathe 4s ease-in-out infinite",
          }} />

          {/* Brain */}
          <button
            onClick={(e) => { e.stopPropagation(); setActiveBot(null); setActiveMenu(activeMenu === "brain" ? null : "brain"); }}
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full flex items-center justify-center text-2xl z-20 transition-all duration-300 ${
              activeMenu === "brain"
                ? "bg-white/10 ring-1 ring-purple-400/20 shadow-lg shadow-purple-500/10 scale-105"
                : "bg-white/[0.03] hover:bg-white/[0.06] hover:scale-105"
            }`}
          >🧠</button>
          <span className={`absolute left-1/2 -translate-x-1/2 text-[9px] font-mono tracking-wider uppercase transition-all duration-300 ${
            activeMenu === "brain" ? "text-white/20" : "text-white/6"
          }`} style={{ top: "calc(50% + 38px)" }}>brain</span>

          {/* Bots */}
          {BOT_IDS.map((id, i) => {
            const p = pos(BOT_ANGLES[i], ORBIT_R);
            const persona = bot(id).persona;
            const isActive = activeBot === id;
            const color = BOT_COLORS[id];
            const synced = bot(id).updatedAt;

            return (
              <div key={id} className="absolute left-1/2 top-1/2 z-10"
                style={{ transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px))` }}>

                {/* Bot glow */}
                <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full transition-all duration-500 ${
                  isActive ? "opacity-100" : "opacity-0"
                }`} style={{ background: `radial-gradient(circle, ${color}15 0%, transparent 70%)` }} />

                {/* Bot node */}
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveBot(isActive ? null : id); setActiveMenu(null); setEditingPersona(false); }}
                  className={`relative w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all duration-300 ${
                    isActive
                      ? "bg-white/10 scale-110"
                      : "bg-white/[0.03] hover:bg-white/[0.06] hover:scale-105"
                  }`}
                  style={isActive ? { boxShadow: `0 0 20px ${color}20, inset 0 0 20px ${color}08` } : {}}
                >{persona.emoji}</button>

                {/* Name + status */}
                <div className="absolute left-1/2 -translate-x-1/2 mt-2 flex flex-col items-center gap-0.5">
                  <span className={`text-[10px] font-mono whitespace-nowrap transition-all duration-300 ${
                    isActive ? "text-white/40" : "text-white/10"
                  }`}>{persona.name || id}</span>
                  {!synced && <span className="text-[7px] font-mono text-white/6">not synced</span>}
                </div>

                {/* Orbiting menus */}
                {isActive && MENU_ITEMS.map((menu, mi) => {
                  const spread = 55;
                  const baseAngle = BOT_ANGLES[i] + 180; // face away from center
                  const menuAngle = baseAngle + (mi - 1) * 45;
                  const mp = pos(menuAngle, spread);
                  return (
                    <div key={menu.id} className="absolute"
                      style={{
                        left: `calc(50% + ${mp.x}px - 16px)`,
                        top: `calc(50% + ${mp.y}px - 16px)`,
                        animation: `pop 0.2s ${mi * 40}ms cubic-bezier(0.34,1.56,0.64,1) both`,
                      }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === menu.id ? null : menu.id); setEditingPersona(false); }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-200 ${
                          activeMenu === menu.id
                            ? "bg-white/12 scale-110"
                            : "bg-white/[0.05] hover:bg-white/10 hover:scale-110"
                        }`}
                        style={activeMenu === menu.id ? { boxShadow: `0 0 12px ${color}15` } : {}}
                        title={menu.label}
                      >{menu.icon}</button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal */}
      {activeMenu && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-5" onClick={closePanel}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn" />

          {/* Card */}
          <div className="relative w-full max-w-sm max-h-[70vh] bg-[#0c0c18]/95 border border-white/[0.06] rounded-2xl overflow-hidden shadow-2xl shadow-black/60 animate-modalIn"
            onClick={(e) => e.stopPropagation()}>

            {/* Header bar */}
            <div className="sticky top-0 bg-[#0c0c18]/90 backdrop-blur-md border-b border-white/[0.04] px-5 py-3 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                {activeMenu === "brain" ? (
                  <span className="text-sm">🧠</span>
                ) : (
                  <span className="text-sm">{MENU_ITEMS.find((m) => m.id === activeMenu)?.icon}</span>
                )}
                <span className="text-[12px] font-mono text-white/30 tracking-wide">
                  {activeMenu === "brain" ? "Shared Brain" : `${bot(activeBot!).persona.name || activeBot} / ${activeMenu}`}
                </span>
              </div>
              <button onClick={closePanel} className="w-6 h-6 rounded-full bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/20 text-xs transition-all">✕</button>
            </div>

            {/* Content */}
            <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: "calc(70vh - 52px)" }}>

              {/* Brain */}
              {activeMenu === "brain" && (
                sharedMemories.length === 0 ? (
                  <p className="text-xs font-mono text-white/8 py-8 text-center">no shared memories yet</p>
                ) : (
                  <div className="space-y-1">
                    {sharedMemories.map((m) => (
                      <div key={`${m.owner}-${m.id}`} className="py-2.5 group">
                        <p className="text-[13px] font-mono text-white/35 leading-relaxed">{m.text}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs">{bot(m.owner).persona.emoji}</span>
                          <span className="text-[9px] font-mono text-white/10">{bot(m.owner).persona.name || m.owner}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Persona */}
              {activeMenu === "persona" && activeBot && (
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
                      <button onClick={savePersona} disabled={saving}
                        className="px-4 py-1.5 rounded-lg bg-white/[0.06] text-[11px] font-mono text-green-400/50 hover:bg-white/[0.1] transition-all">save</button>
                      <button onClick={() => setEditingPersona(false)}
                        className="px-4 py-1.5 text-[11px] font-mono text-white/15 hover:text-white/30 transition-colors">cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {(Object.keys(EMPTY_PERSONA) as (keyof Persona)[]).map((key) => (
                      <div key={key} className="flex items-start justify-between py-2.5 border-b border-white/[0.03] last:border-0">
                        <span className="text-[10px] font-mono text-white/12 uppercase tracking-wider pt-0.5">{key}</span>
                        <span className="text-[13px] font-mono text-white/35 text-right max-w-[65%] leading-relaxed">{bot(activeBot).persona[key] || "—"}</span>
                      </div>
                    ))}
                    {bot(activeBot).updatedAt && (
                      <p className="text-[9px] font-mono text-white/8 mt-3">
                        synced {new Date(bot(activeBot).updatedAt!).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                      </p>
                    )}
                    <button onClick={() => { setEditingPersona(true); setEditP({ ...bot(activeBot).persona }); }}
                      className="mt-4 px-4 py-1.5 rounded-lg bg-white/[0.04] text-[11px] font-mono text-white/15 hover:bg-white/[0.08] hover:text-white/30 transition-all block mx-auto">edit</button>
                  </div>
                )
              )}

              {/* Memory */}
              {activeMenu === "memory" && activeBot && (
                bot(activeBot).memories.length === 0 ? (
                  <p className="text-xs font-mono text-white/8 py-8 text-center">no memories yet</p>
                ) : (
                  <div>
                    <p className="text-[10px] font-mono text-white/10 mb-3">{bot(activeBot).memories.length} memories</p>
                    {bot(activeBot).memories.map((m) => (
                      <div key={m.id} className="py-2.5 border-b border-white/[0.03] last:border-0 group">
                        <p className="text-[13px] font-mono text-white/35 leading-relaxed">{m.text}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[9px] font-mono text-white/8">{m.ts}</span>
                          <div className="flex gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => toggleShare(m.id)} disabled={saving}
                              className={`text-[10px] font-mono transition-colors ${m.shared ? "text-green-400/50" : "text-white/15 hover:text-white/30"}`}>
                              {m.shared ? "✓ shared" : "share"}
                            </button>
                            <button onClick={() => deleteMemory(m.id)} disabled={saving}
                              className="text-[10px] font-mono text-white/10 hover:text-red-400/50 transition-colors">delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Skills */}
              {activeMenu === "skills" && activeBot && (
                allSkills.length === 0 ? (
                  <p className="text-xs font-mono text-white/8 py-8 text-center">no skills registered</p>
                ) : (
                  <div>
                    <p className="text-[10px] font-mono text-white/10 mb-3">{Object.values(bot(activeBot).skills).filter(Boolean).length} / {allSkills.length} active</p>
                    {allSkills.map((skill) => {
                      const on = bot(activeBot).skills[skill] || false;
                      return (
                        <div key={skill} className="flex items-center justify-between py-2.5 border-b border-white/[0.03] last:border-0">
                          <div className="flex-1 min-w-0 mr-3">
                            <span className={`text-[13px] font-mono transition-colors ${on ? "text-white/35" : "text-white/12"}`}>{skill}</span>
                            <div className="flex gap-1 mt-1">
                              {BOT_IDS.map((bid) => (
                                <span key={bid} className={`text-[8px] transition-opacity ${bot(bid).skills[skill] ? "opacity-50" : "opacity-10"}`}>
                                  {bot(bid).persona.emoji}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button onClick={() => toggleSkill(skill)} disabled={saving}
                            className={`w-9 h-5 rounded-full flex items-center transition-all duration-200 flex-shrink-0 ${
                              on ? "justify-end" : "justify-start"
                            }`}
                            style={{ background: on ? `${BOT_COLORS[activeBot]}25` : "rgba(255,255,255,0.04)" }}>
                            <div className={`w-4 h-4 rounded-full mx-0.5 transition-all duration-200 ${on ? "bg-white/40" : "bg-white/8"}`}
                              style={on ? { boxShadow: `0 0 6px ${BOT_COLORS[activeBot]}40` } : {}} />
                          </button>
                        </div>
                      );
                    })}
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
