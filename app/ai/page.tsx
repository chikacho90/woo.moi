"use client";

import { useState, useEffect, useCallback } from "react";

interface Memory { id: string; text: string; owner: string; shared: boolean; ts: string; }
interface Skill { id: string; name: string; desc: string; by: string; bots: Record<string, boolean>; }
interface Persona { name: string; emoji: string; tone: string; callUser: string; role: string; bio: string; }

const BOT_IDS = ["woovis", "9oovis", "pulmang"] as const;
type View = null | "brain" | typeof BOT_IDS[number];
type Section = "persona" | "memory" | "skills";

export default function AIPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [personas, setPersonas] = useState<Record<string, Persona>>({});
  const [shas, setShas] = useState<Record<string, string | null>>({ memories: null, skills: null, personas: null });
  const [view, setView] = useState<View>(null);
  const [section, setSection] = useState<Section>("persona");
  const [editingPersona, setEditingPersona] = useState(false);
  const [editPersona, setEditPersona] = useState<Persona | null>(null);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 1500); };

  const load = useCallback(async () => {
    const [m, s, p] = await Promise.all([
      fetch("/ai/api/data?type=memories").then((r) => r.json()),
      fetch("/ai/api/data?type=skills").then((r) => r.json()),
      fetch("/ai/api/data?type=personas").then((r) => r.json()),
    ]);
    setMemories(m.items || []);
    setSkills(s.items || []);
    const pData = Array.isArray(p.items) ? {} : (p.items || {});
    setPersonas(pData);
    setShas({ memories: m.sha, skills: s.sha, personas: p.sha });
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (type: string, data: unknown) => {
    setSaving(true);
    const r = await fetch("/ai/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, items: data, sha: shas[type] }),
    });
    const d = await r.json();
    if (d.ok) setShas((prev) => ({ ...prev, [type]: d.sha }));
    setSaving(false);
    return d.ok;
  };

  const toggleShare = async (id: string) => {
    const next = memories.map((m) => m.id === id ? { ...m, shared: !m.shared } : m);
    if (await save("memories", next)) { setMemories(next); showToast("updated"); }
  };

  const deleteMemory = async (id: string) => {
    const next = memories.filter((m) => m.id !== id);
    if (await save("memories", next)) { setMemories(next); showToast("deleted"); }
  };

  const toggleSkill = async (sid: string, bot: string) => {
    const next = skills.map((s) => s.id === sid ? { ...s, bots: { ...s.bots, [bot]: !s.bots[bot] } } : s);
    if (await save("skills", next)) { setSkills(next); showToast("updated"); }
  };

  const savePersona = async () => {
    if (!editPersona || !view || view === "brain") return;
    const next = { ...personas, [view]: editPersona };
    if (await save("personas", next)) { setPersonas(next); setEditingPersona(false); showToast("saved"); }
  };

  const persona = (id: string) => personas[id] || { name: id, emoji: "?", tone: "", callUser: "", role: "", bio: "" };
  const sharedMemories = memories.filter((m) => m.shared);

  return (
    <div className="fixed inset-0 bg-[#06060f] overflow-y-auto">
      <div className="w-full max-w-md mx-auto px-5 py-8 min-h-screen">

        {/* Header */}
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
              const p = persona(id);
              return (
                <button
                  key={id}
                  onClick={() => { setView(view === id ? null : id); setSection("persona"); setEditingPersona(false); }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg transition-all ${
                    view === id ? "bg-white/10 ring-1 ring-white/15" : "bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}>{p.emoji}</div>
                  <span className={`text-[10px] font-mono ${view === id ? "text-white/40" : "text-white/12"}`}>{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Brain view */}
        {view === "brain" && (
          <div>
            <p className="text-[10px] font-mono text-white/12 text-center mb-4">shared · {sharedMemories.length}</p>
            {sharedMemories.length === 0 ? (
              <p className="text-center text-xs font-mono text-white/8 py-6">empty</p>
            ) : sharedMemories.map((m) => (
              <div key={m.id} className="py-3 border-b border-white/[0.03]">
                <p className="text-[13px] font-mono text-white/35 leading-relaxed">{m.text}</p>
                <span className="text-[10px] font-mono text-white/8 mt-1 block">{persona(m.owner).emoji} {m.owner}</span>
              </div>
            ))}
          </div>
        )}

        {/* Bot view */}
        {view && view !== "brain" && (() => {
          const p = persona(view);
          const botMem = memories.filter((m) => m.owner === view);
          return (
            <div>
              {/* Section pills */}
              <div className="flex justify-center gap-1 mb-6">
                {(["persona", "memory", "skills"] as Section[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setSection(s); setEditingPersona(false); }}
                    className={`px-4 py-1.5 text-[10px] font-mono rounded-full ${
                      section === s ? "bg-white/8 text-white/50" : "text-white/12"
                    }`}
                  >{s}</button>
                ))}
              </div>

              {/* Persona */}
              {section === "persona" && (
                editingPersona && editPersona ? (
                  <div className="space-y-3">
                    {(["name", "emoji", "tone", "callUser", "role", "bio"] as (keyof Persona)[]).map((key) => (
                      <div key={key}>
                        <label className="text-[10px] font-mono text-white/15 block mb-1">{key}</label>
                        <input
                          value={editPersona[key]}
                          onChange={(e) => setEditPersona({ ...editPersona, [key]: e.target.value })}
                          className="w-full bg-transparent border-b border-white/8 px-1 py-1.5 text-sm font-mono text-white/50 focus:outline-none focus:border-white/20"
                        />
                      </div>
                    ))}
                    <div className="flex gap-3 pt-2">
                      <button onClick={savePersona} disabled={saving} className="text-[11px] font-mono text-green-400/40 hover:text-green-400/70">save</button>
                      <button onClick={() => setEditingPersona(false)} className="text-[11px] font-mono text-white/15">cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="space-y-2.5">
                      {(["name", "emoji", "tone", "callUser", "role", "bio"] as (keyof Persona)[]).map((key) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-[11px] font-mono text-white/15">{key}</span>
                          <span className="text-[13px] font-mono text-white/35">{p[key] || "—"}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => { setEditingPersona(true); setEditPersona({ ...p }); }}
                      className="mt-5 text-[11px] font-mono text-white/12 hover:text-white/30 block mx-auto"
                    >edit</button>
                  </div>
                )
              )}

              {/* Memory */}
              {section === "memory" && (
                <div>
                  <p className="text-[10px] font-mono text-white/10 text-center mb-3">{botMem.length} items</p>
                  {botMem.length === 0 ? (
                    <p className="text-center text-xs font-mono text-white/8 py-6">empty</p>
                  ) : botMem.map((m) => (
                    <div key={m.id} className="py-3 border-b border-white/[0.03] group">
                      <p className="text-[13px] font-mono text-white/35 leading-relaxed">{m.text}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] font-mono text-white/8">{m.ts}</span>
                        <div className="flex gap-4">
                          <button onClick={() => toggleShare(m.id)} disabled={saving}
                            className={`text-[10px] font-mono ${m.shared ? "text-green-400/40" : "text-white/10 hover:text-white/25"}`}>
                            {m.shared ? "shared" : "share"}
                          </button>
                          <button onClick={() => deleteMemory(m.id)} disabled={saving}
                            className="text-[10px] font-mono text-white/8 hover:text-red-400/40">
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Skills */}
              {section === "skills" && (
                <div>
                  {skills.map((s) => {
                    const on = s.bots[view] || false;
                    return (
                      <div key={s.id} className="flex items-center justify-between py-3 border-b border-white/[0.03]">
                        <div className="flex-1 min-w-0 mr-4">
                          <span className="text-[13px] font-mono text-white/35">{s.name}</span>
                          {s.by === view && <span className="text-[9px] font-mono text-white/10 ml-2">origin</span>}
                          <p className="text-[10px] font-mono text-white/10 mt-0.5">{s.desc}</p>
                        </div>
                        <button
                          onClick={() => toggleSkill(s.id, view)}
                          disabled={saving}
                          className={`w-8 h-4 rounded-full flex items-center transition-all flex-shrink-0 ${
                            on ? "bg-green-500/25 justify-end" : "bg-white/5 justify-start"
                          }`}
                        >
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
