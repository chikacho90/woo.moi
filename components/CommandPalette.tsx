"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";

interface Command {
  name: string;
  description: string;
  action: () => void | Promise<void>;
  auth?: boolean;
  guest?: boolean;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { authed, lock, unlock } = useAuth();

  // Password sub-mode
  const [pwMode, setPwMode] = useState(false);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState(false);

  // Info overlay mode
  const [infoMode, setInfoMode] = useState<"help" | "about" | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setInput("");
    setError("");
    setSelectedIdx(0);
    setPwMode(false);
    setPw("");
    setPwErr(false);
    setInfoMode(null);
  }, []);

  const commands: Command[] = [
    { name: "login", description: "sign in", guest: true, action: () => setPwMode(true) },
    { name: "logout", description: "sign out", auth: true, action: async () => { await lock(); close(); } },
    { name: "help", description: "commands", action: () => { setInfoMode("help"); setInput(""); } },
    { name: "about", description: "info", action: () => { setInfoMode("about"); setInput(""); } },
  ];

  const isCommandMode = input.startsWith("/");
  const cmdQuery = isCommandMode ? input.slice(1).toLowerCase() : "";

  const filtered = isCommandMode
    ? commands.filter((c) => {
        if (c.auth && !authed) return false;
        if (c.guest && authed) return false;
        if (!cmdQuery) return true;
        return c.name.startsWith(cmdQuery);
      })
    : [];

  useEffect(() => { setSelectedIdx(0); }, [input]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (open) return;
      const tag = (e.target as HTMLElement)?.tagName?.toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); setOpen(true); }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open, pwMode]);

  async function submitPw(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/labs/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
      credentials: "same-origin",
    });
    if (r.ok) { unlock(); close(); }
    else { setPwErr(true); setPw(""); }
  }

  function execCommand(cmd: Command) { cmd.action(); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isCommandMode) { close(); return; }
    if (filtered.length > 0 && selectedIdx < filtered.length) { execCommand(filtered[selectedIdx]); return; }
    setError(`unknown: /${cmdQuery || "?"}`);
    setTimeout(() => setError(""), 1500);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { close(); return; }
    if (isCommandMode && filtered.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => (i + 1) % filtered.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === "Tab") { e.preventDefault(); setInput("/" + filtered[selectedIdx].name); return; }
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(6,6,15,0.25)", backdropFilter: "blur(6px)" }}
      onClick={close}
    >
      <div className="w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        {infoMode === "help" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontFamily: '"Courier New", monospace', fontSize: "0.6rem", letterSpacing: "0.3em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>commands</span>
              <button onClick={close} className="text-[10px] font-mono text-[#4a4a6a] hover:text-white/70">esc</button>
            </div>
            <div className="border border-[#1a1a2e] rounded-xl bg-[#0a0a16] overflow-hidden">
              {commands.filter(c => !(c.auth && !authed) && !(c.guest && authed)).map((c) => (
                <button key={c.name} type="button" onClick={() => { setInfoMode(null); setInput("/" + c.name); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#111122] transition-colors">
                  <span className="text-xs font-mono text-[#e2e8f0]">/{c.name}</span>
                  <span className="text-[10px] font-mono text-[#4a4a6a]">{c.description}</span>
                </button>
              ))}
            </div>
          </div>
        ) : infoMode === "about" ? (
          <div className="flex flex-col items-center gap-5 py-4">
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl">∞</span>
              <h2 style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 300, fontSize: "1.1rem", letterSpacing: "0.15em", color: "rgba(255,255,255,0.85)" }}>woo kyung-min</h2>
              <span style={{ fontFamily: '"Courier New", monospace', fontSize: "0.6rem", letterSpacing: "0.35em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>creative developer · seoul</span>
            </div>
            <div className="flex gap-4">
              <a href="https://github.com/lookgitme" target="_blank" rel="noopener" className="text-[10px] font-mono text-[#4a4a6a] hover:text-white/70 transition-colors">github</a>
            </div>
            <button onClick={close} className="text-[10px] font-mono text-[#333] hover:text-white/40 transition-colors mt-2">esc to close</button>
          </div>
        ) : pwMode ? (
          <form onSubmit={submitPw} className="flex flex-col items-center gap-4">
            <span style={{ fontFamily: '"Courier New", monospace', fontSize: "0.6rem", letterSpacing: "0.3em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>password</span>
            <input ref={inputRef} type="password" value={pw} onChange={(e) => { setPw(e.target.value); setPwErr(false); }}
              onKeyDown={(e) => e.key === "Escape" && close()} placeholder="···" autoFocus
              className="bg-transparent border border-[#1a1a2e] rounded-lg px-4 py-2.5 text-base text-[#e2e8f0] text-center font-mono placeholder-[#333] focus:outline-none focus:border-[#4a4a6a] w-48" />
            {pwErr && <span className="text-xs text-red-400/60 font-mono">nope</span>}
          </form>
        ) : (
          <div>
            <form onSubmit={handleSubmit}>
              <div className="flex items-center border border-[#1a1a2e] rounded-xl bg-[#0a0a16] overflow-hidden">
                <input ref={inputRef} type="text" value={input} onChange={(e) => { setInput(e.target.value); setError(""); }}
                  onKeyDown={handleKeyDown} placeholder="type / for commands" autoFocus autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} lang="en"
                  inputMode={"text" as React.HTMLAttributes<HTMLInputElement>["inputMode"]}
                  className="flex-1 bg-transparent px-4 py-3 text-base text-[#e2e8f0] font-mono placeholder-[#333] focus:outline-none" />
              </div>
            </form>
            {error && <p className="text-xs text-red-400/60 font-mono text-center mt-3">{error}</p>}
            {isCommandMode && filtered.length > 0 && !error && (
              <div className="mt-2 border border-[#1a1a2e] rounded-xl bg-[#0a0a16] overflow-hidden">
                {filtered.map((c, i) => (
                  <button key={c.name} type="button" onClick={() => execCommand(c)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${i === selectedIdx ? "bg-[#1a1a2e]" : "hover:bg-[#111122]"}`}>
                    <span className="text-xs font-mono text-[#e2e8f0]">/{c.name}</span>
                    <span className="text-[10px] font-mono text-[#4a4a6a]">{c.description}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] font-mono text-[#333] text-center mt-3">enter or esc to close · tab to autocomplete</p>
          </div>
        )}
      </div>
    </div>
  );
}
