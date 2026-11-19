// 为克隆语种（当前 bn/ur）克隆英文策展稿作为「英文内容回退」种子。
// 真实翻译待可靠翻译通道就绪后替换这些文件即可。
import fs from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "data", "original");
const TARGETS = ["bn", "ur"];

const enFiles = fs.readdirSync(DIR).filter((f) => /^premium-en-2026-11.*\.json$/.test(f));
console.log("en source files:", enFiles);

const seen = new Set();
const articles = [];
for (const f of enFiles) {
  const arr = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  for (const a of arr) {
    if (!a || !a.id) continue;
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    articles.push(a);
  }
}
console.log("unique en articles:", articles.length);

function cloneFor(loc, a) {
  const baseId = a.id.replace(/-en$/, "");
  const newId = baseId !== a.id ? `${baseId}-${loc}` : `${a.id}-${loc}`;
  return { ...a, id: newId, locale: loc };
}

for (const loc of TARGETS) {
  const out = articles.map((a) => cloneFor(loc, a));
  const file = path.join(DIR, `premium-${loc}-2026-11.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`wrote ${file} (${out.length} articles)`);
}
