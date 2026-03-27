"use client";

import { useState, useEffect, useCallback } from "react";

interface Memory { id: string; text: string; shared: boolean; ts: string; }
interface Persona { name: string; emoji: string; tone: string; callUser: string; role: string; bio: string; }
interface BotData {
  persona: Persona;
  memories: Memory[];
  skills: Record<string, boolean>;
  updatedAt: string | null;
}

const BOT_IDS = ["woovis", "9oovis", "pulmang"] as const;
type View = null | "brain" | typeof BOT_IDS[number];
type Section = "persona" | "memory" | "skills";

const EMPTY_PERSONA: Persona = { name: "", emoji: "?", tone: "", callUser: "", role: "", bio: "" };
const EMPTY_BOT: BotData = { persona: EMPTY_PERSONA, memories: [], skills: {}, updatedAt: null };

export default function AIPage() {
  const [bots, setBots] = useState<Record<string, { data: BotData; sha: string | null }>>({});
  const [view, setView] = useState<View>(null);
  const [section, setSection] = useState<Section>("persona");
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
    if (d.ok) {
      setBots((prev) => ({ ...prev, [id]: { data, sha: d.sha } }));
    }
    setSaving(false);
    return d.ok;
  };

  // Memory actions
  const toggleShare = async (memId: string) => {
    if (!view || view === "brain") return;
    const b = bot(view);
    const next = { ...b, memories: b.memories.map((m) => m.id === memId ? { ...m, shared: !m.shared } : m) };
    if (await saveBot(view, next)) showToast("updated");
  };

  const deleteMemory = async (memId: string) => {
    if (!view || view === "brain") return;
    const b = bot(view);
    const next = { ...b, memories: b.memories.filter((m) => m.id !== memId) };
    if (await saveBot(view, next)) showToast("deleted");
  };

  // Skill toggle
  const toggleSkill = async (skill: string) => {
    if (!view || view === "brain") return;
    const b = bot(view);
    const next = { ...b, skills: { ...b.skills, [skill]: !b.skills[skill] } };
    if (await saveBot(view, next)) showToast("updated");
  };

  // Persona save
  const savePersona = async () => {
    if (!view || view === "brain") return;
    const next = { ...bot(view), persona: editP };
    if (await saveBot(view, next)) { setEditingPersona(false); showToast("saved"); }
  };

  // All shared memories
  const sharedMemories = BOT_IDS.flatMap((id) =>
    bot(id).memories.filter((m) => m.shared).map((m) => ({ ...m, owner: id }))
  );

  // All unique skills across bots
  const allSkills = [...new Set(BOT_IDS.flatMap((id) => Object.keys(bot(id).skills)))].sort();

  const activeBot = view && view !== "brain" ? view : null;

  return (
    <div className="fixed inset-0 bg-[#06060f] overflow-y-auto">
      <div className="w-full max-w-md mx-auto px-5 py-8 min-h-screen">

        <a href="/" className="text-[10px] font-mono text-white/10 hover:text-white/25 block mb-10">←</a>

        {/* Hub */}
        <div className="flex flex-col items-center gap-5 mb-8">
          <button
            onClick={() => setView(view === "brain" ? null : "brain")}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all ${
              view === "brain" ? "bg-white/10 ring-1 ring-white/15" : "bg-white/[0.03] hover:bg-white/[0.06]"
            }`}
          >🧠</button>

          <div className="flex gap-8">
            {BOT_IDS.map((id) => {
              const p = bot(id).persona;
              const updated = bot(id).updatedAt;
              return (
                <button
                  key={id}
                  onClick={() => { setView(view === id ? null : id); setSection("persona"); setEditingPersona(false); }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all ${
                    view === id ? "bg-white/10 ring-1 ring-white/15" : "bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}>{p.emoji}</div>
                  <span className={`text-[10px] font-mono ${view === id ? "text-white/40" : "text-white/12"}`}>
                    {p.name || id}
                  </span>
                  {!updated && <span className="text-[8px] font-mono text-white/8">not synced</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Brain — shared memories */}
        {view === "brain" && (
          <div>
            <p className="text-[10px] font-mono text-white/12 text-center mb-4">shared · {sharedMemories.length}</p>
            {sharedMemories.length === 0 ? (
              <p className="text-center text-xs font-mono text-white/8 py-6">empty</p>
            ) : sharedMemories.map((m) => (
              <div key={`${m.owner}-${m.id}`} className="py-3 border-b border-white/[0.03]">
                <p className="text-[13px] font-mono text-white/35 leading-relaxed">{m.text}</p>
                <span className="text-[10px] font-mono text-white/8 mt-1 block">
                  {bot(m.owner).persona.emoji} {bot(m.owner).persona.name || m.owner}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Bot detail */}
        {activeBot && (() => {
          const b = bot(activeBot);
          const p = b.persona;
          return (
            <div>
              <div className="flex justify-center gap-1 mb-6">
                {(["persona", "memory", "skills"] as Section[]).map((s) => (
                  <button key={s} onClick={() => { setSection(s); setEditingPersona(false); }}
                    className={`px-4 py-1.5 text-[10px] font-mono rounded-full ${
                      section === s ? "bg-white/8 text-white/50" : "text-white/12"
                    }`}>{s}</button>
                ))}
              </div>

              {/* Persona */}
              {section === "persona" && (
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
                      <button onClick={savePersona} disabled={saving} className="text-[11px] font-mono text-green-400/40 hover:text-green-400/70">save</button>
                      <button onClick={() => setEditingPersona(false)} className="text-[11px] font-mono text-white/15">cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {(Object.keys(EMPTY_PERSONA) as (keyof Persona)[]).map((key) => (
                      <div key={key} className="flex justify-between py-2 border-b border-white/[0.03]">
                        <span className="text-[11px] font-mono text-white/15">{key}</span>
                        <span className="text-[13px] font-mono text-white/35 text-right max-w-[60%]">{p[key] || "—"}</span>
                      </div>
                    ))}
                    <button onClick={() => { setEditingPersona(true); setEditP({ ...p }); }}
                      className="mt-5 text-[11px] font-mono text-white/12 hover:text-white/30 block mx-auto">edit</button>
                    {b.updatedAt && (
                      <p className="text-[9px] font-mono text-white/8 text-center mt-3">
                        last sync: {new Date(b.updatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                      </p>
                    )}
                  </div>
                )
              )}

              {/* Memory */}
              {section === "memory" && (
                <div>
                  <p className="text-[10px] font-mono text-white/10 text-center mb-3">{b.memories.length} items</p>
                  {b.memories.length === 0 ? (
                    <p className="text-center text-xs font-mono text-white/8 py-6">no memories yet</p>
                  ) : b.memories.map((m) => (
                    <div key={m.id} className="py-3 border-b border-white/[0.03]">
                      <p className="text-[13px] font-mono text-white/35 leading-relaxed">{m.text}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] font-mono text-white/8">{m.ts}</span>
                        <div className="flex gap-4">
                          <button onClick={() => toggleShare(m.id)} disabled={saving}
                            className={`text-[10px] font-mono ${m.shared ? "text-green-400/40" : "text-white/10 hover:text-white/25"}`}>
                            {m.shared ? "shared" : "share"}
                          </button>
                          <button onClick={() => deleteMemory(m.id)} disabled={saving}
                            className="text-[10px] font-mono text-white/8 hover:text-red-400/40">×</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Skills */}
              {section === "skills" && (
                <div>
                  <p className="text-[10px] font-mono text-white/10 text-center mb-3">{allSkills.length} skills</p>
                  {allSkills.map((skill) => {
                    const on = b.skills[skill] || false;
                    // Check which bot originally has this skill
                    const origins = BOT_IDS.filter((id) => bot(id).skills[skill]);
                    return (
                      <div key={skill} className="flex items-center justify-between py-3 border-b border-white/[0.03]">
                        <div className="flex-1 min-w-0 mr-4">
                          <span className="text-[13px] font-mono text-white/35">{skill}</span>
                          <div className="flex gap-2 mt-1">
                            {BOT_IDS.map((id) => (
                              <span key={id} className={`text-[9px] font-mono ${bot(id).skills[skill] ? "text-white/20" : "text-white/5"}`}>
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
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {!view && <p className="text-center text-[11px] font-mono text-white/8 py-6">select</p>}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/6 backdrop-blur rounded-full text-[10px] font-mono text-white/40 z-50">{toast}</div>
      )}
    </div>
  );
}
