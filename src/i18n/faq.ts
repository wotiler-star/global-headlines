import { Locale } from "./config";

// 搜索落地页（bare /search）可见 FAQ + FAQPage 结构化数据文案。
// 独立模块，避免污染巨型字典；8 语种各 4 问，内容与搜索/站点能力真实对应
//（Google FAQ 政策要求 Q&A 必须在页面可见，schema 与 DOM 必须一致）。
export type FaqItem = { q: string; a: string };

export const FAQ: Record<
  Locale,
  { title: string; landingDesc: string; items: FaqItem[] }
> = {
  zh: {
    title: "常见问题",
    landingDesc:
      "在 starteday 搜索全球科技、财经、国际、体育等多语言资讯，按分类与最新排序筛选结果。",
    items: [
      {
        q: "如何在 starteday 上搜索新闻？",
        a: "在页面顶部搜索框输入关键词并回车，即可获得来自全球多语言来源的相关结果。",
      },
      {
        q: "starteday 支持哪些语言？",
        a: "提供简体中文、English、日本語、한국어、Español、Français、Português、Türkçe 共 8 种语言版本。",
      },
      {
        q: "搜索结果的内容来自哪里？",
        a: "我们聚合全球多元来源，并提供编辑精选与原创深度报道，每条均标注来源与发布时间。",
      },
      {
        q: "能否按分类或关键词筛选？",
        a: "可以。搜索结果页支持综合/分类切换与相关度/最新排序，首页也提供分类导航。",
      },
    ],
  },
  en: {
    title: "Frequently asked questions",
    landingDesc:
      "Search global tech, finance, world and sports news in multiple languages on starteday; filter by category and sort by relevance or recency.",
    items: [
      {
        q: "How do I search news on starteday?",
        a: "Type a keyword into the search box at the top of the page and press Enter to get related results from multilingual sources worldwide.",
      },
      {
        q: "Which languages does starteday support?",
        a: "We offer eight language editions: Simplified Chinese, English, Japanese, Korean, Spanish, French, Portuguese and Turkish.",
      },
      {
        q: "Where does the search content come from?",
        a: "We aggregate diverse global sources and add editor's picks and original reporting, each item showing its source and publish time.",
      },
      {
        q: "Can I filter by category or keyword?",
        a: "Yes. The search results page lets you switch across categories and sort by relevance or newest, and the home page offers category navigation.",
      },
    ],
  },
  ja: {
    title: "よくある質問",
    landingDesc:
      "starteday で世界のテクノロジー・金融・国際・スポーツなどの多言語ニュースを検索し、カテゴリで絞り込み、関連度や新着で並べ替えられます。",
    items: [
      {
        q: "starteday でニュースを検索するには？",
        a: "ページ上部の検索ボックスにキーワードを入力して Enter を押すと、世界中の多言語ソースから関連記事が表示されます。",
      },
      {
        q: "starteday はどの言語に対応していますか？",
        a: "簡体字中国語、English、日本語、한국어、Español、Français、Português、Türkçe の 8 言語版を提供しています。",
      },
      {
        q: "検索結果の内容はどこから来ていますか？",
        a: "世界中の多様なソースを集約し、編集部のおすすめやオリジナル記事を加えており、各記事に出典と公開時刻を明記しています。",
      },
      {
        q: "カテゴリやキーワードで絞り込めますか？",
        a: "はい。検索結果ページではカテゴリ切り替えや関連度・新着での並べ替えができ、ホームにもカテゴリナビがあります。",
      },
    ],
  },
  ko: {
    title: "자주 묻는 질문",
    landingDesc:
      "starteday에서 세계 기술·금융·국제·스포츠 등 다국어 뉴스를 검색하고, 분류별로 필터링하며 관련도나 최신순으로 정렬하세요.",
    items: [
      {
        q: "starteday에서 뉴스를 검색하려면?",
        a: "페이지 상단 검색창에 키워드를 입력하고 Enter를 누르면 전 세계 다국어 소스의 관련 기사가 표시됩니다.",
      },
      {
        q: "starteday는 어떤 언어를 지원하나요?",
        a: "간체 중국어, English, 日本語, 한국어, Español, Français, Português, Türkçe 총 8개 언어판을 제공합니다.",
      },
      {
        q: "검색 결과는 어디서 왔나요?",
        a: "전 세계 다양한 소스를 모아 편집자가 추천하는 기사와 오리지널 보도를 더하며, 각 기사에 출처와 게시 시각을 표시합니다.",
      },
      {
        q: "분류나 키워드로 필터링할 수 있나요?",
        a: "네. 검색 결과 페이지에서 분류 전환과 관련도·최신순 정렬이 가능하며 홈에도 분류 내비가 있습니다.",
      },
    ],
  },
  es: {
    title: "Preguntas frecuentes",
    landingDesc:
      "Busca en starteday noticias globales de tecnología, finanzas, mundo y deportes en varios idiomas; filtra por categoría y ordena por relevancia o recencia.",
    items: [
      {
        q: "¿Cómo busco noticias en starteday?",
        a: "Escribe una palabra clave en el buscador superior y pulsa Enter para ver resultados de fuentes multilingües de todo el mundo.",
      },
      {
        q: "¿Qué idiomas admite starteday?",
        a: "Ofrecemos ocho ediciones: chino simplificado, inglés, japonés, coreano, español, francés, portugués y turco.",
      },
      {
        q: "¿De dónde proviene el contenido de búsqueda?",
        a: "Agregamos fuentes globales diversas con selecciones del editor y reportajes originales, cada uno con su fuente y hora de publicación.",
      },
      {
        q: "¿Puedo filtrar por categoría o palabra clave?",
        a: "Sí. La página de resultados permite cambiar de categoría y ordenar por relevancia o novedad, y el inicio ofrece navegación por categorías.",
      },
    ],
  },
  fr: {
    title: "Questions fréquentes",
    landingDesc:
      "Recherchez sur starteday l'actualité mondiale (tech, finance, monde, sport) en plusieurs langues, filtrez par catégorie et triez par pertinence ou nouveauté.",
    items: [
      {
        q: "Comment rechercher des actualités sur starteday ?",
        a: "Saisissez un mot-clé dans la barre de recherche en haut de la page et appuyez sur Entrée pour obtenir des résultats de sources multilingues.",
      },
      {
        q: "Quelles langues starteday prend-il en charge ?",
        a: "Nous proposons huit éditions : chinois simplifié, anglais, japonais, coréen, espagnol, français, portugais et turc.",
      },
      {
        q: "D'où provient le contenu des résultats ?",
        a: "Nous agrégeons des sources mondiales variées, ajoutons des sélections de la rédaction et des reportages originaux, chacun avec sa source et son heure de publication.",
      },
      {
        q: "Puis-je filtrer par catégorie ou mot-clé ?",
        a: "Oui. La page de résultats permet de changer de catégorie et de trier par pertinence ou nouveauté, et l'accueil propose une navigation par catégories.",
      },
    ],
  },
  pt: {
    title: "Perguntas frequentes",
    landingDesc:
      "Pesquise no starteday notícias globais de tecnologia, finanças, mundo e desporto em vários idiomas; filtre por categoria e ordene por relevância ou novidade.",
    items: [
      {
        q: "Como pesquiso notícias no starteday?",
        a: "Digite uma palavra-chave na caixa de pesquisa no topo e prima Enter para ver resultados de fontes multilingues de todo o mundo.",
      },
      {
        q: "Que idiomas o starteday suporta?",
        a: "Oferecemos oito edições: chinês simplificado, inglês, japonês, coreano, espanhol, francês, português e turco.",
      },
      {
        q: "De onde vêm os conteúdos da pesquisa?",
        a: "Agregamos fontes globais diversas, com seleções da redação e reportagens originais, cada uma com a sua fonte e hora de publicação.",
      },
      {
        q: "Posso filtrar por categoria ou palavra-chave?",
        a: "Sim. A página de resultados permite trocar de categoria e ordenar por relevância ou novidade, e o início tem navegação por categorias.",
      },
    ],
  },
  tr: {
    title: "Sıkça sorulan sorular",
    landingDesc:
      "starteday'de teknoloji, finans, dünya ve spor haberlerini çok dilli arayın; kategoriye göre filtreleyin, alaka veya yenilik sırasına göre sıralayın.",
    items: [
      {
        q: "starteday'de haberleri nasıl ararım?",
        a: "Sayfanın üstündeki arama kutusuna bir anahtar kelime yazıp Enter'a basın; dünyanın dört bir yanından çok dilli kaynakların sonuçlarını görün.",
      },
      {
        q: "starteday hangi dilleri destekliyor?",
        a: "Basitleştirilmiş Çince, İngilizce, Japonca, Korece, İspanyolca, Fransızca, Portekizce ve Türkçe olmak üzere sekiz dil sürümü sunuyoruz.",
      },
      {
        q: "Arama sonuçları nereden geliyor?",
        a: "Çeşitli küresel kaynakları derliyor, editörün seçtikleri ve özgün haberler ekliyor; her öğe kaynağını ve yayın saatini gösteriyor.",
      },
      {
        q: "Kategori veya anahtar kelimeye göre filtreleyebilir miyim?",
        a: "Evet. Sonuçlar sayfasında kategori değiştirip alaka veya en yeni sıralaması yapabilir, ana sayfada kategori gezinmesi bulabilirsiniz.",
      },
    ],
  },
  ru: {
    title: "Часто задаваемые вопросы",
    landingDesc:
      "Ищите глобальные новости о технологиях, финансах, мире и спорте на нескольких языках в starteday; фильтруйте по категориям и сортируйте по релевантности или новизне.",
    items: [
      {
        q: "Как искать новости в starteday?",
        a: "Введите ключевое слово в строку поиска вверху страницы и нажмите Enter, чтобы получить связанные результаты из многоязычных источников по всему миру.",
      },
      {
        q: "Какие языки поддерживает starteday?",
        a: "Мы предлагаем восемь языковых версий: упрощённый китайский, английский, японский, корейский, испанский, французский, португальский и турецкий.",
      },
      {
        q: "Откуда берётся содержимое результатов поиска?",
        a: "Мы агрегируем разнообразные мировые источники и добавляем подборки редакции и оригинальные материалы; для каждой записи указаны источник и время публикации.",
      },
      {
        q: "Можно ли фильтровать по категории или ключевому слову?",
        a: "Да. Страница результатов позволяет переключаться между категориями и сортировать по релевантности или новизне, а на главной есть навигация по категориям.",
      },
    ],
  },
  ar: {
    title: "الأسئلة الشائعة",
    landingDesc:
      "ابحث في starteday عن أخبار التقنية والتمويل والعالم والرياضة بعدة لغات؛ صفِّ حسب التصنيف ورتّب حسب الصلة أو الحداثة.",
    items: [
      {
        q: "كيف أبحث عن الأخبار في starteday؟",
        a: "اكتب كلمة مفتاحية في مربع البحث أعلى الصفحة واضغط Enter للحصول على نتائج ذات صلة من مصادر متعددة اللغات حول العالم.",
      },
      {
        q: "ما اللغات التي يدعمها starteday؟",
        a: "نقدّم ثماني نسخ لغوية: الصينية المبسطة، الإنجليزية، اليابانية، الكورية، الإسبانية، الفرنسية، البرتغالية والتركية.",
      },
      {
        q: "من أين يأتي محتوى البحث؟",
        a: "نجمع مصادر عالمية متنوعة ونضيف اختيارات المحررين وتقارير أصلية، مع ذكر المصدر ووقت النشر لكل عنصر.",
      },
      {
        q: "هل يمكنني التصفية حسب التصنيف أو الكلمة المفتاحية؟",
        a: "نعم. تتيح صفحة النتائج تبديل التصنيفات والترتيب حسب الصلة أو الأحدث، وتوفر الصفحة الرئيسية تنقلاً حسب التصنيف.",
      },
    ],
  },
  hi: {
    title: "अक्सर पूछे जाने वाले प्रश्न",
    landingDesc:
      "starteday पर कई भाषाओं में वैश्विक तकनीक, वित्त, विश्व और खेल समाचार खोजें; श्रेणी के अनुसार फ़िल्टर करें और प्रासंगिकता या नवीनता के अनुसार क्रमबद्ध करें।",
    items: [
      {
        q: "मैं starteday पर समाचार कैसे खोजूँ?",
        a: "पृष्ठ के शीर्ष पर खोज बॉक्स में कोई कीवर्ड लिखें और Enter दबाएँ, जिससे दुनिया भर के बहुभाषी स्रोतों से संबंधित परिणाम मिलेंगे।",
      },
      {
        q: "starteday किन भाषाओं का समर्थन करता है?",
        a: "हम आठ भाषा संस्करण प्रदान करते हैं: सरलीकृत चीनी, अंग्रेज़ी, जापानी, कोरियाई, स्पेनिश, फ़्रेंच, पुर्तगाली और तुर्की।",
      },
      {
        q: "खोज की सामग्री कहाँ से आती है?",
        a: "हम विविध वैश्विक स्रोतों को एकत्र करते हैं और संपादकों की पसंद व मौलिक रिपोर्टिंग जोड़ते हैं, जिसमें प्रत्येक आइटम का स्रोत और प्रकाशन समय दर्शाया जाता है।",
      },
      {
        q: "क्या मैं श्रेणी या कीवर्ड के अनुसार फ़िल्टर कर सकता हूँ?",
        a: "हाँ। परिणाम पृष्ठ पर श्रेणियाँ बदलने और प्रासंगिकता या नवीनतम के अनुसार क्रमबद्ध करने की सुविधा है, और होम पृष्ठ पर श्रेणी नेविगेशन उपलब्ध है।",
      },
    ],
  },
  id: {
    title: "Pertanyaan yang sering diajukan",
    landingDesc:
      "Cari berita global tentang teknologi, keuangan, dunia, dan olahraga dalam beberapa bahasa di starteday; filter berdasarkan kategori dan urutkan menurut relevansi atau terbaru.",
    items: [
      {
        q: "Bagaimana cara mencari berita di starteday?",
        a: "Ketik kata kunci ke dalam kotak pencarian di bagian atas halaman dan tekan Enter untuk mendapatkan hasil terkait dari sumber multibahasa di seluruh dunia.",
      },
      {
        q: "Bahasa apa saja yang didukung starteday?",
        a: "Kami menyediakan delapan edisi bahasa: Mandarin Sederhana, Inggris, Jepang, Korea, Spanyol, Prancis, Portugis, dan Turki.",
      },
      {
        q: "Dari mana konten pencarian berasal?",
        a: "Kami mengagregasi berbagai sumber global dan menambahkan pilihan editor serta laporan asli, dengan setiap item mencantumkan sumber dan waktu terbitnya.",
      },
      {
        q: "Apakah saya bisa memfilter berdasarkan kategori atau kata kunci?",
        a: "Ya. Halaman hasil memungkinkan Anda mengganti kategori dan mengurutkan menurut relevansi atau terbaru, serta beranda menyediakan navigasi kategori.",
      },
    ],
  },
};
