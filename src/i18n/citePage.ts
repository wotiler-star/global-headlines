// citePage.ts — /[locale]/about 「关于与引用」可引用资产页的 8 语种文案。
// 独立模块，不并入庞大的 dictionaries.ts：避免为新增页面改动 8 份大字典、
// 触发所有 Record<Locale> 结构的连锁补全要求。
// 语种清单仍以 config.ts 的 locales 为单一真相源，这里用 Record<Locale, ...> 强制补全。
import type { Locale } from "./config";

export type CiteCopy = {
  title: string;
  desc: string;
  h1: string;
  lead: string;
  sections: {
    whatTitle: string;
    whatBody: string[];
    citeTitle: string;
    citeBody: string;
    citeLabel: string;
    citeBib: string;
    citeShort: string;
    citeCopy: string;
    citeCopied: string;
    creditTitle: string;
    creditBody: string[];
    licenseTitle: string;
    licenseBody: string;
    contactTitle: string;
    contactBody: string;
    factsTitle: string;
  };
  facts: { label: string; value: string }[];
  footerNote: string;
};

const SITE = "starteday.com";

export const citeCopy: Record<Locale, CiteCopy> = {
  zh: {
    title: "关于与引用 · starteday",
    desc: "starteday 的编辑准则、图片许可与署名政策、可复制的规范引用格式。转载、引用或做研究时请按本页格式标注来源。",
    h1: "关于 starteday，以及如何引用我们",
    lead: "starteday 是一份多语种原创资讯刊物。我们每天从科技、商业、科学、文化、消费与健康等领域挑选三个话题，二次创作成带结构和观点的长文，并以八种语言各自独立撰写。本页说明内容是怎么做出来的、图片来自哪里，以及当你想引用时该怎么写。",
    sections: {
      whatTitle: "内容是怎么做出来的",
      whatBody: [
        "每篇文章都有可追溯的原始报道链接，但正文不是翻译或摘要：我们保留事实，重写结构、补上背景与观点，并把数字放回它该在的位置。",
        "八个语种不是同一篇稿子的机翻版本。每个语种都由该语言的写作习惯重新组织一遍，例子、切入角度和句式都不同。",
        "选题避开政治、军事、宗教、种族与儿童相关议题，只做民生领域。稿子发布前会跑敏感词、汉字脏串、变音符号比例与图片重复等自动门禁。",
      ],
      citeTitle: "如何引用我们",
      citeBody: "如果你在报道、论文、简报或课程里引用 starteday，请用下面的格式。可以直接复制；把标题、日期和链接换成对应文章即可。",
      citeLabel: "标准引用格式",
      citeBib: "BibTeX 风格",
      citeShort: "行内简写",
      citeCopy: "复制",
      citeCopied: "已复制",
      creditTitle: "图片从哪来、怎么署名",
      creditBody: [
        "每篇文章配三张真实照片，来自 Wikimedia Commons 等免费图库，许可为 CC BY、CC BY-SA、CC0 或公有领域。不使用 AI 生成图片。",
        "每张图都在文章页底部的「IMAGE CREDITS · 图片来源」区块列出作者、许可与 Commons 原文件页链接，转载时请一并保留。",
        "封面与配图经等比裁剪为 1200×800；原图的高分辨率版本请以 Commons 文件页为准。",
      ],
      licenseTitle: "转载与授权",
      licenseBody: "文字内容欢迎在非商业场景下引用与摘录，请注明来源与原文链接；整篇转载或商业使用请先联系我们。图片各自遵循其原始 CC 许可，不因本站转载而改变。",
      contactTitle: "联系与纠错",
      contactBody: "发现事实错误、署名遗漏或希望授权转载，请通过站内消息或邮件联系编辑部，我们会在核实后更新文章并注明更正。",
      factsTitle: "站点速览",
    },
    facts: [
      { label: "语种", value: "8（中 / 英 / 日 / 韩 / 西 / 法 / 葡 / 土）" },
      { label: "更新", value: "每日 3 个原创话题" },
      { label: "图片", value: "每篇 3 张真实照片 · CC 许可署名" },
      { label: "规范域", value: SITE },
    ],
    footerNote: "本页是可引用的永久入口，链接稳定，可直接指向。",
  },
  en: {
    title: "About & Citation · starteday",
    desc: "Editorial standards, image licensing and attribution policy, and ready-to-copy citation formats for starteday.",
    h1: "About starteday, and how to cite us",
    lead: "starteday is a multilingual original-news publication. Each day we pick three topics from technology, business, science, culture, consumer and health, then write structured long-form articles with a point of view — independently authored in eight languages. This page explains how the work is made, where the images come from, and how to cite it.",
    sections: {
      whatTitle: "How the content is made",
      whatBody: [
        "Every article carries a link to its original reporting, but the text is neither a translation nor a summary: we keep the facts, rebuild the structure, add context and argument, and put the numbers back where they belong.",
        "The eight languages are not machine translations of one draft. Each version is written from scratch in that language's own idiom, with different examples, angles and sentence patterns.",
        "Topics stay within everyday-life domains; political, military, religious, ethnic and child-related subjects are out of scope. Automated gates check sensitive terms, stray CJK characters, diacritic density and duplicate imagery before publication.",
      ],
      citeTitle: "How to cite us",
      citeBody: "If you quote starteday in reporting, a paper, a brief or a course, use the formats below. Copy them directly and swap in the article title, date and URL.",
      citeLabel: "Standard citation",
      citeBib: "BibTeX style",
      citeShort: "Inline short form",
      citeCopy: "Copy",
      citeCopied: "Copied",
      creditTitle: "Where images come from and how to credit them",
      creditBody: [
        "Each article carries three real photographs from Wikimedia Commons and similar free repositories, under CC BY, CC BY-SA, CC0 or public domain. No AI-generated images.",
        "Every image is listed in the 'IMAGE CREDITS' block at the foot of the article with artist, licence and a link to the Commons file page. Please keep that block when republishing.",
        "Covers and figures are centre-cropped to 1200×800; refer to the Commons file page for the full-resolution original.",
      ],
      licenseTitle: "Republishing and licensing",
      licenseBody: "Quotation and excerpting of our text are welcome in non-commercial contexts with attribution and a link to the original; please contact us before republishing in full or for commercial use. Images remain under their own CC licences, unchanged by our use.",
      contactTitle: "Contact and corrections",
      contactBody: "For factual errors, missing credits or licensing enquiries, reach the editors through the site messaging channel or by email. We verify, update the article and note the correction.",
      factsTitle: "At a glance",
    },
    facts: [
      { label: "Languages", value: "8 (zh / en / ja / ko / es / fr / pt / tr)" },
      { label: "Cadence", value: "3 original topics daily" },
      { label: "Imagery", value: "3 real photos per article · CC credited" },
      { label: "Canonical domain", value: SITE },
    ],
    footerNote: "This page is a stable, citable permanent entry point; link to it directly.",
  },
  ja: {
    title: "概要と引用について · starteday",
    desc: "starteday の編集方針、画像ライセンスとクレジット、そのまま使える引用形式。転載・引用・研究利用の際は本ページの書式をご利用ください。",
    h1: "starteday について、そして引用のしかた",
    lead: "starteday は多言語のオリジナル記事を扱うメディアです。毎日、テクノロジー、ビジネス、科学、文化、消費、健康の分野から三つの話題を選び、構成と視点を備えた長文に書き起こし、八つの言語でそれぞれ独立して執筆しています。本ページでは制作方針、画像の出所、引用の書式を説明します。",
    sections: {
      whatTitle: "記事ができるまで",
      whatBody: [
        "各記事には元になった報道へのリンクがありますが、本文は翻訳でも要約でもありません。事実は保ちつつ構成を組み直し、背景と論点を補い、数字を本来あるべき場所に置き直しています。",
        "八言語は一つの原稿の機械翻訳ではありません。それぞれの言語の書き方に合わせて、例、切り口、文の運びまで含めて書き直しています。",
        "題材は暮らしに関わる分野に限り、政治・軍事・宗教・民族・子どもに関わる話題は扱いません。公開前には敏感語、漢字の混入、変音記号の割合、画像の重複を自動で検査しています。",
      ],
      citeTitle: "引用のしかた",
      citeBody: "報道、論文、資料、授業で starteday を引用する場合は下記の書式をご利用ください。そのままコピーし、記事名・日付・URL を差し替えるだけで使えます。",
      citeLabel: "標準の引用形式",
      citeBib: "BibTeX 形式",
      citeShort: "文中の短い形",
      citeCopy: "コピー",
      citeCopied: "コピーしました",
      creditTitle: "画像の出所とクレジット",
      creditBody: [
        "各記事には Wikimedia Commons などのフリー素材から三枚の実写写真を付け、CC BY、CC BY-SA、CC0、パブリックドメインのいずれかで利用しています。AI 生成画像は使いません。",
        "各画像の作者、ライセンス、Commons のファイルページへのリンクは、記事末尾の「IMAGE CREDITS・画像出典」に掲載しています。転載時もそのまま残してください。",
        "表紙と図は 1200×800 に中央トリミングしています。高解像度の原図は Commons のファイルページをご参照ください。",
      ],
      licenseTitle: "転載とライセンス",
      licenseBody: "テキストは非営利での引用・抜粋を歓迎します。出典と元記事へのリンクを明記してください。全文転載や商用利用は事前にご連絡ください。画像はそれぞれ元の CC ライセンスに従い、当サイトの利用により変更されるものではありません。",
      contactTitle: "連絡と訂正",
      contactBody: "事実誤認、クレジット漏れ、転載のご相談はサイト内のメッセージまたはメールで編集部までお知らせください。確認のうえ記事を更新し、訂正を明記します。",
      factsTitle: "サイト概要",
    },
    facts: [
      { label: "言語", value: "8（中・英・日・韓・西・仏・葡・土）" },
      { label: "更新", value: "毎日 3 つのオリジナル話題" },
      { label: "画像", value: "1 記事 3 枚の実写・CC クレジット付き" },
      { label: "正規ドメイン", value: SITE },
    ],
    footerNote: "本ページは引用可能な恒久ページです。直接リンクしてお使いください。",
  },
  ko: {
    title: "소개 및 인용 · starteday",
    desc: "starteday의 편집 기준, 이미지 라이선스와 출처 표기 정책, 바로 복사해 쓸 수 있는 인용 형식.",
    h1: "starteday 소개와 인용 방법",
    lead: "starteday는 다언어 오리지널 기사 매체입니다. 매일 기술·비즈니스·과학·문화·소비·건강 분야에서 세 가지 주제를 골라 구조와 관점을 갖춘 장문으로 다시 쓰고, 여덟 언어로 각각 독립 집필합니다. 이 페이지에서는 제작 방식, 이미지 출처, 인용 형식을 안내합니다.",
    sections: {
      whatTitle: "기사는 어떻게 만들어지나",
      whatBody: [
        "모든 기사에는 원 보도 링크가 있지만 본문은 번역도 요약도 아닙니다. 사실은 유지하되 구조를 다시 짜고 맥락과 논점을 더하며 숫자를 제자리에 돌려놓습니다.",
        "여덟 언어는 한 원고의 기계번역이 아닙니다. 각 언어의 문장 습관에 맞춰 예시, 접근 각도, 문장 흐름까지 새로 씁니다.",
        "주제는 생활 영역으로 한정하며 정치·군사·종교·인종·아동 관련 소재는 다루지 않습니다. 공개 전 민감어, 한자 혼입, 변음 부호 비율, 이미지 중복을 자동 검사합니다.",
      ],
      citeTitle: "인용 방법",
      citeBody: "보도, 논문, 브리프, 수업에서 starteday를 인용할 때 아래 형식을 쓰세요. 그대로 복사한 뒤 기사 제목·날짜·URL만 바꾸면 됩니다.",
      citeLabel: "표준 인용 형식",
      citeBib: "BibTeX 형식",
      citeShort: "본문 약칭",
      citeCopy: "복사",
      citeCopied: "복사됨",
      creditTitle: "이미지 출처와 표기",
      creditBody: [
        "기사마다 Wikimedia Commons 등 무료 자료실의 실사진 세 장을 붙이며, CC BY·CC BY-SA·CC0·퍼블릭 도메인 중 하나입니다. AI 생성 이미지는 쓰지 않습니다.",
        "작가, 라이선스, Commons 원본 페이지 링크는 기사 하단의 'IMAGE CREDITS · 이미지 출처' 블록에 모두 적어 둡니다. 재게재 시에도 그대로 남겨 주세요.",
        "표지와 본문 이미지는 1200×800으로 중앙 크롭했습니다. 고해상도 원본은 Commons 파일 페이지를 참고하세요.",
      ],
      licenseTitle: "전재와 라이선스",
      licenseBody: "텍스트는 비상업적 범위에서 출처와 원문 링크를 밝히는 조건으로 인용·발췌를 환영합니다. 전문 전재나 상업적 이용은 먼저 연락 주세요. 이미지는 각각 원래의 CC 라이선스를 따르며 본 사이트의 사용으로 바뀌지 않습니다.",
      contactTitle: "연락과 정정",
      contactBody: "사실 오류, 누락된 출처, 전재 문의는 사이트 메시지나 이메일로 편집부에 알려 주세요. 확인 후 기사를 갱신하고 정정 내역을 밝힙니다.",
      factsTitle: "한눈에 보기",
    },
    facts: [
      { label: "언어", value: "8개(중·영·일·한·서·불·포·터)" },
      { label: "갱신", value: "매일 오리지널 주제 3개" },
      { label: "이미지", value: "기사당 실사진 3장 · CC 출처 표기" },
      { label: "정규 도메인", value: SITE },
    ],
    footerNote: "이 페이지는 안정적으로 인용할 수 있는 영구 주소입니다. 바로 링크해 주세요.",
  },
  es: {
    title: "Acerca de y citas · starteday",
    desc: "Criterios editoriales, licencias y créditos de imagen, y formatos de cita listos para copiar de starteday.",
    h1: "Sobre starteday y cómo citarnos",
    lead: "starteday es una publicación multilingüe de artículos originales. Cada día elegimos tres temas de tecnología, empresa, ciencia, cultura, consumo y salud, y los reescribimos como reportajes largos con estructura y punto de vista, redactados de forma independiente en ocho idiomas. Esta página explica cómo se hace el trabajo, de dónde vienen las imágenes y cómo citarlo.",
    sections: {
      whatTitle: "Cómo se elabora el contenido",
      whatBody: [
        "Cada artículo enlaza la noticia original, pero el texto no es una traducción ni un resumen: conservamos los hechos, rehacemos la estructura, añadimos contexto y argumento y devolvemos cada cifra a su lugar.",
        "Los ocho idiomas no son traducciones automáticas de un mismo borrador. Cada versión se escribe de nuevo con los giros propios de esa lengua, con ejemplos, enfoques y ritmo distintos.",
        "Los temas se limitan a ámbitos cotidianos; quedan fuera política, ejército, religión, etnia e infancia. Antes de publicar, controles automáticos revisan términos sensibles, caracteres CJK, densidad de tildes e imágenes duplicadas.",
      ],
      citeTitle: "Cómo citarnos",
      citeBody: "Si citas starteday en un reportaje, artículo académico, informe o clase, usa los formatos siguientes. Cópialos tal cual y sustituye título, fecha y URL.",
      citeLabel: "Formato de cita estándar",
      citeBib: "Estilo BibTeX",
      citeShort: "Forma abreviada en el texto",
      citeCopy: "Copiar",
      citeCopied: "Copiado",
      creditTitle: "Origen de las imágenes y créditos",
      creditBody: [
        "Cada artículo lleva tres fotografías reales de Wikimedia Commons y repositorios libres similares, con licencia CC BY, CC BY-SA, CC0 o dominio público. No usamos imágenes generadas por IA.",
        "Todas aparecen en el bloque 'IMAGE CREDITS' al pie del artículo con autor, licencia y enlace a la página del archivo en Commons. Consérvalo si republicas.",
        "Portada y figuras se recortan centradas a 1200×800; para el original en alta resolución consulta la página del archivo en Commons.",
      ],
      licenseTitle: "Reproducción y licencias",
      licenseBody: "La cita y el extracto del texto son bienvenidos en contextos no comerciales con atribución y enlace al original; contacta antes de reproducir un artículo completo o usarlo comercialmente. Las imágenes conservan su licencia CC original, que nuestro uso no modifica.",
      contactTitle: "Contacto y correcciones",
      contactBody: "Para errores de hecho, créditos omitidos o consultas de licencia, escribe a la redacción por el canal de mensajes del sitio o por correo. Verificamos, actualizamos el artículo y dejamos constancia de la corrección.",
      factsTitle: "De un vistazo",
    },
    facts: [
      { label: "Idiomas", value: "8 (zh / en / ja / ko / es / fr / pt / tr)" },
      { label: "Ritmo", value: "3 temas originales al día" },
      { label: "Imágenes", value: "3 fotos reales por artículo · créditos CC" },
      { label: "Dominio canónico", value: SITE },
    ],
    footerNote: "Esta página es una entrada permanente y estable para citar; enlázala directamente.",
  },
  fr: {
    title: "À propos et citations · starteday",
    desc: "Charte éditoriale, licences et crédits des images, et formats de citation prêts à copier pour starteday.",
    h1: "À propos de starteday et comment nous citer",
    lead: "starteday est une publication multilingue d'articles originaux. Chaque jour, nous retenons trois sujets de technologie, d'économie, de science, de culture, de consommation et de santé, puis nous les réécrivons en articles longs, structurés et argumentés, rédigés indépendamment en huit langues. Cette page explique la fabrication, l'origine des images et les règles de citation.",
    sections: {
      whatTitle: "Comment le contenu est fabriqué",
      whatBody: [
        "Chaque article renvoie vers son reportage source, mais le texte n'est ni une traduction ni un résumé : nous gardons les faits, reconstruisons la structure, ajoutons contexte et point de vue, et remettons chaque chiffre à sa place.",
        "Les huit langues ne sont pas les traductions automatiques d'un même brouillon. Chaque version est réécrite selon le génie de sa langue, avec d'autres exemples, d'autres angles et un autre rythme.",
        "Les sujets restent dans les domaines de la vie quotidienne ; politique, armée, religion, ethnicité et enfance sont exclus. Avant publication, des contrôles automatiques vérifient termes sensibles, caractères CJK égarés, densité d'accents et doublons d'images.",
      ],
      citeTitle: "Comment nous citer",
      citeBody: "Si vous citez starteday dans un article, une recherche, une note de synthèse ou un cours, utilisez les formats ci-dessous. Copiez-les tels quels et remplacez titre, date et URL.",
      citeLabel: "Format de citation standard",
      citeBib: "Style BibTeX",
      citeShort: "Forme courte dans le texte",
      citeCopy: "Copier",
      citeCopied: "Copié",
      creditTitle: "Origine des images et crédits",
      creditBody: [
        "Chaque article comporte trois photographies réelles issues de Wikimedia Commons et de banques libres comparables, sous CC BY, CC BY-SA, CC0 ou domaine public. Aucune image générée par IA.",
        "Toutes sont listées dans le bloc « IMAGE CREDITS » en pied d'article avec auteur, licence et lien vers la page du fichier sur Commons. Conservez ce bloc en cas de reprise.",
        "Couverture et figures sont recadrées au centre en 1200×800 ; pour l'original haute définition, consultez la page du fichier sur Commons.",
      ],
      licenseTitle: "Reproduction et licences",
      licenseBody: "La citation et l'extrait du texte sont bienvenus dans un cadre non commercial avec attribution et lien vers l'original ; contactez-nous avant une reproduction intégrale ou un usage commercial. Les images gardent leur licence CC d'origine, que notre usage ne modifie pas.",
      contactTitle: "Contact et corrections",
      contactBody: "Pour une erreur factuelle, un crédit manquant ou une demande de licence, écrivez à la rédaction via la messagerie du site ou par courriel. Nous vérifions, mettons l'article à jour et signalons la correction.",
      factsTitle: "En bref",
    },
    facts: [
      { label: "Langues", value: "8 (zh / en / ja / ko / es / fr / pt / tr)" },
      { label: "Rythme", value: "3 sujets originaux par jour" },
      { label: "Images", value: "3 photos réelles par article · crédits CC" },
      { label: "Domaine canonique", value: SITE },
    ],
    footerNote: "Cette page est un point d'entrée permanent et stable, fait pour être cité ; liez-la directement.",
  },
  pt: {
    title: "Sobre e citação · starteday",
    desc: "Critérios editoriais, licenças e créditos de imagem e formatos de citação prontos a copiar do starteday.",
    h1: "Sobre o starteday e como nos citar",
    lead: "O starteday é uma publicação multilíngue de artigos originais. Todos os dias escolhemos três temas de tecnologia, negócios, ciência, cultura, consumo e saúde e os reescrevemos como reportagens longas, com estrutura e ponto de vista, redigidas de forma independente em oito idiomas. Esta página explica como o trabalho é feito, de onde vêm as imagens e como citar.",
    sections: {
      whatTitle: "Como o conteúdo é produzido",
      whatBody: [
        "Cada artigo traz o link da reportagem original, mas o texto não é tradução nem resumo: mantemos os factos, refazemos a estrutura, acrescentamos contexto e argumento e devolvemos cada número ao seu lugar.",
        "Os oito idiomas não são traduções automáticas de um único rascunho. Cada versão é reescrita segundo o jeito próprio da língua, com exemplos, ângulos e ritmo diferentes.",
        "Os temas ficam nos domínios do quotidiano; política, forças armadas, religião, etnia e infância ficam de fora. Antes de publicar, controlos automáticos verificam termos sensíveis, caracteres CJK, densidade de diacríticos e imagens duplicadas.",
      ],
      citeTitle: "Como nos citar",
      citeBody: "Se citar o starteday numa reportagem, artigo académico, briefing ou aula, use os formatos abaixo. Copie tal como está e substitua título, data e URL.",
      citeLabel: "Formato de citação padrão",
      citeBib: "Estilo BibTeX",
      citeShort: "Forma curta no texto",
      citeCopy: "Copiar",
      citeCopied: "Copiado",
      creditTitle: "Origem das imagens e créditos",
      creditBody: [
        "Cada artigo traz três fotografias reais do Wikimedia Commons e de bancos livres semelhantes, sob CC BY, CC BY-SA, CC0 ou domínio público. Não usamos imagens geradas por IA.",
        "Todas constam do bloco 'IMAGE CREDITS' no rodapé do artigo, com autor, licença e ligação para a página do ficheiro no Commons. Mantenha esse bloco ao republicar.",
        "Capa e figuras são recortadas ao centro em 1200×800; para o original em alta resolução consulte a página do ficheiro no Commons.",
      ],
      licenseTitle: "Reprodução e licenças",
      licenseBody: "A citação e o excerto do texto são bem-vindos em contextos não comerciais, com atribuição e ligação ao original; contacte-nos antes de reproduzir um artigo integral ou usar comercialmente. As imagens mantêm a sua licença CC original, que o nosso uso não altera.",
      contactTitle: "Contacto e correções",
      contactBody: "Para erros factuais, créditos omissos ou pedidos de licença, contacte a redação pela mensagem do site ou por correio. Verificamos, atualizamos o artigo e registamos a correção.",
      factsTitle: "Em resumo",
    },
    facts: [
      { label: "Idiomas", value: "8 (zh / en / ja / ko / es / fr / pt / tr)" },
      { label: "Ritmo", value: "3 temas originais por dia" },
      { label: "Imagens", value: "3 fotos reais por artigo · créditos CC" },
      { label: "Domínio canónico", value: SITE },
    ],
    footerNote: "Esta página é um endereço permanente e estável, feito para ser citado; ligue diretamente a ela.",
  },
  tr: {
    title: "Hakkında ve alıntı · starteday",
    desc: "starteday'ın yayın ilkeleri, görsel lisansları ve atıf politikası, kopyalamaya hazır alıntı biçimleri.",
    h1: "starteday'ı tanıyalım ve nasıl alıntılanır",
    lead: "starteday, çok dilli özgün haber yayınıdır. Her gün teknoloji, iş dünyası, bilim, kültür, tüketim ve sağlık alanlarından üç konu seçip yapı ve görüş taşıyan uzun yazılara dönüştürüyor; sekiz dilde bağımsız olarak kaleme alıyoruz. Bu sayfada üretim sürecini, görsellerin kaynağını ve alıntı biçimlerini anlatıyoruz.",
    sections: {
      whatTitle: "İçerik nasıl hazırlanıyor",
      whatBody: [
        "Her yazıda kaynak habere bağlantı vardır; ancak metin ne çeviri ne özettir. Olguları korur, yapıyı yeniden kurar, bağlam ve görüş ekler, sayıları ait oldukları yere geri koyarız.",
        "Sekiz dil, tek bir taslağın makine çevirisi değildir. Her sürüm o dilin anlatım alışkanlığıyla, farklı örnekler, açılar ve cümle ritmiyle yeniden yazılır.",
        "Konular günlük yaşam alanlarıyla sınırlıdır; siyaset, ordu, din, etnisite ve çocuklarla ilgili başlıklar kapsam dışıdır. Yayımdan önce hassas terimler, karışan Çince karakterler, aksan yoğunluğu ve yinelenen görseller otomatik denetlenir.",
      ],
      citeTitle: "Bizi nasıl alıntılarsınız",
      citeBody: "starteday'ı bir haberde, makalede, brifingde veya derste alıntılarken aşağıdaki biçimleri kullanın. Olduğu gibi kopyalayıp başlık, tarih ve URL'yi değiştirmeniz yeterli.",
      citeLabel: "Standart alıntı biçimi",
      citeBib: "BibTeX biçimi",
      citeShort: "Metin içi kısa biçim",
      citeCopy: "Kopyala",
      citeCopied: "Kopyalandı",
      creditTitle: "Görsellerin kaynağı ve atıf",
      creditBody: [
        "Her yazıda Wikimedia Commons ve benzeri ücretsiz kaynaklardan üç gerçek fotoğraf kullanılır; CC BY, CC BY-SA, CC0 veya kamu malıdır. Yapay zekâ üretimi görsel kullanmayız.",
        "Her görsel, yazının sonundaki 'IMAGE CREDITS' bloğunda sanatçı, lisans ve Commons dosya sayfası bağlantısıyla listelenir. Yeniden yayımlarken bu bloğu koruyun.",
        "Kapak ve şekiller ortadan 1200×800 olarak kırpılır; yüksek çözünürlüklü özgün dosya için Commons sayfasına bakın.",
      ],
      licenseTitle: "Yeniden yayım ve lisanslar",
      licenseBody: "Metinden alıntı ve kesitler, kaynak ve özgün bağlantı belirtilmek koşuluyla ticari olmayan bağlamlarda serbesttir; tam metin veya ticari kullanım için lütfen yazın. Görseller kendi özgün CC lisanslarına tabidir ve bizim kullanımımızla değişmez.",
      contactTitle: "İletişim ve düzeltmeler",
      contactBody: "Olgusal hatalar, eksik atıflar veya lisans soruları için site içi mesaj ya da e-posta ile yazı işlerine ulaşın. Doğrulayıp yazıyı günceller ve düzeltmeyi belirtiriz.",
      factsTitle: "Kısaca",
    },
    facts: [
      { label: "Diller", value: "8 (zh / en / ja / ko / es / fr / pt / tr)" },
      { label: "Tempo", value: "Günde 3 özgün konu" },
      { label: "Görseller", value: "Yazı başına 3 gerçek fotoğraf · CC atıflı" },
      { label: "Kurallı alan adı", value: SITE },
    ],
    footerNote: "Bu sayfa doğrudan bağlantı verilebilecek kalıcı, istikrarlı bir giriş noktasıdır.",
  },
};
