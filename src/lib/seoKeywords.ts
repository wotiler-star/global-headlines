import type { Locale, Category } from "@/i18n/config";

/**
 * Centralized SEO keyword phrases per locale.
 *
 * - `CATEGORY_KEYWORDS` drives category-page titles / descriptions / `keywords` meta.
 * - `SITE_KEYWORDS` describes the site as a whole (homepage / layout metadata).
 * - `categoryKeywordMeta()` builds a natural, localized meta object for any category.
 *
 * The brand "starteday" is intentionally never translated.
 */

type KeywordEntry = { primary: string; secondary: string[] };

// `business` is a genuine content pillar but is not a routed `Category` in
// i18n/config. We keep it in the internal map so every locale has all 8
// requested content categories, while the exported const keeps the exact
// `Partial<Record<Category, ...>>` signature other code imports.
type KeywordCategory = Category | "business";

const CATEGORY_KEYWORDS_INTERNAL: Record<
  Locale,
  Partial<Record<KeywordCategory, KeywordEntry>>
> = {
  zh: {
    tech: { primary: "科技新闻", secondary: ["最新科技资讯", "人工智能新闻", "科技行业动态", "消费电子新闻"] },
    science: { primary: "科学新闻", secondary: ["最新科学发现", "科学研究进展", "太空探索新闻", "生命科学资讯"] },
    health: { primary: "健康新闻", secondary: ["健康资讯", "医疗健康新闻", "养生科普", "医学研究进展"] },
    business: { primary: "商业新闻", secondary: ["商业资讯", "企业动态", "商业趋势", "创业新闻"] },
    finance: { primary: "财经新闻", secondary: ["金融市场资讯", "股市动态", "投资理财新闻"] },
    culture: { primary: "文化新闻", secondary: ["文化资讯", "艺术与文化动态", "文化遗产新闻"] },
    crossborder: { primary: "跨境新闻", secondary: ["跨境电商资讯", "国际贸易动态", "出海新闻"] },
    world: { primary: "国际新闻", secondary: ["全球新闻资讯", "世界时事", "国际局势动态"] },
  },
  "zh-Hant": {
    tech: { primary: "科技新聞", secondary: ["最新科技資訊", "人工智慧新聞", "科技產業動態", "消費電子新聞"] },
    science: { primary: "科學新聞", secondary: ["最新科學發現", "科學研究進展", "太空探索新聞", "生命科學資訊"] },
    health: { primary: "健康新聞", secondary: ["健康資訊", "醫療健康新聞", "養生知識", "醫學研究進展"] },
    business: { primary: "商業新聞", secondary: ["商業資訊", "企業動態", "商業趨勢", "創業新聞"] },
    finance: { primary: "財經新聞", secondary: ["金融市場資訊", "股市動態", "投資理財新聞"] },
    culture: { primary: "文化新聞", secondary: ["文化資訊", "藝術與文化動態", "文化遺產新聞"] },
    crossborder: { primary: "跨境新聞", secondary: ["跨境電商資訊", "國際貿易動態", "出海新聞"] },
    world: { primary: "國際新聞", secondary: ["全球新聞資訊", "世界時事", "國際局勢動態"] },
  },
  en: {
    tech: { primary: "technology news", secondary: ["latest technology news", "AI news today", "tech industry trends", "consumer technology news", "tech startup news"] },
    science: { primary: "science news", secondary: ["latest science discoveries", "space exploration news", "scientific research breakthroughs", "life science news", "natural sciences news"] },
    health: { primary: "health news", secondary: ["latest health news", "medical research news", "wellness tips", "healthcare industry news", "public health news"] },
    business: { primary: "business news", secondary: ["latest business news", "company news today", "business trends", "startup news"] },
    finance: { primary: "finance news", secondary: ["financial markets news", "stock market today", "investing news"] },
    culture: { primary: "culture news", secondary: ["arts and culture news", "cultural heritage news", "entertainment culture news"] },
    crossborder: { primary: "cross-border news", secondary: ["cross-border ecommerce news", "international trade news", "global expansion news"] },
    world: { primary: "world news", secondary: ["global news today", "international news", "world affairs news"] },
  },
  ja: {
    tech: { primary: "技術ニュース", secondary: ["最新テクノロジーニュース", "AIニュース", "テック業界の動向", "家電・ガジェットニュース"] },
    science: { primary: "科学ニュース", secondary: ["最新の科学発見", "宇宙探査ニュース", "科学研究の進展", "生命科学ニュース"] },
    health: { primary: "健康ニュース", secondary: ["健康情報", "医療ニュース", "健康管理のヒント", "医学研究ニュース"] },
    business: { primary: "ビジネスニュース", secondary: ["最新ビジネスニュース", "企業ニュース", "ビジネストレンド", "スタートアップニュース"] },
    finance: { primary: "金融ニュース", secondary: ["金融市場ニュース", "株式市場の動向", "投資情報"] },
    culture: { primary: "文化ニュース", secondary: ["芸術・文化ニュース", "文化遺産ニュース", "伝統文化ニュース"] },
    crossborder: { primary: "越境ビジネスニュース", secondary: ["越境ECニュース", "国際貿易ニュース", "海外展開ニュース"] },
    world: { primary: "国際ニュース", secondary: ["世界ニュース", "海外ニュース", "国際情勢ニュース"] },
  },
  ko: {
    tech: { primary: "기술 뉴스", secondary: ["최신 기술 뉴스", "AI 뉴스", "테크 산업 동향", "소비자 기술 뉴스"] },
    science: { primary: "과학 뉴스", secondary: ["최신 과학 발견", "우주 탐사 뉴스", "과학 연구 성과", "생명과학 뉴스"] },
    health: { primary: "건강 뉴스", secondary: ["최신 건강 뉴스", "건강 정보", "의학 연구 뉴스", "건강 관리 팁"] },
    business: { primary: "비즈니스 뉴스", secondary: ["최신 비즈니스 뉴스", "기업 뉴스", "비즈니스 트렌드", "스타트업 뉴스"] },
    finance: { primary: "금융 뉴스", secondary: ["금융 시장 뉴스", "주식 시장 뉴스", "투자 뉴스"] },
    culture: { primary: "문화 뉴스", secondary: ["예술 문화 뉴스", "문화유산 뉴스", "전통 문화 뉴스"] },
    crossborder: { primary: "크로스보더 뉴스", secondary: ["국제 무역 뉴스", "해외 진출 뉴스", "크로스보더 커머스 뉴스"] },
    world: { primary: "국제 뉴스", secondary: ["세계 뉴스", "세계 정세 뉴스", "해외 뉴스"] },
  },
  es: {
    tech: { primary: "noticias de tecnología", secondary: ["últimas noticias de tecnología", "noticias de inteligencia artificial", "tendencias tecnológicas", "tecnología de consumo"] },
    science: { primary: "noticias de ciencia", secondary: ["últimos descubrimientos científicos", "noticias de exploración espacial", "avances científicos", "noticias de investigación científica"] },
    health: { primary: "noticias de salud", secondary: ["últimas noticias de salud", "noticias de investigación médica", "consejos de bienestar", "salud y medicina"] },
    business: { primary: "noticias de negocios", secondary: ["últimas noticias de negocios", "noticias de empresas", "tendencias empresariales", "noticias de startups"] },
    finance: { primary: "noticias financieras", secondary: ["noticias de los mercados financieros", "bolsa de valores hoy", "noticias de inversión"] },
    culture: { primary: "noticias de cultura", secondary: ["noticias de arte y cultura", "patrimonio cultural", "noticias culturales"] },
    crossborder: { primary: "noticias transfronterizas", secondary: ["comercio electrónico transfronterizo", "noticias de comercio internacional", "expansión global"] },
    world: { primary: "noticias del mundo", secondary: ["noticias mundiales", "noticias internacionales", "actualidad internacional"] },
  },
  fr: {
    tech: { primary: "actualités technologie", secondary: ["dernières actualités techno", "actualités intelligence artificielle", "tendances technologiques", "technologie grand public"] },
    science: { primary: "actualités science", secondary: ["dernières découvertes scientifiques", "actualités exploration spatiale", "avancées scientifiques", "recherche scientifique"] },
    health: { primary: "actualités santé", secondary: ["dernières actualités santé", "actualités recherche médicale", "conseils bien-être", "santé et médecine"] },
    business: { primary: "actualités entreprises", secondary: ["dernières actualités business", "actualités des entreprises", "tendances business", "actualités startups"] },
    finance: { primary: "actualités finance", secondary: ["actualités marchés financiers", "bourse aujourd'hui", "actualités investissement"] },
    culture: { primary: "actualités culture", secondary: ["actualités art et culture", "patrimoine culturel", "actualités culturelles"] },
    crossborder: { primary: "actualités transfrontalières", secondary: ["commerce électronique transfrontalier", "actualités commerce international", "expansion internationale"] },
    world: { primary: "actualités monde", secondary: ["actualités mondiales", "actualités internationales", "vie internationale"] },
  },
  de: {
    tech: { primary: "Technologie Nachrichten", secondary: ["neueste Technologie Nachrichten", "KI Nachrichten heute", "Technik Trends", "Unterhaltungselektronik Nachrichten"] },
    science: { primary: "Wissenschaft Nachrichten", secondary: ["neueste wissenschaftliche Entdeckungen", "Raumfahrt Nachrichten", "Forschungsfortschritte", "Lebenswissenschaften Nachrichten"] },
    health: { primary: "Gesundheit Nachrichten", secondary: ["neueste Gesundheitsnachrichten", "Medizin Forschung Nachrichten", "Gesundheitstipps", "Gesundheitswesen Nachrichten"] },
    business: { primary: "Wirtschaft Nachrichten", secondary: ["neueste Wirtschaftsnachrichten", "Unternehmensnachrichten", "Wirtschaftstrends", "Startup Nachrichten"] },
    finance: { primary: "Finanzen Nachrichten", secondary: ["Finanzmärkte Nachrichten", "Börse heute", "Investition Nachrichten"] },
    culture: { primary: "Kultur Nachrichten", secondary: ["Kunst und Kultur Nachrichten", "Kulturerbe Nachrichten", "Kultur Nachrichten heute"] },
    crossborder: { primary: "Grenzüberschreitende Nachrichten", secondary: ["Grenzüberschreitender E-Commerce", "Internationaler Handel Nachrichten", "Globale Expansion Nachrichten"] },
    world: { primary: "Weltnachrichten", secondary: ["aktuelle Weltnachrichten", "internationale Nachrichten", "Weltgeschehen Nachrichten"] },
  },
  it: {
    tech: { primary: "notizie tecnologia", secondary: ["ultime notizie tecnologia", "notizie intelligenza artificiale", "tendenze tecnologiche", "tecnologia di consumo"] },
    science: { primary: "notizie scienza", secondary: ["ultime scoperte scientifiche", "notizie esplorazione spaziale", "progressi scientifici", "ricerca scientifica notizie"] },
    health: { primary: "notizie salute", secondary: ["ultime notizie salute", "notizie ricerca medica", "consigli benessere", "salute e medicina"] },
    business: { primary: "notizie business", secondary: ["ultime notizie business", "notizie aziende", "tendenze business", "notizie startup"] },
    finance: { primary: "notizie finanza", secondary: ["notizie mercati finanziari", "borsa oggi", "notizie investimenti"] },
    culture: { primary: "notizie cultura", secondary: ["notizie arte e cultura", "patrimonio culturale", "notizie culturali"] },
    crossborder: { primary: "notizie transfrontaliere", secondary: ["e-commerce transfrontaliero", "notizie commercio internazionale", "espansione globale"] },
    world: { primary: "notizie dal mondo", secondary: ["notizie mondiali", "notizie internazionali", "attualità internazionale"] },
  },
  pt: {
    tech: { primary: "notícias de tecnologia", secondary: ["últimas notícias de tecnologia", "notícias de inteligência artificial", "tendências tecnológicas", "tecnologia de consumo"] },
    science: { primary: "notícias de ciência", secondary: ["últimas descobertas científicas", "notícias de exploração espacial", "avanços científicos", "notícias de pesquisa científica"] },
    health: { primary: "notícias de saúde", secondary: ["últimas notícias de saúde", "notícias de pesquisa médica", "dicas de bem-estar", "saúde e medicina"] },
    business: { primary: "notícias de negócios", secondary: ["últimas notícias de negócios", "notícias de empresas", "tendências de negócios", "notícias de startups"] },
    finance: { primary: "notícias financeiras", secondary: ["notícias dos mercados financeiros", "bolsa de valores hoje", "notícias de investimento"] },
    culture: { primary: "notícias de cultura", secondary: ["notícias de arte e cultura", "património cultural", "notícias culturais"] },
    crossborder: { primary: "notícias transfronteiriças", secondary: ["comércio eletrónico transfronteiriço", "notícias de comércio internacional", "expansão global"] },
    world: { primary: "notícias do mundo", secondary: ["notícias mundiais", "notícias internacionais", "atualidade internacional"] },
  },
  tr: {
    tech: { primary: "teknoloji haberleri", secondary: ["en son teknoloji haberleri", "yapay zeka haberleri", "teknoloji trendleri", "tüketici teknolojisi haberleri"] },
    science: { primary: "bilim haberleri", secondary: ["son bilimsel keşifler", "uzay keşfi haberleri", "bilimsel araştırma gelişmeleri", "yaşam bilimleri haberleri"] },
    health: { primary: "sağlık haberleri", secondary: ["son sağlık haberleri", "tıbbi araştırma haberleri", "sağlıklı yaşam önerileri", "sağlık ve tıp haberleri"] },
    business: { primary: "iş haberleri", secondary: ["son iş haberleri", "şirket haberleri", "iş trendleri", "girişim haberleri"] },
    finance: { primary: "finans haberleri", secondary: ["finansal piyasa haberleri", "borsa bugün", "yatırım haberleri"] },
    culture: { primary: "kültür haberleri", secondary: ["sanat ve kültür haberleri", "kültürel miras haberleri", "kültür sanat haberleri"] },
    crossborder: { primary: "sınır ötesi haberler", secondary: ["sınır ötesi e-ticaret", "uluslararası ticaret haberleri", "global genişleme haberleri"] },
    world: { primary: "dünya haberleri", secondary: ["güncel dünya haberleri", "uluslararası haberler", "dünya gündemi"] },
  },
  ru: {
    tech: { primary: "новости технологий", secondary: ["последние новости технологий", "новости искусственного интеллекта", "тренды в технологиях", "новости потребительских технологий"] },
    science: { primary: "новости науки", secondary: ["последние научные открытия", "новости космонавтики", "научные исследования", "новости естественных наук"] },
    health: { primary: "новости здравоохранения", secondary: ["последние новости о здоровье", "новости медицинских исследований", "советы по здоровью", "новости медицины"] },
    business: { primary: "новости бизнеса", secondary: ["последние бизнес-новости", "новости компаний", "бизнес-тренды", "новости стартапов"] },
    finance: { primary: "финансовые новости", secondary: ["новости финансовых рынков", "фондовый рынок сегодня", "новости инвестиций"] },
    culture: { primary: "новости культуры", secondary: ["новости искусства и культуры", "культурное наследие", "новости культурной жизни"] },
    crossborder: { primary: "трансграничные новости", secondary: ["трансграничная электронная коммерция", "новости международной торговли", "новости глобального расширения"] },
    world: { primary: "мировые новости", secondary: ["новости мира сегодня", "международные новости", "мировые события"] },
  },
  uk: {
    tech: { primary: "новини технологій", secondary: ["останні новини технологій", "новини штучного інтелекту", "тренди в технологіях", "новини споживчих технологій"] },
    science: { primary: "новини науки", secondary: ["останні наукові відкриття", "новини космонавтики", "наукові дослідження", "новини природничих наук"] },
    health: { primary: "новини здоров'я", secondary: ["останні новини про здоров'я", "новини медичних досліджень", "поради щодо здоров'я", "новини медицини"] },
    business: { primary: "новини бізнесу", secondary: ["останні бізнес-новини", "новини компаній", "бізнес-тренди", "новини стартапів"] },
    finance: { primary: "фінансові новини", secondary: ["новини фінансових ринків", "фондовий ринок сьогодні", "новини інвестицій"] },
    culture: { primary: "новини культури", secondary: ["новини мистецтва і культури", "культурна спадщина", "новини культурного життя"] },
    crossborder: { primary: "транскордонні новини", secondary: ["транскордонна електронна комерція", "новини міжнародної торгівлі", "новини глобального розширення"] },
    world: { primary: "світові новини", secondary: ["новини світу сьогодні", "міжнародні новини", "світові події"] },
  },
  ar: {
    tech: { primary: "أخبار التقنية", secondary: ["أحدث أخبار التقنية", "أخبار الذكاء الاصطناعي", "اتجاهات التكنولوجيا", "أخبار التكنولوجيا الاستهلاكية"] },
    science: { primary: "أخبار العلوم", secondary: ["أحدث الاكتشافات العلمية", "أخبار استكشاف الفضاء", "الأبحاث العلمية", "أخبار العلوم الطبيعية"] },
    health: { primary: "أخبار الصحة", secondary: ["أحدث أخبار الصحة", "أخبار الأبحاث الطبية", "نصائح صحية", "أخبار الطب والصحة"] },
    business: { primary: "أخبار الأعمال", secondary: ["أحدث أخبار الأعمال", "أخبار الشركات", "اتجاهات الأعمال", "أخبار الشركات الناشئة"] },
    finance: { primary: "الأخبار المالية", secondary: ["أخبار الأسواق المالية", "سوق الأسهم اليوم", "أخبار الاستثمار"] },
    culture: { primary: "أخبار الثقافة", secondary: ["أخبار الفن والثقافة", "التراث الثقافي", "أخبار الثقافة والفنون"] },
    crossborder: { primary: "أخبار عبر الحدود", secondary: ["التجارة الإلكترونية عبر الحدود", "أخبار التجارة الدولية", "أخبار التوسع العالمي"] },
    world: { primary: "أخبار العالم", secondary: ["أخبار العالم اليوم", "الأخبار الدولية", "شؤون العالم"] },
  },
  hi: {
    tech: { primary: "टेक्नोलॉजी न्यूज़", secondary: ["नवीनतम टेक्नोलॉजी न्यूज़", "एआई न्यूज़", "टेक इंडस्ट्री ट्रेंड्स", "कंज्यूमर टेक न्यूज़"] },
    science: { primary: "विज्ञान समाचार", secondary: ["नवीनतम वैज्ञानिक खोज", "अंतरिक्ष अन्वेषण समाचार", "वैज्ञानिक अनुसंधान", "जीव विज्ञान समाचार"] },
    health: { primary: "स्वास्थ्य समाचार", secondary: ["नवीनतम स्वास्थ्य समाचार", "चिकित्सा अनुसंधान समाचार", "स्वास्थ्य सुझाव", "स्वास्थ्य और चिकित्सा"] },
    business: { primary: "व्यापार समाचार", secondary: ["नवीनतम व्यापार समाचार", "कंपनी समाचार", "व्यापार रुझान", "स्टार्टअप समाचार"] },
    finance: { primary: "वित्त समाचार", secondary: ["वित्तीय बाजार समाचार", "शेयर बाजार आज", "निवेश समाचार"] },
    culture: { primary: "संस्कृति समाचार", secondary: ["कला और संस्कृति समाचार", "सांस्कृतिक विरासत", "सांस्कृतिक समाचार"] },
    crossborder: { primary: "सीमा पार समाचार", secondary: ["सीमा पार ई-कॉमर्स", "अंतरराष्ट्रीय व्यापार समाचार", "वैश्विक विस्तार समाचार"] },
    world: { primary: "विश्व समाचार", secondary: ["आज के विश्व समाचार", "अंतरराष्ट्रीय समाचार", "विश्व की घटनाएं"] },
  },
  id: {
    tech: { primary: "berita teknologi", secondary: ["berita teknologi terbaru", "berita kecerdasan buatan", "tren industri teknologi", "berita teknologi konsumen"] },
    science: { primary: "berita sains", secondary: ["penemuan ilmiah terbaru", "berita eksplorasi luar angkasa", "penelitian ilmiah", "berita sains dan teknologi"] },
    health: { primary: "berita kesehatan", secondary: ["berita kesehatan terbaru", "berita penelitian medis", "tips kesehatan", "berita kesehatan dan kedokteran"] },
    business: { primary: "berita bisnis", secondary: ["berita bisnis terbaru", "berita perusahaan", "tren bisnis", "berita startup"] },
    finance: { primary: "berita keuangan", secondary: ["berita pasar keuangan", "pasar saham hari ini", "berita investasi"] },
    culture: { primary: "berita budaya", secondary: ["berita seni dan budaya", "warisan budaya", "berita budaya terkini"] },
    crossborder: { primary: "berita lintas batas", secondary: ["e-commerce lintas batas", "berita perdagangan internasional", "berita ekspansi global"] },
    world: { primary: "berita dunia", secondary: ["berita dunia hari ini", "berita internasional", "berita dunia terkini"] },
  },
  ms: {
    tech: { primary: "berita teknologi", secondary: ["berita teknologi terkini", "berita kecerdasan buatan", "trend industri teknologi", "berita teknologi pengguna"] },
    science: { primary: "berita sains", secondary: ["penemuan saintifik terkini", "berita penerokaan angkasa", "penyelidikan saintifik", "berita sains dan teknologi"] },
    health: { primary: "berita kesihatan", secondary: ["berita kesihatan terkini", "berita penyelidikan perubatan", "tips kesihatan", "berita perubatan"] },
    business: { primary: "berita perniagaan", secondary: ["berita perniagaan terkini", "berita syarikat", "trend perniagaan", "berita syarikat pemula"] },
    finance: { primary: "berita kewangan", secondary: ["berita pasaran kewangan", "pasaran saham hari ini", "berita pelaburan"] },
    culture: { primary: "berita budaya", secondary: ["berita seni dan budaya", "warisan budaya", "berita kebudayaan"] },
    crossborder: { primary: "berita rentas sempadan", secondary: ["e-dagang rentas sempadan", "berita perdagangan antarabangsa", "berita pengembangan global"] },
    world: { primary: "berita dunia", secondary: ["berita dunia hari ini", "berita antarabangsa", "berita dunia semasa"] },
  },
  fil: {
    tech: { primary: "balita sa teknolohiya", secondary: ["pinakabagong balita sa teknolohiya", "balita sa artificial intelligence", "mga uso sa teknolohiya", "balita sa consumer tech"] },
    science: { primary: "balita sa agham", secondary: ["pinakabagong mga tuklas sa agham", "balita sa eksplorasyon ng kalawakan", "pananaliksik sa agham", "balita sa agham at teknolohiya"] },
    health: { primary: "balita sa kalusugan", secondary: ["pinakabagong balita sa kalusugan", "balita sa medikal na pananaliksik", "mga tip sa kalusugan", "balita sa medisina"] },
    business: { primary: "balita sa negosyo", secondary: ["pinakabagong balita sa negosyo", "balita sa mga kumpanya", "mga uso sa negosyo", "balita sa startup"] },
    finance: { primary: "balita sa pananalapi", secondary: ["balita sa mga pamilihang pinansyal", "stock market ngayon", "balita sa pamumuhunan"] },
    culture: { primary: "balita sa kultura", secondary: ["balita sa sining at kultura", "pamana ng kultura", "balita sa pamana ng kultura"] },
    crossborder: { primary: "balita sa cross-border", secondary: ["cross-border e-commerce", "balita sa pandaigdigang kalakalan", "balita sa global na pagpapalawak"] },
    world: { primary: "balita sa mundo", secondary: ["balita sa buong mundo", "pandaigdigang balita", "balita sa pandaigdigang usapin"] },
  },
  vi: {
    tech: { primary: "tin công nghệ", secondary: ["tin công nghệ mới nhất", "tin tức trí tuệ nhân tạo", "xu hướng ngành công nghệ", "tin công nghệ tiêu dùng"] },
    science: { primary: "tin khoa học", secondary: ["khám phá khoa học mới nhất", "tin thám hiểm không gian", "nghiên cứu khoa học", "tin khoa học tự nhiên"] },
    health: { primary: "tin sức khỏe", secondary: ["tin sức khỏe mới nhất", "tin nghiên cứu y học", "lời khuyên sức khỏe", "tin y tế"] },
    business: { primary: "tin doanh nghiệp", secondary: ["tin doanh nghiệp mới nhất", "tin tức công ty", "xu hướng kinh doanh", "tin khởi nghiệp"] },
    finance: { primary: "tin tài chính", secondary: ["tin thị trường tài chính", "chứng khoán hôm nay", "tin đầu tư"] },
    culture: { primary: "tin văn hóa", secondary: ["tin nghệ thuật và văn hóa", "di sản văn hóa", "tin tức văn hóa"] },
    crossborder: { primary: "tin xuyên biên giới", secondary: ["thương mại điện tử xuyên biên giới", "tin thương mại quốc tế", "tin mở rộng toàn cầu"] },
    world: { primary: "tin thế giới", secondary: ["tin thế giới hôm nay", "tin quốc tế", "tin tức thế giới"] },
  },
  th: {
    tech: { primary: "ข่าวเทคโนโลยี", secondary: ["ข่าวเทคโนโลยีล่าสุด", "ข่าวปัญญาประดิษฐ์", "เทรนด์เทคโนโลยี", "ข่าวเทคโนโลยีผู้บริโภค"] },
    science: { primary: "ข่าววิทยาศาสตร์", secondary: ["การค้นพบทางวิทยาศาสตร์ล่าสุด", "ข่าวการสำรวจอวกาศ", "งานวิจัยทางวิทยาศาสตร์", "ข่าววิทยาศาสตร์ธรรมชาติ"] },
    health: { primary: "ข่าวสุขภาพ", secondary: ["ข่าวสุขภาพล่าสุด", "ข่าวการวิจัยทางการแพทย์", "คำแนะนำด้านสุขภาพ", "ข่าวการแพทย์"] },
    business: { primary: "ข่าวธุรกิจ", secondary: ["ข่าวธุรกิจล่าสุด", "ข่าวบริษัท", "เทรนด์ธุรกิจ", "ข่าวสตาร์ทอัพ"] },
    finance: { primary: "ข่าวการเงิน", secondary: ["ข่าวตลาดการเงิน", "ตลาดหุ้นวันนี้", "ข่าวการลงทุน"] },
    culture: { primary: "ข่าววัฒนธรรม", secondary: ["ข่าวศิลปะและวัฒนธรรม", "มรดกทางวัฒนธรรม", "ข่าวศิลปวัฒนธรรม"] },
    crossborder: { primary: "ข่าวข้ามพรมแดน", secondary: ["อีคอมเมิร์ซข้ามพรมแดน", "ข่าวการค้าระหว่างประเทศ", "ข่าวการขยายตัวทั่วโลก"] },
    world: { primary: "ข่าวโลก", secondary: ["ข่าวโลกวันนี้", "ข่าวระหว่างประเทศ", "ข่าวสถานการณ์โลก"] },
  },
  my: {
    tech: { primary: "နည်းပညာသတင်း", secondary: ["နောက်ဆုံးနည်းပညာသတင်း", "AI သတင်း", "နည်းပညာလမ်းကြောင်း", "စားသုံးသူနည်းပညာသတင်း"] },
    science: { primary: "သိပ္ပံသတင်း", secondary: ["နောက်ဆုံးသိပ္ပံရှာဖွေတွေ့ရှိမှု", "အာကာသစူးစမ်းမှုသတင်း", "သိပ္ပံသုတေသန", "သဘာဝသိပ္ပံသတင်း"] },
    health: { primary: "ကျန်းမာရေးသတင်း", secondary: ["နောက်ဆုံးကျန်းမာရေးသတင်း", "ဆေးပညာသုတေသနသတင်း", "ကျန်းမာရေးအကြံပြုချက်", "ဆေးပညာသတင်း"] },
    business: { primary: "စီးပွားရေးသတင်း", secondary: ["နောက်ဆုံးစီးပွားရေးသတင်း", "ကုမ္ပဏီသတင်း", "စီးပွားရေးလမ်းကြောင်း", "စတင်လုပ်ငန်းသတင်း"] },
    finance: { primary: "ငွေကြေးသတင်း", secondary: ["ငွေကြေးဈေးကွက်သတင်း", "ယနေ့စတော့ဈေးကွက်", "ရင်းနှီးမြှုပ်နှံမှုသတင်း"] },
    culture: { primary: "ယဉ်ကျေးမှုသတင်း", secondary: ["အနုပညာနှင့်ယဉ်ကျေးမှုသတင်း", "ယဉ်ကျေးမှုအမွှာ", "အနုပညာသတင်း"] },
    crossborder: { primary: "နယ်စပ်ဖြတ်ကျော်သတင်း", secondary: ["နယ်စပ်ဖြတ်ကျော်အီးကောမာ့စ်", "နိုင်ငံတကာကုန်သွယ်မှုသတင်း", "ကမ္ဘာ့ချဲ့ထွင်မှုသတင်း"] },
    world: { primary: "ကမ္ဘာ့သတင်း", secondary: ["ယနေ့ကမ္ဘာ့သတင်း", "နိုင်ငံတကာသတင်း", "ကမ္ဘာ့အဖြစ်အပျက်"] },
  },
  bn: {
    tech: { primary: "প্রযুক্তি সংবাদ", secondary: ["সর্বশেষ প্রযুক্তি সংবাদ", "এআই সংবাদ", "প্রযুক্তি শিল্পের প্রবণতা", "ভোক্তা প্রযুক্তি সংবাদ"] },
    science: { primary: "বিজ্ঞান সংবাদ", secondary: ["সর্বশেষ বৈজ্ঞানিক আবিষ্কার", "মহাকাশ অন্বেষণ সংবাদ", "বৈজ্ঞানিক গবেষণা", "প্রাকৃতিক বিজ্ঞান সংবাদ"] },
    health: { primary: "স্বাস্থ্য সংবাদ", secondary: ["সর্বশেষ স্বাস্থ্য সংবাদ", "চিকিৎসা গবেষণা সংবাদ", "স্বাস্থ্য পরামর্শ", "স্বাস্থ্য ও চিকিৎসা"] },
    business: { primary: "ব্যবসা সংবাদ", secondary: ["সর্বশেষ ব্যবসা সংবাদ", "কোম্পানি সংবাদ", "ব্যবসায়িক প্রবণতা", "স্টার্টআপ সংবাদ"] },
    finance: { primary: "অর্থ সংবাদ", secondary: ["আর্থিক বাজার সংবাদ", "আজকের শেয়ার বাজার", "বিনিয়োগ সংবাদ"] },
    culture: { primary: "সংস্কৃতি সংবাদ", secondary: ["শিল্প ও সংস্কৃতি সংবাদ", "সাংস্কৃতিক ঐতিহ্য", "সাংস্কৃতিক সংবাদ"] },
    crossborder: { primary: "সীমান্তবর্তী সংবাদ", secondary: ["সীমান্তবর্তী ই-কমার্স", "আন্তর্জাতিক বাণিজ্য সংবাদ", "বৈশ্বিক সম্প্রসারণ সংবাদ"] },
    world: { primary: "বিশ্ব সংবাদ", secondary: ["আজকের বিশ্ব সংবাদ", "আন্তর্জাতিক সংবাদ", "বিশ্বের ঘটনা"] },
  },
  ur: {
    tech: { primary: "ٹیکنالوجی کی خبریں", secondary: ["تازہ ترین ٹیکنالوجی کی خبریں", "اے آئی کی خبریں", "ٹیک انڈسٹری کے رجحانات", "صارفین کی ٹیکنالوجی کی خبریں"] },
    science: { primary: "سائنس کی خبریں", secondary: ["تازہ ترین سائنسی دریافتیں", "خلائی تحقیق کی خبریں", "سائنسی تحقیق", "قدرتی سائنس کی خبریں"] },
    health: { primary: "صحت کی خبریں", secondary: ["تازہ ترین صحت کی خبریں", "طبی تحقیق کی خبریں", "صحت کے مشورے", "طب اور صحت کی خبریں"] },
    business: { primary: "کاروبار کی خبریں", secondary: ["تازہ ترین کاروباری خبریں", "کمپنی کی خبریں", "کاروباری رجحانات", "اسٹارٹ اپ کی خبریں"] },
    finance: { primary: "مالیاتی خبریں", secondary: ["مالیاتی منڈیوں کی خبریں", "آج اسٹاک مارکیٹ", "سرمایہ کاری کی خبریں"] },
    culture: { primary: "ثقافت کی خبریں", secondary: ["فن اور ثقافت کی خبریں", "ثقافتی ورثہ", "ثقافتی خبریں"] },
    crossborder: { primary: "سرحد پار خبریں", secondary: ["سرحد پار ای کامرس", "بین الاقوامی تجارت کی خبریں", "عالمی توسیع کی خبریں"] },
    world: { primary: "دنیا کی خبریں", secondary: ["آج دنیا کی خبریں", "بین الاقوامی خبریں", "عالمی واقعات"] },
  },
};

