// Global Headlines — minimal service worker.
//
// cov16 关键修复：SW 绝不拦截「导航 HTML」与「/_next/ 静态分块」。
// 实测表明，只要 SW 介入这两类请求（即便缓存优先），部署后旧分块 / 旧文档被回灌，
// 就会触发 React #418（Hydration failed, args=[HTML,""]）。
// Next.js 的 /_next 资源是内容哈希 + Cache-Control: immutable，浏览器原生 HTTP 缓存已足够，
// 无需 SW 介入。SW 仅缓存版本稳定的小资源（icon / manifest）并负责离线图标。
const CACHE = "gh-cache-v3";
const CORE = ["/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      // 删掉所有旧版本缓存（含 cov15/cov16 早期 gh-cache-v2 中可能残留的导航 HTML 缓存）
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
    // 刻意不调用 clients.claim()：避免 SW 在页面 hydration 进行中突然接管当前页面
    // （controllerchange 会干扰 Next.js App Router 的水合，诱发偶发 React #418，args=[HTML,""]）。
    // skipWaiting() 仍保留：新 SW 会在「下一次导航/重载」时生效，对已经水合完成的页面无害。
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // RSC / 预取请求（Next App Router 客户端导航载荷）：直接走网络，绝不进缓存。
  if (
    url.searchParams.has("_rsc") ||
    req.headers.has("next-router-prefetch") ||
    req.headers.has("rsc")
  ) {
    return;
  }

  // 导航 HTML 与 /_next/ 分块：直接走浏览器原生网络 / HTTP 缓存，SW 完全不介入。
  // 这是消除 #418 的核心：任何 SW 介入都会带来 stale-chunk / stale-HTML 回灌风险。
  if (req.mode === "navigate" || url.pathname.startsWith("/_next/")) {
    return;
  }

  // 其余同源静态资源（icon / manifest 等版本稳定项）：缓存优先，缺失则网络并写入。
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
