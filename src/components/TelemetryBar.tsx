"use client";
import { useEffect, useState } from "react";

// 遥测顶栏：LIVE 脉冲 + 日期 + CST 时钟 + 信号格（信号台签名，P1）
export default function TelemetryBar({ signal = 4 }: { signal?: number }) {
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  const [dateStr, setDateStr] = useState("");
  // 日期改为挂载后计算：页面 force-static，SSR 日期冻结在构建期，
  // 渲染期直接 new Date() 会在跨天后每次访问都 hydration mismatch(#418)。
  useEffect(() => {
    const fmt = () =>
      setDateStr(
        new Date().toLocaleDateString("zh-CN", {
          timeZone: "Asia/Shanghai",
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
        })
      );
    fmt();
    const t = setInterval(fmt, 60_000); // 跨零点自动更新
    return () => clearInterval(t);
  }, []);
  const bars = [4, 7, 10, 12, 12];
  return (
    <div className="telemetry-bar" role="status">
      <div className="tb-left">
        <span className="live-dot" aria-hidden="true" />
        <span style={{ color: "var(--live)" }}>LIVE</span>
        <span>{dateStr}</span>
        <span>{clock} CST</span>
      </div>
      <div className="tb-right">
        <span className="signal-bars" aria-hidden="true">
          {bars.map((h, i) => (
            <i key={i} className={i >= signal ? "off" : ""} style={{ height: h }} />
          ))}
        </span>
        <span>SIGNAL {Math.min(Math.max(signal, 0), 5)}/5</span>
      </div>
    </div>
  );
}