export const CATEGORY_KEYWORDS: Record<
  Locale,
  Partial<Record<Category, { primary: string; secondary: string[] }>>
> = CATEGORY_KEYWORDS_INTERNAL;

/** Site-level keyword meta for the homepage / layout, localized per locale. */
export const SITE_KEYWORDS: Record<Locale, string> = {
  zh: "starteday, 多语言新闻, 全球科技新闻, 科学新闻, 健康新闻, 原创报道, 全球资讯, 多语种原创新闻",
  "zh-Hant": "starteday, 多語言新聞, 全球科技新聞, 科學新聞, 健康新聞, 原創報道, 全球資訊, 多語種原創新聞",
  en: "starteday, multilingual news, global technology news, science news, health news, original journalism, world news in your language",
  ja: "starteday, 多言語ニュース, 世界のテクノロジーニュース, 科学ニュース, 健康ニュース, オリジナル記事, 世界中のニュース",
  ko: "starteday, 다국어 뉴스, 글로벌 기술 뉴스, 과학 뉴스, 건강 뉴스, 오리지널 기사, 세계 뉴스, 내 언어로 보는 뉴스",
  es: "starteday, noticias multilingües, noticias tecnológicas globales, noticias de ciencia, noticias de salud, periodismo original, noticias del mundo en tu idioma",
  fr: "starteday, actualités multilingues, actualités technologiques mondiales, actualités science, actualités santé, journalisme original, actualités du monde en votre langue",
  de: "starteday, mehrsprachige Nachrichten, globale Technologie Nachrichten, Wissenschaft Nachrichten, Gesundheit Nachrichten, Originalberichte, Weltnachrichten in Ihrer Sprache",
  it: "starteday, notizie multilingue, notizie tecnologiche globali, notizie scienza, notizie salute, giornalismo originale, notizie dal mondo nella tua lingua",
  pt: "starteday, notícias multilíngues, notícias tecnológicas globais, notícias de ciência, notícias de saúde, jornalismo original, notícias do mundo no seu idioma",
  tr: "starteday, çok dilli haberler, küresel teknoloji haberleri, bilim haberleri, sağlık haberleri, özgün habercilik, dünyadan haberler, kendi dilinizde dünya haberleri",
  ru: "starteday, многоязычные новости, мировые новости технологий, новости науки, новости здоровья, оригинальные материалы, мировые новости на вашем языке",
  uk: "starteday, багатомовні новини, світові новини технологій, новини науки, новини здоров'я, оригінальні матеріали, світові новини вашою мовою",
  ar: "starteday, أخبار متعددة اللغات, أخبار التكنولوجيا العالمية, أخبار العلوم, أخبار الصحة, صحافة أصلية, أخبار العالم بلغتك",
  hi: "starteday, बहुभाषी समाचार, वैश्विक टेक्नोलॉजी समाचार, विज्ञान समाचार, स्वास्थ्य समाचार, मौलिक पत्रकारिता, आपकी भाषा में विश्व समाचार",
  id: "starteday, berita multibahasa, berita teknologi global, berita sains, berita kesehatan, jurnalisme orisinal, berita dunia dalam bahasa Anda",
  ms: "starteday, berita pelbagai bahasa, berita teknologi global, berita sains, berita kesihatan, kewartawanan asli, berita dunia dalam bahasa anda",
  fil: "starteday, multilingual na balita, pandaigdigang balita sa teknolohiya, balita sa agham, balita sa kalusugan, orihinal na pamamahayag, balita sa mundo sa iyong wika",
  vi: "starteday, tin đa ngôn ngữ, tin công nghệ toàn cầu, tin khoa học, tin sức khỏe, báo chí nguyên bản, tin thế giới bằng ngôn ngữ của bạn",
  th: "starteday, ข่าวหลายภาษา, ข่าวเทคโนโลยีโลก, ข่าววิทยาศาสตร์, ข่าวสุขภาพ, สื่อมวลชนต้นฉบับ, ข่าวโลกในภาษาของคุณ",
  my: "starteday, ဘာသာစုံသတင်း, ကမ္ဘာ့နည်းပညာသတင်း, သိပ္ပံသတင်း, ကျန်းမာရေးသတင်း, မူရင်းသတင်းစာပေ, သင့်ဘာသာဖြင့် ကမ္ဘာ့သတင်း",
  bn: "starteday, বহুভাষিক সংবাদ, বৈশ্বিক প্রযুক্তি সংবাদ, বিজ্ঞান সংবাদ, স্বাস্থ্য সংবাদ, মৌলিক সাংবাদিকতা, আপনার ভাষায় বিশ্ব সংবাদ",
  ur: "starteday, کثیر لسانی خبریں, عالمی ٹیکنالوجی کی خبریں, سائنس کی خبریں, صحت کی خبریں, اصل صحافت, آپ کی زبان میں دنیا کی خبریں",
};

