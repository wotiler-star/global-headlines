// faqQuestions.ts — /[locale]/about 常见问题的 8 语种「问题」文案。
// 答案不在这里：全部复用 citePage.ts 已本地化的 desc / whatBody / creditBody /
// licenseBody / contactBody，避免两套答案口径漂移，也减少翻译量。
// 新增语种时 Record<Locale, ...> 会强制补全（语种清单以 config.ts 为准）。
import type { Locale } from "./config";

export type FaqCopy = {
  title: string;
  questions: [string, string, string, string, string];
};

export const faqCopy: Record<Locale, FaqCopy> = {
  zh: {
    title: "常见问题",
    questions: [
      "starteday 是什么？",
      "文章是翻译或摘要吗？",
      "配图可以转载吗？需要怎么署名？",
      "可以整篇转载或用于商业用途吗？",
      "发现事实错误或署名遗漏怎么联系？",
    ],
  },
  en: {
    title: "Frequently asked questions",
    questions: [
      "What is starteday?",
      "Are the articles translations or summaries?",
      "Can I reuse the images, and how should I credit them?",
      "Can I republish a full article or use it commercially?",
      "How do I report a factual error or a missing credit?",
    ],
  },
  ja: {
    title: "よくある質問",
    questions: [
      "starteday とは何ですか？",
      "記事は翻訳や要約ですか？",
      "画像を転載できますか？クレジットはどう書きますか？",
      "記事全文の転載や商用利用はできますか？",
      "事実誤認やクレジット漏れはどこに報告しますか？",
    ],
  },
  ko: {
    title: "자주 묻는 질문",
    questions: [
      "starteday는 무엇인가요?",
      "기사는 번역이나 요약인가요?",
      "이미지를 다시 쓸 수 있나요? 출처는 어떻게 표기하나요?",
      "기사 전체를 전재하거나 상업적으로 이용할 수 있나요?",
      "사실 오류나 출처 누락은 어디에 알리나요?",
    ],
  },
  es: {
    title: "Preguntas frecuentes",
    questions: [
      "¿Qué es starteday?",
      "¿Los artículos son traducciones o resúmenes?",
      "¿Puedo reutilizar las imágenes y cómo debo citarlas?",
      "¿Puedo republicar un artículo completo o usarlo con fines comerciales?",
      "¿Cómo informo de un error factual o de un crédito omitido?",
    ],
  },
  fr: {
    title: "Questions fréquentes",
    questions: [
      "Qu'est-ce que starteday ?",
      "Les articles sont-ils des traductions ou des résumés ?",
      "Puis-je réutiliser les images et comment les créditer ?",
      "Puis-je republier un article entier ou l'utiliser à des fins commerciales ?",
      "Comment signaler une erreur factuelle ou un crédit manquant ?",
    ],
  },
  pt: {
    title: "Perguntas frequentes",
    questions: [
      "O que é a starteday?",
      "Os artigos são traduções ou resumos?",
      "Posso reutilizar as imagens e como devo creditá-las?",
      "Posso republicar um artigo completo ou usá-lo comercialmente?",
      "Como informo um erro factual ou um crédito omitido?",
    ],
  },
  tr: {
    title: "Sık sorulan sorular",
    questions: [
      "starteday nedir?",
      "Makaleler çeviri mi yoksa özet mi?",
      "Görselleri yeniden kullanabilir miyim ve nasıl atıf yapmalıyım?",
      "Bir makalenin tamamını yeniden yayımlayabilir veya ticari olarak kullanabilir miyim?",
      "Bir olgu hatasını ya da eksik atfı nasıl bildiririm?",
    ],
  },
  ru: {
    title: "Часто задаваемые вопросы",
    questions: [
      "Что такое starteday?",
      "Являются ли статьи переводами или краткими изложениями?",
      "Можно ли использовать изображения повторно и как их указывать?",
      "Можно ли переиздать статью целиком или использовать её в коммерческих целях?",
      "Как сообщить о фактической ошибке или пропущенном указании источника?",
    ],
  },
  ar: {
    title: "الأسئلة الشائعة",
    questions: [
      "ما هو starteday؟",
      "هل المقالات مترجمة أم ملخّصة؟",
      "هل يمكنني إعادة استخدام الصور، وكيف أذكر مصدرها؟",
      "هل يمكنني إعادة نشر مقال كامل أو استخدامه تجارياً؟",
      "كيف أبلغ عن خطأ وقائعي أو عن إغفال ذكر المصدر؟",
    ],
  },
  hi: {
    title: "अक्सर पूछे जाने वाले प्रश्न",
    questions: [
      "starteday क्या है?",
      "क्या लेख अनुवाद या सारांश हैं?",
      "क्या मैं चित्रों का पुनः उपयोग कर सकता हूँ, और उनका श्रेय कैसे दूँ?",
      "क्या मैं पूरा लेख पुनः प्रकाशित कर सकता हूँ या उसका व्यावसायिक उपयोग कर सकता हूँ?",
      "तथ्यात्मक त्रुटि या छूटे हुए श्रेय की सूचना मैं कैसे दूँ?",
    ],
  },
  id: {
    title: "Pertanyaan yang sering diajukan",
    questions: [
      "Apa itu starteday?",
      "Apakah artikelnya terjemahan atau ringkasan?",
      "Bisakah saya menggunakan ulang gambar, dan bagaimana sebaiknya mengutipnya?",
      "Bisakah saya menerbitkan ulang artikel secara penuh atau menggunakannya untuk tujuan komersial?",
      "Bagaimana cara melaporkan kesalahan faktual atau kredit yang terlewat?",
    ],
  },
};
