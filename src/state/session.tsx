import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthUser, Bootstrap, ProfileName } from "../../shared/types";
import { api, getToken, setToken, setUnauthorizedHandler } from "../api/client";

interface SessionValue {
  status: "loading" | "signedOut" | "signedIn";
  user: AuthUser | null;
  bootstrap: Bootstrap | null;
  login: (phone: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  switchProfile: (profile: ProfileName) => Promise<void>;
  setUser: (user: AuthUser) => void;
  refreshBootstrap: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionValue["status"]>(getToken() ? "loading" : "signedOut");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);

  const signOutLocally = useCallback(() => {
    setToken(null);
    setUser(null);
    setBootstrap(null);
    setStatus("signedOut");
  }, []);

  const refreshBootstrap = useCallback(async () => {
    setBootstrap(await api<Bootstrap>("/bootstrap"));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOutLocally);
    if (!getToken()) return;
    (async () => {
      try {
        const [me, boot] = await Promise.all([api<{ user: AuthUser }>("/auth/me"), api<Bootstrap>("/bootstrap")]);
        setUser(me.user);
        setBootstrap(boot);
        setStatus("signedIn");
      } catch {
        signOutLocally();
      }
    })();
  }, [signOutLocally]);

  const login = async (phone: string, pin: string) => {
    const result = await api<{ token: string; user: AuthUser }>("/auth/login", { body: { phone, pin } });
    setToken(result.token);
    setUser(result.user);
    await refreshBootstrap();
    setStatus("signedIn");
  };

  const logout = async () => {
    try {
      await api("/auth/logout", { body: {} });
    } finally {
      signOutLocally();
    }
  };

  const switchProfile = async (profile: ProfileName) => {
    const result = await api<{ user: AuthUser }>("/auth/profile", { body: { profile } });
    setUser(result.user);
  };

  return (
    <SessionContext.Provider value={{ status, user, bootstrap, login, logout, switchProfile, setUser, refreshBootstrap }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}
