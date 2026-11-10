"use client";

// 一键复制规范引用格式。纯客户端交互，不影响 SSR 内容（外链/爬虫仍能看到全文）。
import { useState } from "react";

export default function CiteCopyButton({ text, label, copied }: {
  text: string;
  label: string;
  copied: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="cite-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        } catch {
          // 剪贴板不可用（http / 权限）时降级：选中文本由用户手动复制
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        }
      }}
      aria-label={label}
    >
      {done ? copied : label}
    </button>
  );
}
