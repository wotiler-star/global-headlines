// 根据平台 + 视频ID 生成可嵌入播放器地址（YouTube / Bilibili）。
// 接真实 API 时只需保证 Article.videoPlatform / videoId 来自接口即可，渲染层不变。
export function videoEmbedSrc(
  platform: "youtube" | "bilibili" | undefined,
  id: string | undefined
): string {
  if (!id) return "";
  if (platform === "bilibili") {
    return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(
      id
    )}&page=1&high_quality=1&danmaku=0`;
  }
  // 默认 YouTube
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
}
