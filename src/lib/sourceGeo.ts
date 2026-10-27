// 信号源地理映射：RSS 源域名 → 城市代码；城市代码 → 经纬度 + 多语言名。
// 服务端（首页指标聚合）与客户端（信息流过滤）共用，保持单一事实源。

import { Locale, Category } from "@/i18n/config";
import type { Article } from "@/data/news";

export interface GeoPoint {
  code: string;
  x: number;
  y: number;
}

// 分站最新资讯（悬停国家卡片里的可点击新闻条目）
export interface RegionHeadline {
  id: string;
  locale: Locale;
  category: Category;
  title: string;
  publishedAt: number;
}

// 城市注册表：经纬度（globe.gl 用）+ 多语言名称
interface City {
  lat: number;
  lng: number;
  names: Partial<Record<string, string>>;
}
const CITIES: Record<string, City> = {
  BJS: { lat: 39.9042, lng: 116.4074, names: { zh: "北京", en: "Beijing", ja: "北京", ko: "베이징", es: "Pekín", fr: "Pékin", de: "Peking" } },
  NYC: { lat: 40.7128, lng: -74.006, names: { zh: "纽约", en: "New York", ja: "ニューヨーク", ko: "뉴욕", es: "Nueva York", fr: "New York", de: "New York" } },
  LON: { lat: 51.5074, lng: -0.1278, names: { zh: "伦敦", en: "London", ja: "ロンドン", ko: "런던", es: "Londres", fr: "Londres", de: "London" } },
  PAR: { lat: 48.8566, lng: 2.3522, names: { zh: "巴黎", en: "Paris", ja: "パリ", ko: "파리", es: "París", fr: "Paris", de: "Paris" } },
  ICN: { lat: 37.5665, lng: 126.978, names: { zh: "首尔", en: "Seoul", ja: "ソウル", ko: "서울", es: "Seúl", fr: "Séoul", de: "Seoul" } },
  MAD: { lat: 40.4168, lng: -3.7038, names: { zh: "马德里", en: "Madrid", ja: "マドリッド", ko: "마드리드", es: "Madrid", fr: "Madrid", de: "Madrid" } },
  // 主要大国分站（cov19：俄罗斯/加拿大/沙特/巴西/印度/南非/澳大利亚）
  MOW: { lat: 55.7558, lng: 37.6173, names: { zh: "莫斯科", en: "Moscow", ja: "モスクワ", ko: "모스크바", es: "Moscú", fr: "Moscou", de: "Moskau" } },
  YTO: { lat: 43.6532, lng: -79.3832, names: { zh: "多伦多", en: "Toronto", ja: "トロント", ko: "토론토", es: "Toronto", fr: "Toronto", de: "Toronto" } },
  RUH: { lat: 24.7136, lng: 46.6753, names: { zh: "利雅得", en: "Riyadh", ja: "リヤド", ko: "리야드", es: "Riad", fr: "Riyad", de: "Riad" } },
  SAO: { lat: -23.5505, lng: -46.6333, names: { zh: "圣保罗", en: "São Paulo", ja: "サンパウロ", ko: "상파울루", es: "São Paulo", fr: "São Paulo", de: "São Paulo" } },
  MAA: { lat: 13.0827, lng: 80.2707, names: { zh: "金奈", en: "Chennai", ja: "チェンナイ", ko: "첸나이", es: "Chennai", fr: "Chennai", de: "Chennai" } },
  JNB: { lat: -26.2041, lng: 28.0473, names: { zh: "约翰内斯堡", en: "Johannesburg", ja: "ヨハネスブルグ", ko: "요하네스버그", es: "Johannesburgo", fr: "Johannesbourg", de: "Johannesburg" } },
  SYD: { lat: -33.8688, lng: 151.2093, names: { zh: "悉尼", en: "Sydney", ja: "シドニー", ko: "시드니", es: "Sídney", fr: "Sydney", de: "Sydney" } },
  // cov20 分站（德国/意大利/日本/埃及）
  BER: { lat: 52.52, lng: 13.405, names: { zh: "柏林", en: "Berlin", ja: "ベルリン", ko: "베를린", es: "Berlín", fr: "Berlin", de: "Berlin" } },
  ROM: { lat: 41.9028, lng: 12.4964, names: { zh: "罗马", en: "Rome", ja: "ローマ", ko: "로마", es: "Roma", fr: "Rome", de: "Rom" } },
  TYO: { lat: 35.6762, lng: 139.6503, names: { zh: "东京", en: "Tokyo", ja: "東京", ko: "도쿄", es: "Tokio", fr: "Tokyo", de: "Tokio" } },
  CAI: { lat: 30.0444, lng: 31.2357, names: { zh: "开罗", en: "Cairo", ja: "カイロ", ko: "카이로", es: "El Cairo", fr: "Le Caire", de: "Kairo" } },
  // cov21 分站（阿根廷/墨西哥/塞内加尔/摩洛哥）
  EZE: { lat: -34.6037, lng: -58.3816, names: { zh: "布宜诺斯艾利斯", en: "Buenos Aires", ja: "ブエノスアイレス", ko: "부에노스아이레스", es: "Buenos Aires", fr: "Buenos Aires", de: "Buenos Aires" } },
  MEX: { lat: 19.4326, lng: -99.1332, names: { zh: "墨西哥城", en: "Mexico City", ja: "メキシコシティ", ko: "멕시코시티", es: "Ciudad de México", fr: "Mexico", de: "Mexiko-Stadt" } },
  DKR: { lat: 14.7167, lng: -17.4677, names: { zh: "达喀尔", en: "Dakar", ja: "ダカール", ko: "다카르", es: "Dakar", fr: "Dakar", de: "Dakar" } },
  CMN: { lat: 33.5731, lng: -7.5898, names: { zh: "卡萨布兰卡", en: "Casablanca", ja: "カサブランカ", ko: "카사블랑카", es: "Casablanca", fr: "Casablanca", de: "Casablanca" } },
  // cov26 分站（跨洲补齐：中东/欧/亚/非/南美）
  IST: { lat: 41.0082, lng: 28.9784, names: { zh: "伊斯坦布尔", en: "Istanbul", ja: "イスタンブール", ko: "이스탄불", es: "Estambul", fr: "Istanbul", de: "Istanbul" } },
  HAN: { lat: 21.0278, lng: 105.8342, names: { zh: "河内", en: "Hanoi", ja: "ハノイ", ko: "하노이", es: "Hanói", fr: "Hanoï", de: "Hanoi" } },
  AMS: { lat: 52.3676, lng: 4.9041, names: { zh: "阿姆斯特丹", en: "Amsterdam", ja: "アムステルダム", ko: "암스테르담", es: "Ámsterdam", fr: "Amsterdam", de: "Amsterdam" } },
  LIS: { lat: 38.7223, lng: -9.1393, names: { zh: "里斯本", en: "Lisbon", ja: "リスボン", ko: "리스본", es: "Lisboa", fr: "Lisbonne", de: "Lissabon" } },
  BOG: { lat: 4.711, lng: -74.0721, names: { zh: "波哥大", en: "Bogotá", ja: "ボゴタ", ko: "보고타", es: "Bogotá", fr: "Bogota", de: "Bogotá" } },
  LIM: { lat: -12.0464, lng: -77.0428, names: { zh: "利马", en: "Lima", ja: "リマ", ko: "리마", es: "Lima", fr: "Lima", de: "Lima" } },
  MNL: { lat: 14.5995, lng: 120.9842, names: { zh: "马尼拉", en: "Manila", ja: "マニラ", ko: "마닐라", es: "Manila", fr: "Manille", de: "Manila" } },
  STO: { lat: 59.3293, lng: 18.0686, names: { zh: "斯德哥尔摩", en: "Stockholm", ja: "ストックホルム", ko: "스톡홀름", es: "Estocolmo", fr: "Stockholm", de: "Stockholm" } },
  DAC: { lat: 23.8103, lng: 90.4125, names: { zh: "达卡", en: "Dhaka", ja: "ダッカ", ko: "다카", es: "Daca", fr: "Dacca", de: "Dhaka" } },
  LOS: { lat: 6.5244, lng: 3.3792, names: { zh: "拉各斯", en: "Lagos", ja: "ラゴス", ko: "라고스", es: "Lagos", fr: "Lagos", de: "Lagos" } },
  WAW: { lat: 52.2297, lng: 21.0122, names: { zh: "华沙", en: "Warsaw", ja: "ワルシャワ", ko: "바르샤바", es: "Varsovia", fr: "Varsovie", de: "Warschau" } },
  KBP: { lat: 50.4501, lng: 30.5234, names: { zh: "基辅", en: "Kyiv", ja: "キエフ", ko: "키이우", es: "Kiev", fr: "Kiev", de: "Kiew" } },
  // cov28 分站（葡语区 / 土耳其 / 东南亚 数据覆盖扩充）
  // —— 东南亚 ——
  BKK: { lat: 13.7563, lng: 100.5018, names: { zh: "曼谷", en: "Bangkok", ja: "バンコク", ko: "방콕", es: "Bangkok", fr: "Bangkok", de: "Bangkok" } },
  JKT: { lat: -6.2088, lng: 106.8456, names: { zh: "雅加达", en: "Jakarta", ja: "ジャカルタ", ko: "자카르타", es: "Yakarta", fr: "Jakarta", de: "Jakarta" } },
  KUL: { lat: 3.139, lng: 101.6869, names: { zh: "吉隆坡", en: "Kuala Lumpur", ja: "クアラルンプール", ko: "쿠알라룸푸르", es: "Kuala Lumpur", fr: "Kuala Lumpur", de: "Kuala Lumpur" } },
  SIN: { lat: 1.3521, lng: 103.8198, names: { zh: "新加坡", en: "Singapore", ja: "シンガポール", ko: "싱가포르", es: "Singapur", fr: "Singapour", de: "Singapur" } },
  // —— 葡语非洲（安哥拉 / 莫桑比克）——
  LAD: { lat: -8.839, lng: 13.2894, names: { zh: "罗安达", en: "Luanda", ja: "ルアンダ", ko: "루안다", es: "Luanda", fr: "Luanda", de: "Luanda" } },
  MPM: { lat: -25.9692, lng: 32.5732, names: { zh: "马普托", en: "Maputo", ja: "マプト", ko: "마푸토", es: "Maputo", fr: "Maputo", de: "Maputo" } },
  // —— 巴西第二城（里约，丰富葡语南美覆盖）——
  RIO: { lat: -22.9068, lng: -43.1729, names: { zh: "里约热内卢", en: "Rio de Janeiro", ja: "リオデジャネイロ", ko: "리우데자네이루", es: "Río de Janeiro", fr: "Rio de Janeiro", de: "Rio de Janeiro" } },
  // cov29 分站（更多非洲 / 中东 数据覆盖扩充）
  // —— 中东 ——
  DXB: { lat: 25.2048, lng: 55.2708, names: { zh: "迪拜", en: "Dubai", ja: "ドバイ", ko: "두바이", es: "Dubái", fr: "Dubaï", de: "Dubai" } },
  TLV: { lat: 32.0853, lng: 34.7818, names: { zh: "特拉维夫", en: "Tel Aviv", ja: "テルアビブ", ko: "텔아비브", es: "Tel Aviv", fr: "Tel-Aviv", de: "Tel Aviv" } },
  DOH: { lat: 25.2854, lng: 51.531, names: { zh: "多哈", en: "Doha", ja: "ドーハ", ko: "도하", es: "Doha", fr: "Doha", de: "Doha" } },
  AMM: { lat: 31.9454, lng: 35.9284, names: { zh: "安曼", en: "Amman", ja: "アンマン", ko: "암만", es: "Amán", fr: "Amman", de: "Amman" } },
  // —— 非洲（东非 / 南部 / 北非 / 西非）——
  NBO: { lat: -1.2921, lng: 36.8219, names: { zh: "内罗毕", en: "Nairobi", ja: "ナイロビ", ko: "나이로비", es: "Nairobi", fr: "Nairobi", de: "Nairobi" } },
  CPT: { lat: -33.9249, lng: 18.4241, names: { zh: "开普敦", en: "Cape Town", ja: "ケープタウン", ko: "케이프타운", es: "Ciudad del Cabo", fr: "Le Cap", de: "Kapstadt" } },
  ADD: { lat: 9.03, lng: 38.74, names: { zh: "亚的斯亚贝巴", en: "Addis Ababa", ja: "アディスアベバ", ko: "아디스아바바", es: "Adís Abeba", fr: "Addis-Abeba", de: "Addis Abeba" } },
  TUN: { lat: 36.8065, lng: 10.1815, names: { zh: "突尼斯", en: "Tunis", ja: "チュニス", ko: "튀니스", es: "Túnez", fr: "Tunis", de: "Tunis" } },
  GHA: { lat: 5.6037, lng: -0.187, names: { zh: "阿克拉", en: "Accra", ja: "アクラ", ko: "아크라", es: "Accra", fr: "Accra", de: "Accra" } },
  // —— 中亚（cov30 增补；挂 en.world 国际桶，跨语言聚合显示信号）—— 
  ALA: { lat: 43.222, lng: 76.8512, names: { zh: "阿拉木图", en: "Almaty", ja: "アルマトイ", ko: "알마티", es: "Almaty", fr: "Almaty", de: "Almaty" } },
  TAS: { lat: 41.2995, lng: 69.2401, names: { zh: "塔什干", en: "Tashkent", ja: "タシュケント", ko: "타슈켄트", es: "Taskent", fr: "Tachkent", de: "Taschkent" } },
  FRU: { lat: 42.8746, lng: 74.5698, names: { zh: "比什凯克", en: "Bishkek", ja: "ビシュケク", ko: "비슈케크", es: "Biskek", fr: "Bichkek", de: "Bischkek" } },
  DUSH: { lat: 38.5598, lng: 68.787, names: { zh: "杜尚别", en: "Dushanbe", ja: "ドゥシャンベ", ko: "두샨베", es: "Dushambé", fr: "Douchanbé", de: "Duschanbe" } },
  BAK: { lat: 40.4093, lng: 49.8671, names: { zh: "巴库", en: "Baku", ja: "バクー", ko: "바쿠", es: "Bakú", fr: "Bakou", de: "Baku" } },
  // —— 拉美西语区补充（cov30；挂 es.world，与 clarín/infobae 同桶）——
  SCL: { lat: -33.4489, lng: -70.6693, names: { zh: "圣地亚哥", en: "Santiago", ja: "サンティアゴ", ko: "산티아고", es: "Santiago", fr: "Santiago", de: "Santiago" } },
  CCS: { lat: 10.4806, lng: -66.9036, names: { zh: "加拉加斯", en: "Caracas", ja: "カラカス", ko: "카라카스", es: "Caracas", fr: "Caracas", de: "Caracas" } },
  // —— 北欧（cov31；挂 en.world 国际桶，跨语言聚合显示信号）——
  OSL: { lat: 59.9139, lng: 10.7522, names: { zh: "奥斯陆", en: "Oslo", ja: "オスロ", ko: "오슬로", es: "Oslo", fr: "Oslo", de: "Oslo" } },
  CPH: { lat: 55.6761, lng: 12.5683, names: { zh: "哥本哈根", en: "Copenhagen", ja: "コペンハーゲン", ko: "코펜하겐", es: "Copenhague", fr: "Copenhague", de: "Kopenhagen" } },
  HEL: { lat: 60.1699, lng: 24.9384, names: { zh: "赫尔辛基", en: "Helsinki", ja: "ヘルシンキ", ko: "헬싱키", es: "Helsinki", fr: "Helsinki", de: "Helsinki" } },
  // —— 巴尔干（cov31；挂 en.world 国际桶）——
  BEG: { lat: 44.7866, lng: 20.4489, names: { zh: "贝尔格莱德", en: "Belgrade", ja: "ベオグラード", ko: "베오그라드", es: "Belgrado", fr: "Belgrade", de: "Belgrad" } },
  SKP: { lat: 41.9981, lng: 21.4254, names: { zh: "斯科普里", en: "Skopje", ja: "スコピエ", ko: "스코페", es: "Skopie", fr: "Skopje", de: "Skopje" } },
  ZAG: { lat: 45.815, lng: 15.9819, names: { zh: "萨格勒布", en: "Zagreb", ja: "ザグレブ", ko: "자그레브", es: "Zagreb", fr: "Zagreb", de: "Zagreb" } },
  SOF: { lat: 42.6977, lng: 23.3219, names: { zh: "索菲亚", en: "Sofia", ja: "ソフィア", ko: "소피아", es: "Sofía", fr: "Sofia", de: "Sofia" } },
  SAR: { lat: 43.8563, lng: 18.4131, names: { zh: "萨拉热窝", en: "Sarajevo", ja: "サラエヴォ", ko: "사라예보", es: "Sarajevo", fr: "Sarajevo", de: "Sarajevo" } },
  // —— 南亚（cov32；挂 en.world 国际桶，跨语言聚合显示信号）——
  DEL: { lat: 28.6139, lng: 77.209, names: { zh: "德里", en: "Delhi", ja: "デリー", ko: "델리", es: "Delhi", fr: "Delhi", de: "Delhi" } },
  BOM: { lat: 19.076, lng: 72.8777, names: { zh: "孟买", en: "Mumbai", ja: "ムンバイ", ko: "뭄바이", es: "Bombay", fr: "Bombay", de: "Mumbai" } },
  KTM: { lat: 27.7172, lng: 85.324, names: { zh: "加德满都", en: "Kathmandu", ja: "カトマンズ", ko: "카트만두", es: "Katmandú", fr: "Katmandou", de: "Kathmandu" } },
  CMB: { lat: 6.9271, lng: 79.8612, names: { zh: "科伦坡", en: "Colombo", ja: "コロンボ", ko: "콜롬보", es: "Colombo", fr: "Colombo", de: "Colombo" } },
  ISB: { lat: 33.6844, lng: 73.0479, names: { zh: "伊斯兰堡", en: "Islamabad", ja: "イスラマバード", ko: "이슬라마바드", es: "Islamabad", fr: "Islamabad", de: "Islamabad" } },
  KHI: { lat: 24.8607, lng: 67.0011, names: { zh: "卡拉奇", en: "Karachi", ja: "カラチ", ko: "카라치", es: "Karachi", fr: "Karachi", de: "Karatschi" } },
  LAH: { lat: 31.5204, lng: 74.3587, names: { zh: "拉合尔", en: "Lahore", ja: "ラホール", ko: "라호르", es: "Lahore", fr: "Lahore", de: "Lahore" } },
  // —— 中亚补全（cov32）——
  ULN: { lat: 47.8864, lng: 106.9057, names: { zh: "乌兰巴托", en: "Ulaanbaatar", ja: "ウランバートル", ko: "울란바토르", es: "Ulán Bator", fr: "Oulan-Bator", de: "Ulaanbaatar" } },
  ASH: { lat: 37.9601, lng: 58.3261, names: { zh: "阿什哈巴德", en: "Ashgabat", ja: "アシガバート", ko: "아슈하바트", es: "Ashgabat", fr: "Achgabat", de: "Aschgabat" } },
};

