"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, type User } from "@/lib/api";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function userFromJwt(token: string): User | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = JSON.parse(
      atob(part.replace(/-/g, "+").replace(/_/g, "/"))
    ) as {
      id?: string;
      name?: string;
      email?: string;
      role?: string;
      exp?: number;
    };
    if (json.exp && json.exp * 1000 < Date.now()) return null;
    if (!json.id) return null;
    return {
      id: json.id,
      name: json.name || "",
      email: json.email || "",
      role: json.role || "admin",
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("winfab_token");
    if (!saved) {
      setLoading(false);
      return;
    }

    setToken(saved);
    // Unblock UI immediately from JWT — don't wait on /me → Atlas RTT
    const fromToken = userFromJwt(saved);
    if (fromToken) {
      setUser(fromToken);
      setLoading(false);
    }

    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => {
        localStorage.removeItem("winfab_token");
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    localStorage.setItem("winfab_token", res.token);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("winfab_token");
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, logout }),
    [user, token, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
