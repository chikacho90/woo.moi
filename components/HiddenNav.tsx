"use client";
import { useAuth } from "./AuthContext";

export default function HiddenNav() {
  const { authed, lock } = useAuth();

  if (!authed) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40" style={{ pointerEvents: "auto" }}>
      <button
        type="button"
        onClick={() => lock()}
        className="px-3 py-2 rounded-md border border-red-400/25 bg-red-950/20 text-[0.62rem] font-mono tracking-[0.2em] uppercase text-red-200/80 hover:text-red-100 hover:border-red-300/45 transition-colors"
      >
        logout
      </button>
    </div>
  );
}