// ---------------------------------------------------------------------------
// Graceful fallback for categories without a dedicated keyword entry.
// Only the 5 "non-content-pillar" routes need this: recommend / sports /
// entertainment / game / video. Names are the localized category name plus a
// generic news word, exactly as used in the i18n dictionaries.
// ---------------------------------------------------------------------------

type FallbackCat = Extract<
  Category,
  "recommend" | "sports" | "entertainment" | "game" | "video"
>;

const FALLBACK_KEYWORDS: Record<
  Locale,
  { names: Record<FallbackCat, string>; secondary: string[] }
> = {
  zh: {
    names: { recommend: "推荐新闻", sports: "体育新闻", entertainment: "娱乐新闻", game: "游戏新闻", video: "视频新闻" },
    secondary: ["今日最新新闻", "全球热点资讯"],
  },
  "zh-Hant": {
    names: { recommend: "推薦新聞", sports: "體育新聞", entertainment: "娛樂新聞", game: "遊戲新聞", video: "視頻新聞" },
    secondary: ["今日最新新聞", "全球熱點資訊"],
  },
  en: {
    names: { recommend: "recommended news", sports: "sports news", entertainment: "entertainment news", game: "game news", video: "video news" },
    secondary: ["latest news today", "top stories worldwide"],
  },
  ja: {
    names: { recommend: "おすすめニュース", sports: "スポーツニュース", entertainment: "エンタメニュース", game: "ゲームニュース", video: "ビデオニュース" },
    secondary: ["今日の最新ニュース", "世界の話題"],
  },
  ko: {
    names: { recommend: "추천 뉴스", sports: "스포츠 뉴스", entertainment: "연예 뉴스", game: "게임 뉴스", video: "비디오 뉴스" },
    secondary: ["오늘의 최신 뉴스", "세계 주요 뉴스"],
  },
  es: {
    names: { recommend: "noticias recomendadas", sports: "noticias de deportes", entertainment: "noticias de entretenimiento", game: "noticias de juegos", video: "noticias de vídeos" },
    secondary: ["últimas noticias de hoy", "noticias destacadas del mundo"],
  },
  fr: {
    names: { recommend: "actualités recommandées", sports: "actualités sport", entertainment: "actualités divertissement", game: "actualités jeux", video: "actualités vidéo" },
    secondary: ["dernières actualités du jour", "actualités à la une"],
  },
  de: {
    names: { recommend: "Empfohlene Nachrichten", sports: "Sport Nachrichten", entertainment: "Unterhaltungsnachrichten", game: "Spiele Nachrichten", video: "Video Nachrichten" },
    secondary: ["neueste Nachrichten heute", "Top-Nachrichten aus aller Welt"],
  },
  it: {
    names: { recommend: "notizie consigliate", sports: "notizie sport", entertainment: "notizie intrattenimento", game: "notizie giochi", video: "notizie video" },
    secondary: ["ultime notizie di oggi", "notizie in evidenza nel mondo"],
  },
  pt: {
    names: { recommend: "notícias recomendadas", sports: "notícias de desporto", entertainment: "notícias de entretenimento", game: "notícias de jogos", video: "notícias de vídeo" },
    secondary: ["últimas notícias de hoje", "notícias em destaque no mundo"],
  },
  tr: {
    names: { recommend: "önerilen haberler", sports: "spor haberleri", entertainment: "eğlence haberleri", game: "oyun haberleri", video: "video haberleri" },
    secondary: ["güncel son haberler", "dünyadan öne çıkan haberler"],
  },
  ru: {
    names: { recommend: "рекомендуемые новости", sports: "спортивные новости", entertainment: "новости развлечений", game: "новости игр", video: "видео новости" },
    secondary: ["последние новости сегодня", "главные новости мира"],
  },
  uk: {
    names: { recommend: "рекомендовані новини", sports: "спортивні новини", entertainment: "новини розваг", game: "новини ігор", video: "відео новини" },
    secondary: ["останні новини сьогодні", "головні новини світу"],
  },
  ar: {
    names: { recommend: "أخبار موصى بها", sports: "أخبار رياضية", entertainment: "أخبار ترفيهية", game: "أخبار ألعاب", video: "أخبار فيديو" },
    secondary: ["أحدث الأخبار اليوم", "أبرز الأخبار العالمية"],
  },
  hi: {
    names: { recommend: "अनुशंसित समाचार", sports: "खेल समाचार", entertainment: "मनोरंजन समाचार", game: "गेम्स समाचार", video: "वीडियो समाचार" },
    secondary: ["आज की नवीनतम खबरें", "दुनिया की प्रमुख खबरें"],
  },
  id: {
    names: { recommend: "berita rekomendasi", sports: "berita olahraga", entertainment: "berita hiburan", game: "berita game", video: "berita video" },
    secondary: ["berita terbaru hari ini", "berita utama dunia"],
  },
  ms: {
    names: { recommend: "berita cadangan", sports: "berita sukan", entertainment: "berita hiburan", game: "berita permainan", video: "berita video" },
    secondary: ["berita terkini hari ini", "berita utama dunia"],
  },
  fil: {
    names: { recommend: "inirerekomendang balita", sports: "balita sa palakasan", entertainment: "balita sa libangan", game: "balita sa laro", video: "balita sa video" },
    secondary: ["pinakabagong balita ngayon", "mga pangunahing balita sa mundo"],
  },
  vi: {
    names: { recommend: "tin đề xuất", sports: "tin thể thao", entertainment: "tin giải trí", game: "tin game", video: "tin video" },
    secondary: ["tin mới nhất hôm nay", "tin nổi bật thế giới"],
  },
  th: {
    names: { recommend: "ข่าวแนะนำ", sports: "ข่าวกีฬา", entertainment: "ข่าวบันเทิง", game: "ข่าวเกม", video: "ข่าววิดีโอ" },
    secondary: ["ข่าวล่าสุดวันนี้", "ข่าวเด่นโลก"],
  },
  my: {
    names: { recommend: "အကြံပြုသတင်း", sports: "အားကစားသတင်း", entertainment: "ဖျော်ဖြေရေးသတင်း", game: "ဂိမ်းသတင်း", video: "ဗီဒီယိုသတင်း" },
    secondary: ["ယနေ့ နောက်ဆုံးသတင်း", "ကမ္ဘာ့ထင်ရှားသတင်း"],
  },
  bn: {
    names: { recommend: "সুপারিশকৃত সংবাদ", sports: "খেলাধুলার সংবাদ", entertainment: "বিনোদন সংবাদ", game: "গেম সংবাদ", video: "ভিডিও সংবাদ" },
    secondary: ["আজকের সর্বশেষ সংবাদ", "বিশ্বের শীর্ষ সংবাদ"],
  },
  ur: {
    names: { recommend: "تجویز کردہ خبریں", sports: "کھیل کی خبریں", entertainment: "تفریح کی خبریں", game: "گیمز کی خبریں", video: "ویڈیو کی خبریں" },
    secondary: ["آج کی تازہ ترین خبریں", "دنیا کی اہم خبریں"],
  },
};

