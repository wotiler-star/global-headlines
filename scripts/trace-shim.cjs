// 沙箱环境下 `next` 进程写入 `**/trace` 文件会被拦截（EPERM），导致 dev/build 崩溃。
// 本 preload 把命中 `trace` 基名的写入重定向到用户临时目录；若仍失败则丢弃到空流，
// 保证进程不崩溃（trace 仅用于性能分析，丢弃不影响产物）。
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SAFE = path.join(os.tmpdir(), "next-trace-redirect.log");
try {
  fs.mkdirSync(path.dirname(SAFE), { recursive: true });
} catch {}

const isTrace = (p) => {
  if (p == null) return false;
  const base = String(p).split(/[\\/]/).pop();
  return base === "trace";
};
const redirect = (p) => (isTrace(p) ? SAFE : p);

const origOpen = fs.open;
fs.open = function (p, ...a) {
  try {
    return origOpen.call(this, redirect(p), ...a);
  } catch (e) {
    if (isTrace(p)) return origOpen.call(this, SAFE, ...a);
    throw e;
  }
};
const origOpenSync = fs.openSync;
fs.openSync = function (p, ...a) {
  try {
    return origOpenSync.call(this, redirect(p), ...a);
  } catch (e) {
    if (isTrace(p)) return origOpenSync.call(this, SAFE, ...a);
    throw e;
  }
};
const origWrite = fs.writeFile;
fs.writeFile = function (p, ...a) {
  try {
    return origWrite.call(this, redirect(p), ...a);
  } catch (e) {
    if (isTrace(p)) return origWrite.call(this, SAFE, ...a);
    throw e;
  }
};
const origWriteSync = fs.writeFileSync;
fs.writeFileSync = function (p, ...a) {
  try {
    return origWriteSync.call(this, redirect(p), ...a);
  } catch (e) {
    if (isTrace(p)) return origWriteSync.call(this, SAFE, ...a);
    throw e;
  }
};
const origCWS = fs.createWriteStream;
fs.createWriteStream = function (p, ...a) {
  try {
    return origCWS.call(this, redirect(p), ...a);
  } catch (e) {
    // 任何失败（含沙箱拦截）都退化为丢弃流，避免未捕获错误导致进程退出。
    const { PassThrough } = require("node:stream");
    const s = new PassThrough();
    s.on("data", () => {});
    return s;
  }
};
if (fs.promises) {
  const origPromisesOpen = fs.promises.open;
  fs.promises.open = function (p, ...a) {
    try {
      return origPromisesOpen.call(this, redirect(p), ...a);
    } catch (e) {
      if (isTrace(p)) return origPromisesOpen.call(this, SAFE, ...a);
      throw e;
    }
  };
}
