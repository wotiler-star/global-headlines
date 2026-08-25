import { Locale, locales, Category, categories } from "@/i18n/config";

export type Article = {
  id: string; // locale-neutral: `${category}-${conceptId}`
  locale: Locale;
  category: Category;
  title: string;
  summary: string;
  body: string[];
  source: string;
  author: string;
  publishedAt: number; // epoch ms
  imageCount: 1 | 3;
  images: string[];
  tags: string[];
  readMinutes: number;
  media?: "video";
  videoUrl?: string;
  videoPlatform?: "youtube" | "bilibili";
  videoId?: string;
  sourceUrl?: string; // 原文链接（RSS / API 采集时填充）
};

type Concept = { id: string; category: Category; t: Record<Locale, string> };

const titleTpl: Record<Locale, string[]> = {
  zh: [
    "{topic}迎来重大突破",
    "{topic}成为行业新焦点",
    "{topic}最新进展引发广泛关注",
    "{topic}将如何改变我们的未来",
  ],
  en: [
    "{topic} sees a major breakthrough",
    "{topic} becomes the new industry focus",
    "Latest developments in {topic} draw wide attention",
    "How {topic} will reshape our future",
  ],
  ja: [
    "{topic}で大きな進展",
    "{topic}が新たな焦点に",
    "{topic}の最新動向に注目が集まる",
    "{topic}が私たちの未来をどう変えるか",
  ],
  ko: [
    "{topic} 큰 진전 이뤄",
    "{topic} 새로운 관심사로 부상",
    "{topic} 최신 동향에 관심 쏠려",
    "{topic}이 우리 미래를 바꾸는 법",
  ],
  es: [
    "{topic} logra un avance importante",
    "{topic} se convierte en nuevo foco",
    "Los últimos avances en {topic} llaman la atención",
    "Cómo {topic} cambiará nuestro futuro",
  ],
  fr: [
    "{topic} réalise une percée majeure",
    "{topic} devient le nouveau centre d'intérêt",
    "Les derniers développements de {topic} attirent l'attention",
    "Comment {topic} changera notre avenir",
  ],
};

const summaryTpl: Record<Locale, string[]> = {
  zh: [
    "据{topic}相关报道，{source}透露，近期该领域出现多项关键进展，引发业界高度关注。",
    "{source}发布最新分析称，{topic}正加速渗透各行各业，未来影响值得持续追踪。",
  ],
  en: [
    "According to coverage on {topic}, {source} reports several key developments drawing strong industry attention.",
    "{source} published a fresh analysis saying {topic} is rapidly penetrating every sector and deserves close tracking.",
  ],
  ja: [
    "{topic}に関する報道によると、{source}は業界の注目を集める重要な動きがあったと伝えている。",
    "{source}は最新分析で、{topic}が各分野に急速に広がり注目が必要だと指摘した。",
  ],
  ko: [
    "{topic} 관련 보도에 따르면 {source}는 업계의 주목을 받는 핵심 움직임이 있었다고 전했다.",
    "{source}는 최신 분석에서 {topic}이 각 분야로 빠르게 확산되고 있다고 짚었다.",
  ],
  es: [
    "Según la cobertura de {topic}, {source} informa de avances clave que atraen la atención del sector.",
    "{source} publicó un análisis que señala que {topic} se extiende rápidamente y merece seguimiento.",
  ],
  fr: [
    "Selon la couverture de {topic}, {source} rapporte des avancées clés qui retiennent l'attention du secteur.",
    "{source} a publié une analyse indiquant que {topic} se répand vite et mérite un suivi.",
  ],
};