// 域名 → 城市代码（SVG x,y 仅旧平面地图用，已弃）
const DOMAIN_TO_CODE: Record<string, string> = {
  "36kr.com": "BJS", "ifanr.com": "BJS", "sspai.com": "BJS", "qbitai.com": "BJS", "feedx.net": "BJS",
  "bbc.co.uk": "LON", "bbc.com": "LON", // bbc.com = BBC Mundo（es），此前漏映射致 187 篇未归站
  "theverge.com": "NYC", "cnbc.com": "NYC", "variety.com": "NYC", "sciencedaily.com": "NYC", "espn.com": "NYC", "news.ycombinator.com": "NYC",
  "france24.com": "PAR",
  "yna.co.kr": "ICN",
  "xataka.com": "MAD", "bolsamania.com": "MAD", "marca.com": "MAD", "elmundo.es": "MAD",
  // cov19 主要大国分站
  "tass.com": "MOW",
  "cbc.ca": "YTO",
  "arabnews.com": "RUH",
  "globo.com": "SAO", // 覆盖 g1.globo.com（endsWith 匹配）
  "thehindu.com": "MAA",
  "sabcnews.com": "JNB",
  "abc.net.au": "SYD",
  // cov20 分站（德国/意大利/日本/埃及）
  "dw.com": "BER", "spiegel.de": "BER",
  "repubblica.it": "ROM", "agi.it": "ROM", "ilsole24ore.com": "ROM",
  "japantimes.co.jp": "TYO", "kyodo.co.jp": "TYO", "asahi.com": "TYO", "mainichi.jp": "TYO",
  "dailynewsegypt.com": "CAI", "egyptindependent.com": "CAI",
  // cov21 分站（阿根廷/墨西哥/塞内加尔/摩洛哥）+ 韩国扩充源
  "clarin.com": "EZE", "lanacion.com.ar": "EZE", "infobae.com": "EZE",
  "elfinanciero.com.mx": "MEX", "jornada.com.mx": "MEX", "mexiconewsdaily.com": "MEX",
  "aps.sn": "DKR", "lesoleil.sn": "DKR",
  "hespress.com": "CMN", "lesiteinfo.com": "CMN", "aujourdhui.ma": "CMN",
  "hani.co.kr": "ICN", "mbn.co.kr": "ICN",
  // cov26 分站（跨洲补齐）
  "dailysabah.com": "IST",
  "vnexpress.net": "HAN", "e.vnexpress.net": "HAN",
  "dutchnews.nl": "AMS",
  "theportugalnews.com": "LIS",
  "colombiareports.com": "BOG",
  "perureports.com": "LIM",
  "inquirer.net": "MNL",
  "thelocal.se": "STO",
  "thedailystar.net": "DAC",
  "premiumtimesng.com": "LOS",
  "notesfrompoland.com": "WAW",
  "kyivpost.com": "KBP",
  // cov28 分站源（葡语 / 土耳其 / 东南亚）
  // —— 东南亚 ——
  "bangkokpost.com": "BKK", "nationthailand.com": "BKK",
  "antaranews.com": "JKT", "kompas.com": "JKT",
  "thestar.com.my": "KUL", "malaymail.com": "KUL",
  "channelnewsasia.com": "SIN", "straitstimes.com": "SIN",
  // —— 葡语区（巴西 / 葡萄牙 / 非洲）——
  "publico.pt": "LIS", "observador.pt": "LIS",
  "uol.com.br": "SAO", "folha.uol.com.br": "SAO",
  "angop.ao": "LAD", "noticias.co.mz": "MPM",
  "tuoitre.vn": "HAN", "gmanetwork.com": "MNL",
  // —— 土耳其（修复 IST 死站：dailysabah 此前漏进采集器；域名映射 line 149 已有 dailysabah.com，此处补 aa / hurriyetdailynews）——
  "aa.com.tr": "IST", "hurriyetdailynews.com": "IST",
  // cov29 分站源（更多非洲 / 中东）
  // —— 中东 ——
  "thenationalnews.com": "DXB",
  "timesofisrael.com": "TLV",
  "aljazeera.com": "DOH",
  "jordantimes.com": "AMM",
  // —— 非洲 ——
  "nation.africa": "NBO",
  "iol.co.za": "CPT",
  "addisstandard.com": "ADD",
  "lapresse.tn": "TUN",
  "ghanaweb.com": "GHA",
  // cov30 分站源（中亚 / 拉美西语区补充）
  // —— 中亚（挂 en.world）——
  "tengrinews.kz": "ALA", "inform.kz": "ALA",
  "kun.uz": "TAS", "gazeta.uz": "TAS",
  "24.kg": "FRU",
  "asiaplustj.info": "DUSH",
  "report.az": "BAK", "trend.az": "BAK",
  // —— 拉美西语区（挂 es.world）——
  "latercera.com": "SCL", "emol.com": "SCL",
  "eltiempo.com": "BOG", "elespectador.com": "BOG",
  "eluniversal.com": "CCS",
  // cov31 分站源（北欧 / 巴尔干；挂 en.world 国际桶）
  // —— 北欧 ——
  "thelocal.no": "OSL",
  "thelocal.dk": "CPH",
  "foreigner.fi": "HEL",
  // —— 巴尔干 ——
  "rs.n1info.com": "BEG",
  "time.mk": "SKP",
  "total-croatia-news.com": "ZAG",
  "novinite.com": "SOF",
  "sarajevotimes.com": "SAR",
  // cov32 分站源（南亚 / 中亚补全；挂 en.world）
  // —— 南亚 ——
  "timesofindia.indiatimes.com": "DEL",
  "freepressjournal.in": "BOM",
  "kathmandupost.com": "KTM",
  "dailynews.lk": "CMB",
  "dawn.com": "ISB",
  "thenews.com.pk": "KHI",
  "tribune.com.pk": "LAH",
  // —— 中亚补全 ——
  "ubpost.mn": "ULN",
  "orient.tm": "ASH",
  // cov34：替换不可达端点后的新映射
  "trthaber.com": "IST",
  "myjoyonline.com": "GHA",
  "capitalfm.co.ke": "NBO",
  "capitalfm.africa": "NBO",
  "mosaiquefm.net": "TUN",
  "middleeasteye.net": "DXB",
  "nezavisen.mk": "SKP",
  // cov37：13 死城复测后找到的可达端点（与上面城市一一对应）
  "dnevnik.bg": "SOF",
  "livemint.com": "BOM",
  "prachachat.net": "BKK",
  "matichon.co.th": "BKK",
  "ikon.mn": "ULN",
  "thereporterethiopia.com": "ADD",
  "ethiopianmonitor.com": "ADD",
};

