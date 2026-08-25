/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 全栈模式：保留 Node 运行时以支持 API 路由 + node:sqlite 后端。
  // （部署到香港 VPS 用 `next start` 运行，不再静态导出。）
  images: { unoptimized: true },
  // node:sqlite 是 Node 内置模块，标记为外部包避免被打包。
  serverExternalPackages: ["node:sqlite"],
};

export default nextConfig;
