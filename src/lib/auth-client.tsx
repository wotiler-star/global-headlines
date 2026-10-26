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
  avatar?: string | null;
};

type AuthState = {
  user: AuthUser | null;
  ready: boolean;
  loginOpen: boolean;
  openLogin: (next?: string) => void;
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
  // 登录成功后的回跳目标（站内相对路径）
  const [loginNext, setLoginNext] = useState<string | null>(null);

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

  // 深链支持：URL 带 ?next=/路径 时自动弹出登录，成功后回跳该路径
  useEffect(() => {
    let next: string | null = null;
    try {
      next = new URLSearchParams(window.location.search).get("next");
    } catch {
      next = null;
    }
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      setLoginNext(next);
      setLoginOpen(true);
    }
  }, []);

  const openLogin = useCallback((next?: string) => {
    setLoginNext(next && next.startsWith("/") && !next.startsWith("//") ? next : null);
    setLoginOpen(true);
  }, []);

  const closeLogin = useCallback(() => {
    setLoginOpen(false);
    setLoginNext(null);
  }, []);

  // 登录/注册成功：关闭弹窗并按需回跳
  const afterAuth = useCallback(() => {
    const next = loginNext;
    setLoginOpen(false);
    setLoginNext(null);
    // 硬导航：确保带新会话 cookie 完整重渲染目标页（避免客户端路由缓存旧态）
    if (next) window.location.assign(next);
  }, [loginNext]);

  const login = useCallback(
    async (username: string, password: string) => {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (!r.ok) return d.error || "登录失败";
      setUser(d.user);
      afterAuth();
      return null;
    },
    [afterAuth]
  );

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
      afterAuth();
      return null;
    },
    [afterAuth]
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [unameStatus, setUnameStatus] = useState<"idle" | "checking" | "ok" | "taken" | "bad">("idle");

  const switchTab = (t: "login" | "register") => {
    setTab(t);
    setError(null);
    setShowPw(false);
    setUnameStatus("idle");
    setConfirmPassword("");
  };

  // 用户名实时查重（debounce 400ms，仅注册 tab）
  useEffect(() => {
    if (tab !== "register") return;
    const u = username.trim();
    if (!u) {
      setUnameStatus("idle");
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(u)) {
      setUnameStatus("bad");
      return;
    }
    setUnameStatus("checking");
    const t = window.setTimeout(() => {
      fetch("/api/auth/check-username?username=" + encodeURIComponent(u))
        .then((r) => r.json())
        .then((j) => setUnameStatus(j.available ? "ok" : "taken"))
        .catch(() => setUnameStatus("idle"));
    }, 400);
    return () => window.clearTimeout(t);
  }, [username, tab]);

  // 密码强度 0-3
  const pwScore = (pw: string) => {
    let s = 0;
    if (pw.length >= 6) s++;
    if (pw.length >= 10) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  };
  const strength = password ? Math.max(1, Math.min(3, Math.ceil(pwScore(password) / 2))) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    if (tab === "register" && password !== confirmPassword) {
      setBusy(false);
      setError(d.authPwMismatch);
      return;
    }
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
          <button className={tab === "login" ? "active" : ""} onClick={() => switchTab("login")}>
            {d.authLogin}
          </button>
          <button className={tab === "register" ? "active" : ""} onClick={() => switchTab("register")}>
            {d.authRegister}
          </button>
        </div>
        <form className="modal-form" onSubmit={submit}>
          <input
            type="text"
            placeholder={d.authUsername}
            value={username}
            autoComplete="username"
            autoFocus
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          {tab === "register" && unameStatus !== "idle" && (
            <div className={"modal-hint" + (unameStatus === "ok" ? " ok" : unameStatus === "checking" ? "" : " bad")}>
              {unameStatus === "checking" ? d.authUserChecking : null}
              {unameStatus === "ok" ? "✓ " + d.authUserAvailable : null}
              {unameStatus === "taken" ? "✕ " + d.authUserTaken : null}
              {unameStatus === "bad" ? "✕ " + d.authUserFormat : null}
            </div>
          )}
          {tab === "register" && (
            <input
              type="email"
              placeholder={d.authEmailOptional}
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          <div className="modal-pw">
            <input
              type={showPw ? "text" : "password"}
              placeholder={d.authPassword}
              value={password}
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="modal-pw-toggle"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? d.authPwHide : d.authPwShow}
              title={showPw ? d.authPwHide : d.authPwShow}
              tabIndex={-1}
            >
              {showPw ? "🙈" : "👁"}
            </button>
          </div>
          {tab === "register" && strength > 0 && (
            <div className="modal-pwbar">
              <div className="modal-pwbar-seg">
                <i className={strength >= 1 ? "on" + strength : ""} />
                <i className={strength >= 2 ? "on" + strength : ""} />
                <i className={strength >= 3 ? "on" + strength : ""} />
              </div>
              <span className="modal-pwbar-label">
                {strength === 1 ? d.authPwWeak : strength === 2 ? d.authPwMedium : d.authPwStrong}
              </span>
            </div>
          )}
          {tab === "register" && (
            <div className="modal-pw">
              <input
                type={showPw ? "text" : "password"}
                placeholder={d.authPwConfirm}
                value={confirmPassword}
                autoComplete="new-password"
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}
          {error && <div className="modal-error">{error}</div>}
          <button className="modal-submit" type="submit" disabled={busy}>
            {busy ? "…" : tab === "login" ? d.authLoginSubmit : d.authRegisterSubmit}
          </button>
        </form>
        <div className="modal-switch">
          {tab === "login" ? (
            <span onClick={() => switchTab("register")}>{d.authToRegister}</span>
          ) : (
            <span onClick={() => switchTab("login")}>{d.authToLogin}</span>
          )}
        </div>
      </div>
    </div>
  );
}
