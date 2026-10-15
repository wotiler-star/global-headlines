// 数据波形分隔线：条数 = 段落数（封顶 40），条高确定性派生，每第 5 根琥珀高亮。
// 纯服务端组件，无 JS 依赖；reduced-motion 下本就是静态，无需处理。
export default function WaveformDivider({
  paragraphs,
  minutes,
}: {
  paragraphs: number;
  minutes: number;
}) {
  const n = Math.min(Math.max(paragraphs, 8), 40);
  const bars = Array.from({ length: n }, (_, i) => {
    const h = 4 + Math.round(20 * Math.abs(Math.sin(i * 0.9)) * (i % 5 === 0 ? 1 : 0.72));
    return { h, hi: i % 5 === 0 };
  });
  return (
    <div className="waveform-block">
      <div className="waveform" aria-hidden="true">
        {bars.map((b, i) => (
          <i key={i} className={b.hi ? "hi" : ""} style={{ height: b.h }} />
        ))}
      </div>
      <div className="wf-caption">WAVEFORM · {paragraphs} 段 · {minutes} MIN</div>
    </div>
  );
}
