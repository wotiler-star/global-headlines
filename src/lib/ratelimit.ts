/**
 * 极简进程内限流：滑动窗口计数器。
 *
 * 站点是单容器部署（node:sqlite + next start），没有多实例共享状态的需求，
 * 因此不必引入 Redis；内存计数器足够挡住暴力破解与灌水，且进程重启自动失效（不误伤用户）。
 */
type Bucket = { hits: number[] };

const WINDOW_MS = 15 * 60 * 1000;
const store = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of store) {
    b.hits = b.hits.filter((t) => now - t < WINDOW_MS);
    if (!b.hits.length) store.delete(k);
  }
}

export type RateResult = { ok: boolean; retryAfterSec: number };

/**
 * @param key   业务维度唯一键（如 "login:1.2.3.4:alice"）
 * @param limit 窗口内允许的次数
 * @param windowMs 时间窗口，默认 15 分钟
 */
export function hit(key: string, limit: number, windowMs: number = WINDOW_MS): RateResult {
  const now = Date.now();
  sweep(now);
  const b = store.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= limit) {
    const oldest = b.hits[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    store.set(key, b);
    return { ok: false, retryAfterSec };
  }
  b.hits.push(now);
  store.set(key, b);
  return { ok: true, retryAfterSec: 0 };
}

/** 成功调用后清空该键（例如登录成功后重置失败计数） */
export function reset(key: string) {
  store.delete(key);
}

/** 取客户端 IP（容器内 nginx 反代，优先 x-forwarded-for 首段） */
export function clientIp(req: Request): string {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for") || h.get("x-real-ip") || "";
  const ip = fwd.split(",")[0].trim();
  return ip || "unknown";
}