const bodyExtra: Record<Locale, string[]> = {
  zh: [
    "多位专家在接受采访时表示，{topic}的演进速度超出预期，相关投入也在持续增加。",
    "从全球范围看，不同地区在{topic}上的布局各有侧重，合作与竞争并存。",
    "分析认为，未来一至两年内，{topic}有望带来更明显的实际落地成果。",
  ],
  en: [
    "Several experts said the pace of {topic} is faster than expected, with investment continuing to grow.",
    "Globally, regions approach {topic} with different priorities, blending cooperation and competition.",
    "Analysts believe {topic} could deliver tangible results within the next one to two years.",
  ],
  ja: [
    "複数の専門家は、{topic}の進展は予想を上回り投資も続いていると語った。",
    "世界的に見ると地域ごとに{topic}への取り組みは異なり、協力と競争が混在する。",
    "今後1〜2年で{topic}の実用的な成果がより見えてくると専門家はみている。",
  ],
  ko: [
    "전문가들은 {topic}의 진전 속도가 예상보다 빠르고 투자도 이어지고 있다고 말했다.",
    "지역마다 {topic}에 대한 접근이 달라 협력과 경쟁이 혼재한다.",
    "향후 1~2년 내에 {topic}의 실질적 성과가 더 드러날 것이라고 본다.",
  ],
  es: [
    "Varios expertos afirman que el ritmo de {topic} supera lo previsto y la inversión sigue creciendo.",
    "A nivel global, las regiones abordan {topic} con prioridades distintas, mezclando cooperación y competencia.",
    "Los analistas creen que {topic} podría dar frutos tangibles en uno o dos años.",
  ],
  fr: [
    "Plusieurs experts estiment que la cadence de {topic} dépasse les prévisions et que l'investissement poursuit sa hausse.",
    "Dans le monde, les régions abordent {topic} avec des priorités différentes, mêlant coopération et concurrence.",
    "Les analystes pensent que {topic} pourrait donner des résultats concrets dans un à deux ans.",
  ],
};

const sources: Record<Locale, string[]> = {
  zh: ["环球时报", "新华社", "财新网", "36氪", "钛媒体"],
  en: ["Global Wire", "Daily Chronicle", "Tech Observer", "World Pulse", "The Mercury"],
  ja: ["朝日通信", "日経デジタル", "共同ニュース", "週刊科学"],
  ko: ["서울경제", "한국일보", "연합통신", "테크투데이"],
  es: ["Diario Global", "Noticias Hoy", "El Mundo", "La Vanguardia"],
  fr: ["Le Quotidien", "Actualités Monde", "France Info", "Le Point"],
};

