"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface AuthCtx {
  authed: boolean;
  refresh: () => Promise<void>;
  unlock: () => void;
  lock: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  authed: false,
  refresh: async () => {},
  unlock: () => {},
  lock: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/labs/api/session", { cache: "no-store", credentials: "same-origin" });
      const data = await r.json();
      setAuthed(Boolean(data?.authed));
    } catch {
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const unlock = useCallback(() => {
    setAuthed(true);
  }, []);

  const lock = useCallback(async () => {
    await fetch("/labs/api/logout", { method: "POST" });
    setAuthed(false);
  }, []);

  return <AuthContext value={{ authed, refresh, unlock, lock }}>{children}</AuthContext>;
}

export function useAuth() {
  return useContext(AuthContext);
}