// 地区运行时指标（首页地球面板用）
export interface RegionStat {
  code: string;
  name: string;
  lat: number;
  lng: number;
  signalCount: number;   // 信号量
  sources: number;
  sourcesList: string[];   // 活跃源域名列表(去重 top8)
  lastSignal: number;    // 最新信号 epoch ms
  topCategory: string;   // 主导分类 key
  categoryDist: { cat: string; n: number }[]; // 分类分布 top4
  activity: number;      // 活跃度 0-100（相对最大区）
  hourDist: number[];    // 过去 24h 信号分布（24 桶，桶 23 = 最近 1h）
  latestTitle: string;   // 最新一条信号标题
  latestId: string;      // 最新一条文章 id（详情跳转）
  avgAgeMin: number;     // 平均新鲜度（分钟，越小越新）
  headlines: RegionHeadline[]; // 最新 5 条（按 publishedAt 倒序，跨语言按源聚合；点击进详情）
}

function bareHost(url?: string): string {
  if (!url) return "";
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.indexOf("www.") === 0 ? h.slice(4) : h;
  } catch {
    return "";
  }
}

export function geoCodeOf(url?: string): string | undefined {
  const h = bareHost(url);
  if (!h) return undefined;
  for (const dom of Object.keys(DOMAIN_TO_CODE)) {
    if (h === dom || h.endsWith("." + dom)) return DOMAIN_TO_CODE[dom];
  }
  return undefined;
}