const concepts: Concept[] = [
  // world
  { id: "un-climate-summit", category: "world", t: { zh: "联合国气候峰会", en: "UN climate summit", ja: "国連気候サミット", ko: "유엔 기후 정상회의", es: "cumbre climática de la ONU", fr: "sommet climat de l'ONU" } },
  { id: "refugee-crisis", category: "world", t: { zh: "难民危机", en: "refugee crisis", ja: "難民危機", ko: "난민 위기", es: "crisis de refugiados", fr: "crise des réfugiés" } },
  { id: "global-trade", category: "world", t: { zh: "全球贸易格局", en: "global trade landscape", ja: "世界貿易の構造", ko: "세계 무역 구조", es: "comercio global", fr: "commerce mondial" } },
  { id: "election-watch", category: "world", t: { zh: "大选观察", en: "election watch", ja: "選挙ウオッチ", ko: "선거 관망", es: "elecciones", fr: "élections" } },
  { id: "peace-talks", category: "world", t: { zh: "和平谈判", en: "peace talks", ja: "平和交渉", ko: "평화 회담", es: "conversaciones de paz", fr: "pourparlers de paix" } },
  { id: "space-cooperation", category: "world", t: { zh: "太空国际合作", en: "space cooperation", ja: "宇宙国際協力", ko: "우주 국제 협력", es: "cooperación espacial", fr: "coopération spatiale" } },
  // tech
  { id: "artificial-intelligence", category: "tech", t: { zh: "人工智能", en: "artificial intelligence", ja: "人工知能", ko: "인공지능", es: "inteligencia artificial", fr: "intelligence artificielle" } },
  { id: "quantum-computing", category: "tech", t: { zh: "量子计算", en: "quantum computing", ja: "量子コンピューティング", ko: "양자 컴퓨팅", es: "computación cuántica", fr: "informatique quantique" } },
  { id: "electric-vehicles", category: "tech", t: { zh: "电动汽车", en: "electric vehicles", ja: "電気自動車", ko: "전기차", es: "vehículos eléctricos", fr: "véhicules électriques" } },
  { id: "6g-network", category: "tech", t: { zh: "6G 网络", en: "6G network", ja: "6Gネットワーク", ko: "6G 네트워크", es: "red 6G", fr: "réseau 6G" } },
  { id: "brain-computer", category: "tech", t: { zh: "脑机接口", en: "brain-computer interface", ja: "ブレイン・コンピュータ・インタフェース", ko: "뇌-컴퓨터 인터페이스", es: "interfaz cerebro-computadora", fr: "interface cerveau-ordinateur" } },
  { id: "open-source", category: "tech", t: { zh: "开源生态", en: "open-source ecosystem", ja: "オープンソース", ko: "오픈소스 생태계", es: "código abierto", fr: "open source" } },
  // finance
  { id: "central-bank-rates", category: "finance", t: { zh: "央行利率", en: "central bank rates", ja: "中央銀行金利", ko: "중앙은행 금리", es: "tasas de bancos centrales", fr: "taux des banques centrales" } },
  { id: "crypto-markets", category: "finance", t: { zh: "加密货币市场", en: "crypto markets", ja: "暗号資産市場", ko: "암호화폐 시장", es: "mercados cripto", fr: "marchés crypto" } },
  { id: "global-inflation", category: "finance", t: { zh: "全球通胀", en: "global inflation", ja: "世界インフレ", ko: "세계 인플레이션", es: "inflación global", fr: "inflation mondiale" } },
  { id: "green-energy-stocks", category: "finance", t: { zh: "新能源股", en: "green energy stocks", ja: "グリーンエネルギー株", ko: "친환경 에너지 주식", es: "acciones de energía verde", fr: "actions d'énergie verte" } },
  { id: "real-estate", category: "finance", t: { zh: "房地产市场", en: "real estate market", ja: "不動産市場", ko: "부동산 시장", es: "mercado inmobiliario", fr: "marché immobilier" } },
  { id: "supply-chain", category: "finance", t: { zh: "全球供应链", en: "global supply chain", ja: "世界サプライチェーン", ko: "글로벌 공급망", es: "cadena de suministro", fr: "chaîne d'approvisionnement" } },
  // sports
  { id: "world-cup", category: "sports", t: { zh: "世界杯", en: "World Cup", ja: "ワールドカップ", ko: "월드컵", es: "Copa del Mundo", fr: "Coupe du Monde" } },
  { id: "olympics", category: "sports", t: { zh: "奥运会", en: "Olympics", ja: "オリンピック", ko: "올림픽", es: "Juegos Olímpicos", fr: "Jeux Olympiques" } },
  { id: "marathon-record", category: "sports", t: { zh: "马拉松纪录", en: "marathon record", ja: "マラソン記録", ko: "마라톤 기록", es: "récord de maratón", fr: "record du marathon" } },
  { id: "tennis-open", category: "sports", t: { zh: "网球大满贯", en: "tennis Grand Slam", ja: "テニス四大大会", ko: "테니스 그랜드슬램", es: "Grand Slam de tenis", fr: "Grand Chelem de tennis" } },
  { id: "basketball-finals", category: "sports", t: { zh: "篮球总决赛", en: "basketball finals", ja: "バスケットボール決勝", ko: "농구 결승", es: "finales de baloncesto", fr: "finales de basket" } },
  { id: "esports", category: "sports", t: { zh: "电子竞技", en: "esports", ja: "eスポーツ", ko: "e스포츠", es: "deportes electrónicos", fr: "esport" } },
  // entertainment
  { id: "film-festival", category: "entertainment", t: { zh: "国际电影节", en: "film festival", ja: "国際映画祭", ko: "국제 영화제", es: "festival de cine", fr: "festival de cinéma" } },
  { id: "streaming-wars", category: "entertainment", t: { zh: "流媒体之争", en: "streaming wars", ja: "配信戦争", ko: "스트리밍 전쟁", es: "guerras del streaming", fr: "guerres du streaming" } },
  { id: "pop-music", category: "entertainment", t: { zh: "流行音乐", en: "pop music", ja: "ポップミュージック", ko: "K-팝", es: "música pop", fr: "musique pop" } },
  { id: "box-office", category: "entertainment", t: { zh: "全球票房", en: "global box office", ja: "世界興行収入", ko: "글로벌 박스오피스", es: "taquilla global", fr: "box-office mondial" } },
  { id: "celebrity-news", category: "entertainment", t: { zh: "明星动态", en: "celebrity news", ja: "セレブニュース", ko: "연예 뉴스", es: "noticias de famosos", fr: "actualité people" } },
  { id: "awards-season", category: "entertainment", t: { zh: "颁奖季", en: "awards season", ja: "授賞式シーズン", ko: "시상식 시즌", es: "temporada de premios", fr: "saison des prix" } },
  // health
  { id: "vaccine-research", category: "health", t: { zh: "疫苗研究", en: "vaccine research", ja: "ワクチン研究", ko: "백신 연구", es: "investigación de vacunas", fr: "recherche vaccinale" } },
  { id: "mental-health", category: "health", t: { zh: "心理健康", en: "mental health", ja: "メンタルヘルス", ko: "정신 건강", es: "salud mental", fr: "santé mentale" } },
  { id: "aging-society", category: "health", t: { zh: "老龄化社会", en: "aging society", ja: "高齢化社会", ko: "고령화 사회", es: "envejecimiento poblacional", fr: "vieillissement démographique" } },
  { id: "nutrition", category: "health", t: { zh: "营养科学", en: "nutrition science", ja: "栄養科学", ko: "영양 과학", es: "nutrición", fr: "nutrition" } },
  { id: "telemedicine", category: "health", t: { zh: "远程医疗", en: "telemedicine", ja: "遠隔医療", ko: "원격 의료", es: "telemedicina", fr: "télémédecine" } },
  { id: "sleep-health", category: "health", t: { zh: "睡眠健康", en: "sleep health", ja: "睡眠の健康", ko: "수면 건강", es: "sueño saludable", fr: "sommeil sain" } },
  // science
  { id: "james-webb", category: "science", t: { zh: "詹姆斯·韦伯望远镜", en: "James Webb telescope", ja: "ジェームズ・ウェッブ望遠鏡", ko: "제임스 웹 망원경", es: "telescopio James Webb", fr: "télescope James Webb" } },
  { id: "fusion-energy", category: "science", t: { zh: "核聚变能源", en: "fusion energy", ja: "核融合エネルギー", ko: "핵융합 에너지", es: "energía de fusión", fr: "énergie de fusion" } },
  { id: "gene-editing", category: "science", t: { zh: "基因编辑", en: "gene editing", ja: "遺伝子編集", ko: "유전자 편집", es: "edición genética", fr: "édition génétique" } },
  { id: "climate-science", category: "science", t: { zh: "气候科学", en: "climate science", ja: "気候科学", ko: "기후 과학", es: "ciencia del clima", fr: "science du climat" } },
  { id: "mars-mission", category: "science", t: { zh: "火星任务", en: "Mars mission", ja: "火星ミッション", ko: "화성 탐사", es: "misión a Marte", fr: "mission Mars" } },
  { id: "dark-matter", category: "science", t: { zh: "暗物质", en: "dark matter", ja: "暗黒物質", ko: "암흑 물질", es: "materia oscura", fr: "matière noire" } },
];

