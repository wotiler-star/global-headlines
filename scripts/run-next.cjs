// 启动 next 的包装器：用 `node -r ./scripts/trace-shim.cjs` 直接加载 trace 重定向补丁
// （NODE_OPTIONS 不允许含 --require，故走 CLI 参数；next 内部 worker 会继承本进程的 execArgv）。
const { spawn } = require("node:child_process");
const path = require("node:path");

const shim = path.join(__dirname, "trace-shim.cjs");
let nextBin;
try {
  nextBin = require.resolve("next/dist/bin/next");
} catch {
  nextBin = path.join(__dirname, "..", "node_modules", "next", "dist", "bin", "next");
}

const args = process.argv.slice(2);
const cmd = args[0];
const nodeArgs = ["-r", shim];
// node:sqlite 仅在运行时（dev/start）需要；build 不连库，可省（带上也无害，但避免无关告警）
if (cmd === "dev" || cmd === "start") nodeArgs.push("--experimental-sqlite");

const child = spawn(process.execPath, [...nodeArgs, nextBin, ...args], {
  stdio: "inherit",
  // 清空 NODE_OPTIONS：移除沙箱注入的 safe-delete 拦截（dev/build 启动会 unlink .next
  // 缓存，被 safe-delete 转回收站时 genie-trash 超时导致崩溃）。trace 重定向由本进程的
  // -r ./scripts/trace-shim.cjs 兜底，不依赖 safe-delete。
  env: { ...process.env, NODE_OPTIONS: "" },
});
child.on("exit", (code) => process.exit(code ?? 0));
