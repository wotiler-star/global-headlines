"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";

export type AuthUser = {
  id: number;
  username: string;
  email: string | null;
  role?: string;
};

type AuthState = {
  user: AuthUser | null;
  ready: boolean;
  loginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
  login: (username: string, password: string) => Promise<string | null>;
  register: (username: string, password: string, email: string | null) => Promise<string | null>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function AuthProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setUser(d.user ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const openLogin = useCallback(() => setLoginOpen(true), []);
  const closeLogin = useCallback(() => setLoginOpen(false), []);

  const login = useCallback(async (username: string, password: string) => {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const d = await r.json();
    if (!r.ok) return d.error || "登录失败";
    setUser(d.user);
    setLoginOpen(false);
    return null;
  }, []);

  const register = useCallback(
    async (username: string, password: string, email: string | null) => {
      const r = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email }),
      });
      const d = await r.json();
      if (!r.ok) return d.error || "注册失败";
      setUser(d.user);
      setLoginOpen(false);
      return null;
    },
    []
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, ready, loginOpen, openLogin, closeLogin, login, register, logout }}>
      {children}
      {loginOpen && <LoginModal locale={locale} />}
    </AuthCtx.Provider>
  );
}

function LoginModal({ locale }: { locale: Locale }) {
  const { closeLogin, login, register } = useAuth();
  const d = getDict(locale);
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const err =
      tab === "login"
        ? await login(username.trim(), password)
        : await register(username.trim(), password, email.trim() || null);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="modal-overlay" onClick={closeLogin}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={closeLogin}>
          ×
        </button>
        <div className="modal-tabs">
          <button
            className={tab === "login" ? "active" : ""}
            onClick={() => {
              setTab("login");
              setError(null);
            }}
          >
            {d.authLogin}
          </button>
          <button
            className={tab === "register" ? "active" : ""}
            onClick={() => {
              setTab("register");
              setError(null);
            }}
          >
            {d.authRegister}
          </button>
        </div>
        <form className="modal-form" onSubmit={submit}>
          <input
            type="text"
            placeholder={d.authUsername}
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          {tab === "register" && (
            <input
              type="email"
              placeholder={d.authEmailOptional}
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          <input
            type="password"
            placeholder={d.authPassword}
            value={password}
            autoComplete={tab === "login" ? "current-password" : "new-password"}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="modal-error">{error}</div>}
          <button className="modal-submit" type="submit" disabled={busy}>
            {tab === "login" ? d.authLoginSubmit : d.authRegisterSubmit}
          </button>
        </form>
        <div className="modal-switch">
          {tab === "login" ? (
            <span onClick={() => { setTab("register"); setError(null); }}>{d.authToRegister}</span>
          ) : (
            <span onClick={() => { setTab("login"); setError(null); }}>{d.authToLogin}</span>
          )}
        </div>
      </div>
    </div>
  );
}