// One natural sentence template per locale. {primary} / {s1} / {s2} are filled
// with the category's primary keyword and its first two secondary phrases.
const DESCRIPTION_TEMPLATE: Record<Locale, string> = {
  zh: "在 starteday 阅读原创{primary}，从{s1}到{s2}，用中文带你看懂全球。",
  "zh-Hant": "在 starteday 閱讀原創{primary}，從{s1}到{s2}，用中文帶你看懂全球。",
  en: "Read original {primary} on starteday — from {s1} to {s2}, all in your language.",
  ja: "starteday ではオリジナルの{primary}をお届け。{s1}から{s2}まで、日本語で世界を読み解きます。",
  ko: "starteday에서 오리지널 {primary}를 만나보세요. {s1}부터 {s2}까지, 한국어로 세계를 읽습니다.",
  es: "Descubre {primary} originales en starteday: desde {s1} hasta {s2}, en tu idioma.",
  fr: "Découvrez des {primary} originales sur starteday : de {s1} à {s2}, dans votre langue.",
  de: "Entdecken Sie originale {primary} auf starteday – von {s1} bis {s2}, in Ihrer Sprache.",
  it: "Scopri {primary} originali su starteday: da {s1} a {s2}, nella tua lingua.",
  pt: "Descubra {primary} originais no starteday: de {s1} a {s2}, no seu idioma.",
  tr: "starteday'de özgün {primary} keşfedin: {s1} ve {s2} dünyadan, kendi dilinizde.",
  ru: "Читайте оригинальные {primary} на starteday: от {s1} до {s2}, на вашем языке.",
  uk: "Читайте оригінальні {primary} на starteday: від {s1} до {s2}, вашою мовою.",
  ar: "اقرأ {primary} الأصلية على starteday، من {s1} إلى {s2}، بلغتك.",
  hi: "starteday पर मौलिक {primary} पढ़ें — {s1} से {s2} तक, आपकी भाषा में।",
  id: "Baca {primary} orisinal di starteday — dari {s1} hingga {s2}, dalam bahasa Anda.",
  ms: "Baca {primary} asli di starteday — daripada {s1} hingga {s2}, dalam bahasa anda.",
  fil: "Basahin ang orihinal na {primary} sa starteday — mula {s1} hanggang {s2}, sa iyong wika.",
  vi: "Đọc {primary} nguyên bản trên starteday — từ {s1} đến {s2}, bằng ngôn ngữ của bạn.",
  th: "อ่าน {primary} ต้นฉบับบน starteday ตั้งแต่ {s1} ถึง {s2} ในภาษาของคุณ",
  my: "starteday တွင် မူရင်း {primary} ဖတ်ရှုပါ — {s1} မှ {s2} အထိ သင့်ဘာသာဖြင့်။",
  bn: "starteday-এ মৌলিক {primary} পড়ুন — {s1} থেকে {s2}, আপনার ভাষায়।",
  ur: "starteday پر اصل {primary} پڑھیں — {s1} سے {s2} تک، آپ کی زبان میں۔",
};