export function cityName(code: string, locale: Locale): string {
  const c = CITIES[code];
  if (!c) return code;
  return c.names[locale] || c.names.en || code;
}

// 国家（Natural Earth name）→ 城市分站代码：悬停地球上的国家时展示对应分站
const COUNTRY_STATIONS: Record<string, string> = {
  China: "BJS",
  "United States of America": "NYC",
  "United Kingdom": "LON",
  France: "PAR",
  "South Korea": "ICN",
  Spain: "MAD",
  // cov19 主要大国（键名与 countries.geojson 的 properties.name 完全一致）
  Russia: "MOW",
  Canada: "YTO",
  "Saudi Arabia": "RUH",
  Brazil: "SAO",
  India: "MAA",
  "South Africa": "JNB",
  Australia: "SYD",
  // cov20（德国/意大利/日本/埃及）
  Germany: "BER",
  Italy: "ROM",
  Japan: "TYO",
  Egypt: "CAI",
  // cov21（阿根廷/墨西哥/塞内加尔/摩洛哥）
  Argentina: "EZE",
  Mexico: "MEX",
  Senegal: "DKR",
  Morocco: "CMN",
  // cov26 分站（跨洲补齐）
  Turkey: "IST",
  Vietnam: "HAN",
  Netherlands: "AMS",
  Portugal: "LIS",
  Colombia: "BOG",
  Peru: "LIM",
  Philippines: "MNL",
  Sweden: "STO",
  Bangladesh: "DAC",
  Nigeria: "LOS",
  Poland: "WAW",
  Ukraine: "KBP",
  // cov28 分站国家映射（葡语非洲 / 东南亚）
  Thailand: "BKK",
  Indonesia: "JKT",
  Malaysia: "KUL",
  Singapore: "SIN",
  Angola: "LAD",
  Mozambique: "MPM",
  // cov29 国家映射（更多非洲 / 中东）
  "United Arab Emirates": "DXB",
  Israel: "TLV",
  Qatar: "DOH",
  Jordan: "AMM",
  Kenya: "NBO",
  Ethiopia: "ADD",
  Tunisia: "TUN",
  Ghana: "GHA",
  // cov30 国家映射（中亚 / 拉美西语区）
  Kazakhstan: "ALA",
  Uzbekistan: "TAS",
  Kyrgyzstan: "FRU",
  Tajikistan: "DUSH",
  Azerbaijan: "BAK",
  Chile: "SCL",
  Venezuela: "CCS",
  // cov31 国家映射（北欧 / 巴尔干）
  Norway: "OSL",
  Denmark: "CPH",
  Finland: "HEL",
  Serbia: "BEG",
  "North Macedonia": "SKP",
  Croatia: "ZAG",
  Bulgaria: "SOF",
  "Bosnia and Herzegovina": "SAR",
  // cov32 国家映射（南亚 / 中亚补全；India 主站沿用 MAA，不重复键）
  Nepal: "KTM",
  "Sri Lanka": "CMB",
  Pakistan: "ISB",
  Turkmenistan: "ASH",
  Mongolia: "ULN",
};
export function stationOfCountry(name?: string): string | undefined {
  return name ? COUNTRY_STATIONS[name] : undefined;
}

