// 标题直显：SSR 渲染终题（SEO/无 JS 无损），挂载后以本语种原文快速淡入。
// 不再逐字乱码滚动——原字符池以中文为主，非中文语种会先闪「中文乱码」再变成本语种。
// prefers-reduced-motion 时无动画直接显示。
export default function DecodeTitle({ text, className }: { text: string; className?: string }) {
  return (
    <h1 className={`${className ?? ""} title-fade-in`}>{text}</h1>
  );
}