/** Keep a meta description within a sane length without cutting mid-word when possible. */
function clampDescription(value: string, max = 154): string {
  if (value.length <= max) return value;
  const cut = value.lastIndexOf(" ", max - 1);
  const safe = cut > max * 0.6 ? value.slice(0, cut) : value.slice(0, max - 1);
  return `${safe.trimEnd()}…`;
}

/**
 * Build keyword-rich, natural SEO meta for a category page.
 *
 * Falls back gracefully for categories without a dedicated keyword entry
 * (recommend / sports / entertainment / game / video) and never throws.
 */
export function categoryKeywordMeta(
  loc: Locale,
  cat: Category,
): { title: string; description: string; keywords: string } {
  const mapped = CATEGORY_KEYWORDS[loc]?.[cat];

  let entry: KeywordEntry;
  if (mapped) {
    entry = mapped;
  } else {
    const fallback = FALLBACK_KEYWORDS[loc] ?? FALLBACK_KEYWORDS.en;
    const name = fallback.names[cat as FallbackCat] ?? `${cat} news`;
    entry = { primary: name, secondary: fallback.secondary };
  }

  const primary = entry.primary;
  const secondary = entry.secondary;
  const s1 = secondary[0] ?? primary;
  const s2 = secondary[1] ?? s1;

  const template = DESCRIPTION_TEMPLATE[loc] ?? DESCRIPTION_TEMPLATE.en;
  const description = clampDescription(
    template
      .replace(/\{primary\}/g, primary)
      .replace(/\{s1\}/g, s1)
      .replace(/\{s2\}/g, s2),
  );

  return {
    // 只返回主关键词——layout 的 title.template 会统一追加 " · starteday"，
    // 这里再带品牌会变成 "X · starteday · starteday"（已在线上实测复现）。
    title: primary,
    description,
    keywords: [primary, ...secondary].join(","),
  };
}
