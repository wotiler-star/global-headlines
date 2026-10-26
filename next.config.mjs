/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 全栈模式：保留 Node 运行时以支持 API 路由 + node:sqlite 后端。
  // （部署到香港 VPS 用 `next start` 运行，不再静态导出。）
  images: { unoptimized: true },
  // node:sqlite 是 Node 内置模块，标记为外部包避免被打包。
  // segmentit 词典 16MB，保持外部依赖由 node_modules 运行时加载（避免打包膨胀/构建不稳）。
  serverExternalPackages: ["node:sqlite", "segmentit"],
  // 沙箱环境下多 worker 并行编译会死锁，强制单 worker 构建。
  experimental: {
    cpus: 1,
    // cov32：首屏 JS 进一步瘦身。项目依赖极简（无大型 barrel 库如 lucide-react/date-fns/
    // lodash），此配置主要对未来引入的图标/工具库预留自动按需裁剪；当前首屏体积大头已
    // 通过 globe.gl/three 动态加载 + SignalDeck/HomeFeedRouter 代码分割解决。
    optimizePackageImports: ["globe.gl", "three"],
  },
};

export default nextConfig;