// 视频条目用的「平台 + 视频ID」示例（公开可嵌入）。
// 这里用 YouTube/Bilibili 的公开样片 ID 演示「接 YouTube/Bilibili」的嵌入模式；
// 接真实 API（YouTube Data API / Bilibili API）时，只需把 videoPlatform+videoId
// 换成接口拉取的真实值即可，渲染层无需改动。
const videoEmbeds: { platform: "youtube" | "bilibili"; id: string }[] = [
  { platform: "youtube", id: "aqz-KE-bpKQ" }, // Big Buck Bunny（Blender 官方）
  { platform: "youtube", id: "eRsGyueVLvQ" }, // Sintel 预告
  { platform: "youtube", id: "ScMzIvxBSi4" }, // Big Buck Bunny
  { platform: "bilibili", id: "BV1GJ411x7h7" },
  { platform: "bilibili", id: "BV1xx411c7mD" },
  { platform: "youtube", id: "YE7VzlLtp-4" }, // Big Buck Bunny
  { platform: "bilibili", id: "BV1WK411N7cS" },
  { platform: "youtube", id: "b3rNUhDqciM" },
];

// 视频概念池（category 固定为 video）
const videoConcepts: Concept[] = [
  { id: "rocket-launch", category: "video", t: { zh: "火箭发射直播", en: "Rocket launch livestream", ja: "ロケット打ち上げ中継", ko: "로켓 발사 생중계", es: "Lanzamiento de cohete en directo", fr: "Lancement de fusée en direct" } },
  { id: "wildlife-doc", category: "video", t: { zh: "野生动物纪录片", en: "Wildlife documentary", ja: "野生動物ドキュメンタリー", ko: "야생동물 다큐", es: "Documental de vida silvestre", fr: "Documentaire sur la faune" } },
  { id: "city-aerial", category: "video", t: { zh: "城市夜景航拍", en: "City night aerial", ja: "都市の夜景空撮", ko: "도시 야경 드론", es: "Vista aérea nocturna", fr: "Vidéo aérienne de nuit" } },
  { id: "cooking-proc", category: "video", t: { zh: "美食制作过程", en: "Cooking process", ja: "料理の作り方", ko: "요리 과정", es: "Proceso de cocina", fr: "Recette en vidéo" } },
  { id: "football-highlights", category: "video", t: { zh: "足球精彩集锦", en: "Football highlights", ja: "サッカーハイライト", ko: "축구 하이라이트", es: "Resumen de fútbol", fr: "Temps forts de foot" } },
  { id: "space-station-view", category: "video", t: { zh: "太空站视角", en: "Space station view", ja: "宇宙ステーション映像", ko: "우주정거장 영상", es: "Vista desde la EEI", fr: "Vue de la station spatiale" } },
  { id: "aurora-timelapse", category: "video", t: { zh: "极光延时摄影", en: "Aurora timelapse", ja: "オーロラ撮影", ko: "오로라 타임랩스", es: "Timelapse de auroras", fr: "Timelapse des aurores" } },
  { id: "concert-live", category: "video", t: { zh: "音乐会现场", en: "Concert live", ja: "コンサート生中継", ko: "콘서트 라이브", es: "Concierto en vivo", fr: "Concert en direct" } },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const DAY = 24 * 60;

function buildArticle(concept: Concept, locale: Locale): Article {
  const seed = hash(`${concept.id}-${locale}`);
  const topic = concept.t[locale];
  const srcList = sources[locale];
  const source = srcList[seed % srcList.length];
  const title = titleTpl[locale][seed % titleTpl[locale].length].replace("{topic}", topic);
  const summary = summaryTpl[locale][seed % summaryTpl[locale].length]
    .replace("{topic}", topic)
    .replace("{source}", source);
  const body = bodyExtra[locale].map((p) => p.replace("{topic}", topic).replace("{source}", source));
  const imageCount: 1 | 3 = seed % 4 === 0 ? 3 : 1;
  const images = Array.from({ length: imageCount }, (_, i) => `https://picsum.photos/seed/${concept.id}-${locale}-${i}/600/400`);
  const offsetMin = seed % (7 * DAY); // 过去 7 天内
  const publishedAt = Date.now() - offsetMin * 60_000;
  return {
    id: `${concept.category}-${concept.id}`,
    locale,
    category: concept.category,
    title,
    summary,
    body,
    source,
    author: source,
    publishedAt,
    imageCount,
    images,
    tags: [topic],
    readMinutes: 3 + (seed % 5),
  };
}

function buildVideo(concept: Concept, locale: Locale): Article {
  const seed = hash(`${concept.id}-${locale}-v`);
  const topic = concept.t[locale];
  const srcList = sources[locale];
  const source = srcList[seed % srcList.length];
  const title = titleTpl[locale][seed % titleTpl[locale].length].replace("{topic}", topic);
  const summary = summaryTpl[locale][seed % summaryTpl[locale].length]
    .replace("{topic}", topic)
    .replace("{source}", source);
  const body = bodyExtra[locale].map((p) => p.replace("{topic}", topic).replace("{source}", source));
  const images = [`https://picsum.photos/seed/${concept.id}-${locale}/600/400`];
  const emb = videoEmbeds[seed % videoEmbeds.length];
  const offsetMin = seed % (7 * DAY);
  const publishedAt = Date.now() - offsetMin * 60_000;
  return {
    id: `video-${concept.id}`,
    locale,
    category: "video",
    title,
    summary,
    body,
    source,
    author: source,
    publishedAt,
    imageCount: 1,
    images,
    tags: [topic],
    readMinutes: 2 + (seed % 4),
    media: "video",
    videoPlatform: emb.platform,
    videoId: emb.id,
  };
}

let _all: Article[] | null = null;
function allArticles(): Article[] {
  if (_all) return _all;
  _all = [];
  for (const c of concepts) {
    for (const l of locales) {
      _all.push(buildArticle(c, l));
    }
  }
  for (const c of videoConcepts) {
    for (const l of locales) {
      _all.push(buildVideo(c, l));
    }
  }
  return _all;
}

export function getArticles(locale: Locale, category?: Category): Article[] {
  let list = allArticles().filter((a) => a.locale === locale);
  if (category && category !== "recommend") {
    list = list.filter((a) => a.category === category);
  }
  return list.sort((a, b) => b.publishedAt - a.publishedAt);
}

export function getArticle(locale: Locale, id: string): Article | undefined {
  return allArticles().find((a) => a.locale === locale && a.id === id);
}

export function getTrending(locale: Locale, n = 10): Article[] {
  return getArticles(locale)
    .map((a) => {
      const h = hash(a.id + a.locale);
      const recency = 7 * DAY - (h % (7 * DAY));
      const popularity = h % 500;
      return { a, score: recency + popularity };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, n)
    .map((x) => x.a);
}

export function getRelated(locale: Locale, article: Article, n = 6): Article[] {
  return getArticles(locale, article.category)
    .filter((a) => a.id !== article.id)
    .slice(0, n);
}

export function getCategories(): Category[] {
  return [...categories];
}

export function formatRelativeTime(locale: Locale, ts: number, t: {
  agoJustNow: string;
  agoMinutes: (n: number) => string;
  agoHours: (n: number) => string;
  agoDays: (n: number) => string;
}): string {
  const diffMin = Math.max(1, Math.floor((Date.now() - ts) / 60000));
  if (diffMin < 60) return t.agoJustNow;
  if (diffMin < DAY) return t.agoHours(Math.floor(diffMin / 60));
  return t.agoDays(Math.floor(diffMin / DAY));
}
