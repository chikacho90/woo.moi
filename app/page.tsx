"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const BG_LOCKED = "#06060f";
const BG_UNLOCKED = "#0f0618";

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check session on mount
  useEffect(() => {
    fetch("/api/session", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setAuthed(Boolean(d?.authed)))
      .catch(() => {});
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setValue("");
    setShake(false);
  }, []);

  const submit = useCallback(async () => {
    if (!value.trim()) return;

    if (authed) {
      // Logout: type password again to lock
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: value }),
        credentials: "same-origin",
      });
      if (r.ok) {
        await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
        setAuthed(false);
        close();
      } else {
        setShake(true);
        setValue("");
        setTimeout(() => setShake(false), 500);
      }
    } else {
      // Login
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: value }),
        credentials: "same-origin",
      });
      if (r.ok) {
        setAuthed(true);
        close();
      } else {
        setShake(true);
        setValue("");
        setTimeout(() => setShake(false), 500);
      }
    }
  }, [value, authed, close]);

  // Desktop: Enter to open
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (open) return;
      const tag = (e.target as HTMLElement)?.tagName?.toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  // Auto-focus input
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Mobile: long press to open
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    function onStart() {
      if (open) return;
      timer = setTimeout(() => setOpen(true), 500);
    }
    function onEnd() {
      if (timer) { clearTimeout(timer); timer = null; }
    }
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchmove", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchmove", onEnd);
    };
  }, [open]);

  return (
    <main
      className="fixed inset-0 overflow-hidden transition-colors duration-700"
      style={{ backgroundColor: authed ? BG_UNLOCKED : BG_LOCKED }}
    >
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.15)", backdropFilter: "blur(4px)" }}
          onClick={close}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") close();
              }}
              placeholder=""
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className={`bg-transparent border-b border-white/15 px-2 py-2 text-base text-white/70 font-mono focus:outline-none focus:border-white/30 w-56 transition-transform ${
                shake ? "animate-shake" : ""
              }`}
              style={{ caretColor: "rgba(255,255,255,0.4)" }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
