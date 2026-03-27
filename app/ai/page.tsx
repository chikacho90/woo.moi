"use client";

import { useState, useEffect, useCallback } from "react";

interface Memory { id: string; text: string; shared: boolean; ts: string; }
interface Persona { name: string; emoji: string; tone: string; callUser: string; role: string; bio: string; }
interface BotData { persona: Persona; memories: Memory[]; skills: Record<string, boolean>; updatedAt: string | null; }

const BOT_IDS = ["woovis", "9oovis", "pulmang"] as const;
const EMPTY_PERSONA: Persona = { name: "", emoji: "?", tone: "", callUser: "", role: "", bio: "" };
const EMPTY_BOT: BotData = { persona: EMPTY_PERSONA, memories: [], skills: {}, updatedAt: null };

// Bot positions around the brain (angle in degrees from center)
const BOT_POS = [
  { angle: 210, dist: 130 }, // woovis — bottom left
  { angle: 330, dist: 130 }, // 9oovis — bottom right
  { angle: 90, dist: 120 },  // pulmang — top
];

// Menu items that orbit around selected bot
const MENUS = [
  { id: "persona", icon: "👤", label: "persona", angle: -60 },
  { id: "memory", icon: "💭", label: "memory", angle: 0 },
  { id: "skills", icon: "⚡", label: "skills", angle: 60 },
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

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 1500); };

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
  const closeAll = () => { setActiveBot(null); setActiveMenu(null); setEditingPersona(false); };

  // Center of the canvas
  const cx = "50%";
  const cy = "45%";

  return (
    <div className="fixed inset-0 bg-[#06060f] overflow-hidden" onClick={closeAll}>
      {/* Back */}
      <a href="/" className="fixed top-5 left-5 text-[10px] font-mono text-white/10 hover:text-white/25 z-50" onClick={(e) => e.stopPropagation()}>←</a>

      {/* Canvas */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ width: 320, height: 320 }}>

          {/* Brain center */}
          <button
            onClick={(e) => { e.stopPropagation(); setActiveBot(null); setActiveMenu(activeMenu === "brain" ? null : "brain"); }}
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all z-20 ${
              activeMenu === "brain" ? "bg-white/12 ring-1 ring-white/20 scale-110" : "bg-white/[0.04] hover:bg-white/[0.08]"
            }`}
          >🧠</button>

          {/* Connection lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 320 320">
            {BOT_IDS.map((id, i) => {
              const rad = (BOT_POS[i].angle * Math.PI) / 180;
              const x = 160 + Math.cos(rad) * BOT_POS[i].dist;
              const y = 160 - Math.sin(rad) * BOT_POS[i].dist;
              return <line key={id} x1="160" y1="160" x2={x} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />;
            })}
          </svg>

          {/* Bots */}
          {BOT_IDS.map((id, i) => {
            const rad = (BOT_POS[i].angle * Math.PI) / 180;
            const x = Math.cos(rad) * BOT_POS[i].dist;
            const y = -Math.sin(rad) * BOT_POS[i].dist;
            const p = bot(id).persona;
            const isActive = activeBot === id;

            return (
              <div key={id} className="absolute left-1/2 top-1/2 z-10" style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}>
                {/* Bot button */}
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveBot(isActive ? null : id); setActiveMenu(null); setEditingPersona(false); }}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all ${
                    isActive ? "bg-white/12 ring-1 ring-white/20 scale-110" : "bg-white/[0.04] hover:bg-white/[0.08]"
                  }`}
                >{p.emoji}</button>

                {/* Bot name */}
                <div className={`absolute left-1/2 -translate-x-1/2 mt-1 text-[10px] font-mono whitespace-nowrap transition-colors ${
                  isActive ? "text-white/40" : "text-white/12"
                }`}>{p.name || id}</div>

                {/* Orbiting menu items */}
                {isActive && MENUS.map((menu) => {
                  const mRad = ((menu.angle + BOT_POS[i].angle + 180) * Math.PI) / 180;
                  const mx = Math.cos(mRad) * 50;
                  const my = -Math.sin(mRad) * 50;
                  return (
                    <button
                      key={menu.id}
                      onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === menu.id ? null : menu.id as ActiveMenu); setEditingPersona(false); }}
                      className={`absolute left-1/2 top-1/2 w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all animate-pop ${
                        activeMenu === menu.id ? "bg-white/15 scale-110" : "bg-white/[0.06] hover:bg-white/10"
                      }`}
                      style={{ transform: `translate(calc(-50% + ${mx}px), calc(-50% + ${my}px))` }}
                      title={menu.label}
                    >{menu.icon}</button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel overlay */}
      {(activeMenu) && (
        <div
          className="fixed inset-x-0 bottom-0 top-auto max-h-[60vh] bg-[#0a0a14] border-t border-white/5 overflow-y-auto z-40 rounded-t-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-md mx-auto px-5 py-5">
            {/* Panel header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-mono text-white/25">
                {activeMenu === "brain" ? "🧠 shared" : `${bot(activeBot!).persona.emoji} ${activeMenu}`}
              </span>
              <button onClick={closePanel} className="text-[11px] font-mono text-white/15 hover:text-white/30">×</button>
            </div>

            {/* Brain panel */}
            {activeMenu === "brain" && (
              sharedMemories.length === 0 ? (
                <p className="text-xs font-mono text-white/8 py-4 text-center">no shared memories</p>
              ) : sharedMemories.map((m) => (
                <div key={`${m.owner}-${m.id}`} className="py-2.5 border-b border-white/[0.03]">
                  <p className="text-[13px] font-mono text-white/35 leading-relaxed">{m.text}</p>
                  <span className="text-[9px] font-mono text-white/8">{bot(m.owner).persona.emoji} {m.owner}</span>
                </div>
              ))
            )}

            {/* Persona panel */}
            {activeMenu === "persona" && activeBot && (
              editingPersona ? (
                <div className="space-y-3">
                  {(Object.keys(EMPTY_PERSONA) as (keyof Persona)[]).map((key) => (
                    <div key={key}>
                      <label className="text-[10px] font-mono text-white/15 block mb-1">{key}</label>
                      <input value={editP[key]} onChange={(e) => setEditP({ ...editP, [key]: e.target.value })}
                        className="w-full bg-transparent border-b border-white/8 px-1 py-1.5 text-sm font-mono text-white/50 focus:outline-none focus:border-white/20" />
                    </div>
                  ))}
                  <div className="flex gap-3 pt-2">
                    <button onClick={savePersona} disabled={saving} className="text-[11px] font-mono text-green-400/40">save</button>
                    <button onClick={() => setEditingPersona(false)} className="text-[11px] font-mono text-white/15">cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  {(Object.keys(EMPTY_PERSONA) as (keyof Persona)[]).map((key) => (
                    <div key={key} className="flex justify-between py-2 border-b border-white/[0.03]">
                      <span className="text-[11px] font-mono text-white/15">{key}</span>
                      <span className="text-[13px] font-mono text-white/35 text-right max-w-[60%]">{bot(activeBot).persona[key] || "—"}</span>
                    </div>
                  ))}
                  <button onClick={() => { setEditingPersona(true); setEditP({ ...bot(activeBot).persona }); }}
                    className="mt-4 text-[11px] font-mono text-white/12 hover:text-white/30 block mx-auto">edit</button>
                </div>
              )
            )}

            {/* Memory panel */}
            {activeMenu === "memory" && activeBot && (
              bot(activeBot).memories.length === 0 ? (
                <p className="text-xs font-mono text-white/8 py-4 text-center">no memories</p>
              ) : bot(activeBot).memories.map((m) => (
                <div key={m.id} className="py-2.5 border-b border-white/[0.03]">
                  <p className="text-[13px] font-mono text-white/35 leading-relaxed">{m.text}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[9px] font-mono text-white/8">{m.ts}</span>
                    <div className="flex gap-4">
                      <button onClick={() => toggleShare(m.id)} disabled={saving}
                        className={`text-[10px] font-mono ${m.shared ? "text-green-400/40" : "text-white/10"}`}>
                        {m.shared ? "shared" : "share"}
                      </button>
                      <button onClick={() => deleteMemory(m.id)} disabled={saving}
                        className="text-[10px] font-mono text-white/8 hover:text-red-400/40">×</button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Skills panel */}
            {activeMenu === "skills" && activeBot && (
              allSkills.length === 0 ? (
                <p className="text-xs font-mono text-white/8 py-4 text-center">no skills</p>
              ) : allSkills.map((skill) => {
                const on = bot(activeBot).skills[skill] || false;
                return (
                  <div key={skill} className="flex items-center justify-between py-2.5 border-b border-white/[0.03]">
                    <div className="flex-1 min-w-0 mr-3">
                      <span className="text-[13px] font-mono text-white/35">{skill}</span>
                      <div className="flex gap-1.5 mt-0.5">
                        {BOT_IDS.map((id) => (
                          <span key={id} className={`text-[9px] ${bot(id).skills[skill] ? "opacity-40" : "opacity-10"}`}>
                            {bot(id).persona.emoji}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => toggleSkill(skill)} disabled={saving}
                      className={`w-8 h-4 rounded-full flex items-center transition-all flex-shrink-0 ${
                        on ? "bg-green-500/25 justify-end" : "bg-white/5 justify-start"
                      }`}>
                      <div className={`w-3.5 h-3.5 rounded-full mx-px ${on ? "bg-green-400/60" : "bg-white/10"}`} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/6 backdrop-blur rounded-full text-[10px] font-mono text-white/40 z-50">{toast}</div>
      )}
    </div>
  );
}