// 国家/地区展示名（中英）。Natural Earth 的 nameZh 含不合规标注（如 Taiwan→中华民国），
// 按国家标准覆写；香港/澳门在中国多边形内无独立 feature。
const GEO_NAME_OVERRIDES: Record<string, { zh: string; en: string }> = {
  Taiwan: { zh: "中国台湾", en: "Taiwan, China" },
};
export interface GeoLabel {
  zh: string;
  en: string;
}
export function geoLabel(name?: string, nameZh?: string): GeoLabel {
  const en = name || "";
  const ov = en ? GEO_NAME_OVERRIDES[en] : undefined;
  return { zh: ov ? ov.zh : nameZh || en, en: ov ? ov.en : en };
}

// 从文章列表聚合各地区实时指标（按 locale 过滤）
export function aggregateRegions(articles: Article[], locale: Locale): RegionStat[] {
  const groups = new Map<string, Article[]>();
  for (const a of articles) {
    const code = geoCodeOf(a.sourceUrl);
    if (!code) continue;
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code)!.push(a);
  }
  const out: RegionStat[] = [];
  let max = 1;
  const now = Date.now();
  for (const [code, items] of groups) {
    const city = CITIES[code];
    const sources = new Set(items.map((i) => bareHost(i.sourceUrl)).filter(Boolean));
    const last = items.reduce((m, i) => Math.max(m, i.publishedAt || 0), 0);
    const catCount = new Map<string, number>();
    for (const i of items) catCount.set(i.category, (catCount.get(i.category) || 0) + 1);
    const dist = [...catCount.entries()]
      .map(([cat, n]) => ({ cat, n }))
      .sort((a, b) => b.n - a.n);
    const top = dist[0]?.cat || "";
    // 过去 24h 信号分布：桶 23 = 最近 1 小时，桶 0 = 23-24h 前
    const hourDist = new Array(24).fill(0) as number[];
    let ageSum = 0;
    let ageN = 0;
    for (const i of items) {
      const t = i.publishedAt || 0;
      if (t <= 0) continue;
      const idx = 23 - Math.floor((now - t) / 3_600_000);
      if (idx >= 0 && idx < 24) hourDist[idx] += 1;
      ageSum += Math.max(0, now - t) / 60_000;
      ageN += 1;
    }
    const latest = items.reduce((m, i) => ((i.publishedAt || 0) > (m.publishedAt || 0) ? i : m), items[0]);
    // 最新 5 条资讯（按发布时间倒序）；跨语言按源聚合，点击各走自身 locale 详情页
    const headlines: RegionHeadline[] = items
      .slice()
      .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
      .slice(0, 5)
      .map((i) => ({
        id: i.id,
        locale: i.locale,
        category: i.category,
        title: i.title,
        publishedAt: i.publishedAt || 0,
      }));
    out.push({
      code,
      name: cityName(code, locale),
      lat: city.lat,
      lng: city.lng,
      signalCount: items.length,
      sources: sources.size,
      sourcesList: [...sources].slice(0, 8),
      lastSignal: last,
      topCategory: top,
      categoryDist: dist.slice(0, 4),
      activity: 0,
      hourDist,
      latestTitle: (latest && latest.title) || "",
      latestId: (latest && latest.id) || "",
      avgAgeMin: ageN ? Math.round(ageSum / ageN) : 0,
      headlines,
    });
    max = Math.max(max, items.length);
  }
  for (const r of out) r.activity = Math.round((r.signalCount / max) * 100);
  out.sort((a, b) => b.signalCount - a.signalCount);
  return out;
}
