"use client";

/**
 * 独立登录/注册页表单。
 *
 * 站点原本只有弹窗登录，无法被搜索引擎收录、也无法把链接发给别人。
 * 这里提供真正的 /{locale}/login 与 /{locale}/register 页面，支持 ?next= 深链回跳
 * （来自 write/me/admin 等守卫页），并复用同一套后端接口与校验规则。
 */
import { useEffect, useRef, useState } from "react";
import { Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dictionaries";

const USER_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function AuthForm({ locale, mode, next }: { locale: Locale; mode: "login" | "register"; next: string }) {
  const d = getDict(locale);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // 用户名可用性状态：checking / available / taken / invalid
  const [nameState, setNameState] = useState<"" | "checking" | "available" | "taken" | "invalid">("");
  const checkTimer = useRef<number | null>(null);

  useEffect(() => {
    if (mode !== "register") return;
    const u = username.trim();
    if (!u) {
      setNameState("");
      return;
    }
    if (!USER_RE.test(u)) {
      setNameState("invalid");
      return;
    }
    setNameState("checking");
    if (checkTimer.current) window.clearTimeout(checkTimer.current);
    checkTimer.current = window.setTimeout(async () => {
      try {
        const r = await fetch(`/api/auth/check-username?u=${encodeURIComponent(u)}`);
        const j = await r.json().catch(() => ({}));
        setNameState(j && j.available ? "available" : "taken");
      } catch {
        setNameState("");
      }
    }, 400);
    return () => {
      if (checkTimer.current) window.clearTimeout(checkTimer.current);
    };
  }, [username, mode]);

  const strength = (() => {
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Za-z]/.test(password) && /\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return Math.min(3, s);
  })();

  const go = (href: string) => window.location.assign(href);

  const submit = async () => {
    setErr(null);
    setNote(null);
    const u = username.trim();
    if (!u) return setErr(d.authUsername + " –");
    if (mode === "register") {
      if (!USER_RE.test(u)) return setErr(d.authUserFormat);
      if (nameState === "taken") return setErr(d.authUserTaken);
      if (password.length < 6) return setErr(d.authPwWeak);
      if (password !== confirm) return setErr(d.authPwMismatch);
    }
    if (!password) return setErr(d.authPassword + " –");
    setBusy(true);
    try {
      const r = await fetch(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register"
            ? { username: u, email: email.trim() || null, password }
            : { username: u, password, remember }
        ),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.error || "failed");
        setBusy(false);
        return;
      }
      if (mode === "register") {
        setNote(d.authWelcomeDone);
      }
      // 硬跳转：让服务端重新渲染目标页（会员路由的服务端守卫依赖新的 session cookie）
      go(next || `/${locale}`);
    } catch {
      setErr("network error");
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <h1>{mode === "register" ? d.authJoinTitle : d.authLoginTitle}</h1>
      <p className="member-muted">{mode === "register" ? d.authJoinSub : d.authLoginSub}</p>
      {next && mode === "login" && <p className="auth-next">{d.authNextHint}</p>}

      <label className="member-field">
        <span>{d.authUsername}</span>
        <input
          value={username}
          autoComplete="username"
          maxLength={20}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="3-20 位字母/数字/下划线"
        />
        {mode === "register" && nameState && (
          <span className={"uname-hint " + nameState}>
            {nameState === "checking"
              ? d.authUserChecking
              : nameState === "available"
              ? d.authUserAvailable
              : nameState === "taken"
              ? d.authUserTaken
              : d.authUserFormat}
          </span>
        )}
      </label>

      {mode === "register" && (
        <label className="member-field">
          <span>{d.authEmail}</span>
          <input value={email} type="email" autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        </label>
      )}

      <label className="member-field">
        <span>{d.authPassword}</span>
        <div className="pw-row">
          <input
            value={password}
            type={showPw ? "text" : "password"}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" className="md-btn" onClick={() => setShowPw((v) => !v)}>
            {showPw ? d.authPwHide : d.authPwShow}
          </button>
        </div>
        {mode === "register" && password && (
          <div className="pw-meter">
            <i className={"s" + strength} />
            <span>{[d.authPwWeak, d.authPwMedium, d.authPwMedium, d.authPwStrong][strength]}</span>
          </div>
        )}
      </label>

      {mode === "register" && (
        <label className="member-field">
          <span>{d.authPwConfirm}</span>
          <input
            value={confirm}
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
      )}

      {mode === "login" && (
        <label className="auth-check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>{d.authRemember}</span>
        </label>
      )}

      {err && <div className="modal-error">{err}</div>}
      {note && <div className="auth-note">{note}</div>}

      <div className="write-actions">
        <button className="btn btn-primary" disabled={busy} onClick={submit}>
          {mode === "register" ? d.authRegisterSubmit : d.authLoginSubmit}
        </button>
        <a className="btn btn-ghost" href={mode === "register" ? `/${locale}/login?next=${encodeURIComponent(next)}` : `/${locale}/register?next=${encodeURIComponent(next)}`}>
          {mode === "register" ? d.authToLogin : d.authToRegister}
        </a>
      </div>

      {mode === "register" && <p className="auth-tip">{d.authAgree}</p>}

      <div className="write-actions">
        <a className="member-muted" href={`/${locale}`}>
          {d.authBackHome}
        </a>
      </div>
    </div>
  );
}
