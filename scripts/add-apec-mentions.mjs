// 为 11o 批次全部 8 语种 × 5 篇稿件自然融入「APEC 会议」词汇（纯经贸角度，避开政治）。
// 每篇：摘要末尾追加一句 APEC 引子 + 正文首段末尾追加一句 APEC 背景。幂等：已加过会先移除。
import { readFileSync, writeFileSync } from "node:fs";

const LOCS = ["", "-en", "-ja", "-ko", "-es", "-fr", "-pt", "-tr"];
const SLUGS = ["chip-voyage", "container-cargo", "crossborder-decade", "smart-port", "oem-to-brand"];

// 每语种每主题：[摘要追加句, 正文首段追加句] —— 均以 APEC 为经济合作背景，无政治人物/敏感词。
const TEXT = {
  "": {
    "chip-voyage": ["今年 APEC 会议把亚太供应链的韧性摆上台面，而一颗芯片的旅行正是这套韧性最生动的注脚。", "在 APEC 会议关注区域产业链互联的当下，这颗芯片的一日游，反而把供应链的复杂与精妙讲得明明白白。"],
    "container-cargo": ["借着 APEC 会议聚焦亚太互联互通的势头，这只集装箱里装的东西，比任何议程都更能说明区域分工。", "在 APEC 会议谈论贸易便利化的同时，真实世界里的集装箱早就替我们把全球分工跑成了日常。"],
    "crossborder-decade": ["APEC 会议热议数字贸易的这几年，正是跨境电商从行李箱进化到智能体的十年。", "当 APEC 会议把数字经济写进合作议程，跨境创业者们早已用一句话指挥五个 AI 把货卖到了地球另一端。"],
    "smart-port": ["APEC 会议期间，亚太物流的现代化成了焦点，而这些无人码头早已悄悄给出了答案。", "在 APEC 会议关注互联互通的背景下，码头上的无人集卡正把「效率」两个字写到极致。"],
    "oem-to-brand": ["APEC 会议讨论区域产业升级时，电饭煲和香水瓶的转型故事，比任何报告都更接地气。", "借着 APEC 会议推动区域价值链升级的东风，越来越多工厂开始把名字写在自己的产品上。"],
  },
  "-en": {
    "chip-voyage": ["As this year's APEC meeting puts regional supply-chain resilience on the table, this chip's little journey is the most vivid footnote to that conversation.", "With the APEC meeting shining a light on how Asia-Pacific industries connect, this chip's one-day tour explains the complexity of supply chains better than any chart could."],
    "container-cargo": ["Against the backdrop of the APEC meeting's focus on connectivity, this single container says more about regional division of labor than any agenda item.", "While the APEC meeting talks about trade facilitation, real-world containers have already turned global division of labor into a daily routine."],
    "crossborder-decade": ["The years when the APEC meeting debated digital trade were exactly the decade cross-border commerce evolved from suitcases to smart agents.", "As the APEC meeting writes the digital economy into its cooperation agenda, entrepreneurs are already commanding five AI helpers with a single sentence to sell goods across the globe."],
    "smart-port": ["During the APEC meeting, modernizing Asia-Pacific logistics became a focal point — and these driverless terminals had the answer all along.", "With the APEC meeting highlighting connectivity, driverless trucks at the docks are pushing the word 'efficiency' to its limit."],
    "oem-to-brand": ["When the APEC meeting discussed regional industrial upgrading, the transformation of rice cookers and perfume bottles told the story better than any report.", "Riding the APEC meeting's push for regional value-chain upgrades, more factories are finally putting their own names on their products."],
  },
  "-ja": {
    "chip-voyage": ["今年の APEC 会議でアジア太平洋のサプライチェーン強靭化が議論される中、このチップの旅はその最も生々な注釈だ。", "APEC 会議が地域産業のつながりに焦点を当てる今、チップの一日旅行はサプライチェーンの複雑さを雄弁に物語っている。"],
    "container-cargo": ["APEC 会議が接続性に注目する流れの中、このコンテナ一つが地域分業を最もよく物語っている。", "APEC 会議が貿易円滑化を語る一方で、現実のコンテナは世界中の分業をすでに日常にしている。"],
    "crossborder-decade": ["APEC 会議がデジタル貿易を議論してきた这些年こそ、越境ECがスーツケースからAIへ進化した10年だった。", "APEC 会議がデジタル経済を協力議題に載せる中、起業家たちは一文で5つのAIに地球の裏まで商品を売らせている。"],
    "smart-port": ["APEC 会議でアジア太平洋の物流-modern化が焦点になったとき、無人ターミナルはすでに答えを出していた。", "APEC 会議が相互接続を強調する背景で、埠頭の無人トラックが「効率」という言葉を極めている。"],
    "oem-to-brand": ["APEC 会議が地域の産業高度化を論じるとき、炊飯器と香水瓶の転換物語はどんな報告書より身近だ。", "APEC 会議の地域バリューチェーン高度化の追い風に乗り、自社名を製品に刻む工場が増えている。"],
  },
  "-ko": {
    "chip-voyage": ["올해 APEC 회의가 아시아태평양 공급망 회복력을 의제에 올린 가운데, 이 칩의 여정은 그 가장 생생한 주석이다.", "APEC 회의가 지역 산업 연결에 주목하는 지금, 칩의 하루 나들이는 공급망의 복잡성을 가장 잘 설명한다."],
    "container-cargo": ["APEC 회의가 연결성을 강조하는 흐름 속에서, 이 컨테이너 하나가 지역 분업을 가장 잘 말해준다.", "APEC 회의가 무역 원활화를 논의하는 동시에, 실제 컨테이너는 이미 세계적 분업을 일상으로 만들었다."],
    "crossborder-decade": ["APEC 회의가 디지털 무역을 논의해온 바로 그 시기가, 국경없는 커머스가 캐리어에서 AI로 진화한 10년이었다.", "APEC 회의가 디지털 경제를 협력 의제에 올릴 때, 창업자들은 한 문장으로 다섯 AI에게 지구 반대편까지 상품을 팔게 한다."],
    "smart-port": ["APEC 회의에서 아시아태평양 물류 현대화가 초점이 되었을 때, 무인 터미널은 이미 답을 내놓고 있었다.", "APEC 회의가 상호 연결을 강조하는 가운데, 부두의 무인 트럭이 '효율'이라는 단어를 극한까지 밀어붙이고 있다."],
    "oem-to-brand": ["APEC 회의가 지역 산업 고도화를 논할 때, 밥솥과 향수병의 변신 이야기는 어떤 보고서보다 친근하다.", "APEC 회의의 지역 가치사슬 고도화 바람을 타고, 자기 이름을 제품에 새기는 공장이 늘고 있다."],
  },
  "-es": {
    "chip-voyage": ["Con la reunión de APEC poniendo sobre la mesa la resiliencia de las cadenas de suministro regionales, el viaje de este chip es la nota más viva de ese debate.", "Mientras la reunión de APEC ilumina cómo se conectan las industrias de Asia-Pacífico, el tour de un día de este chip explica la complejidad de las cadenas de suministro mejor que cualquier gráfico."],
    "container-cargo": ["En el contexto del enfoque de la reunión de APEC en la conectividad, este contenedor dice más sobre la división regional del trabajo que cualquier punto del orden del día.", "Mientras la reunión de APEC habla de facilitación comercial, los contenedores reales ya han convertido la división global del trabajo en rutina diaria."],
    "crossborder-decade": ["Los años en que la reunión de APEC debatía el comercio digital fueron justamente la década en que el comercio transfronterizo pasó de las maletas a los agentes inteligentes.", "Cuando la reunión de APEC escribe la economía digital en su agenda de cooperación, los emprendedores ya dirigen cinco asistentes de IA con una sola frase para vender al otro lado del mundo."],
    "smart-port": ["Durante la reunión de APEC, modernizar la logística de Asia-Pacífico se volvió un foco, y estas terminales autónomas ya tenían la respuesta.", "Con la reunión de APEC destacando la interconectividad, los camiones sin conductor en los muelles llevan la palabra 'eficiencia' al límite."],
    "oem-to-brand": ["Cuando la reunión de APEC discutía la actualización industrial regional, la transformación de ollas arroceras y frascos de perfume contaba la historia mejor que cualquier informe.", "Impulsadas por el empuje de la reunión de APEC hacia cadenas de valor regionales, más fábricas estampan su propio nombre en sus productos."],
  },
  "-fr": {
    "chip-voyage": ["Alors que la réunion de l'APEC met la résilience des chaînes d'approvisionnement régionales sur la table, le voyage de cette puce en est la note la plus vivante.", "Tandis que la réunion de l'APEC éclaire les liens entre les industries d'Asie-Pacifique, l'excursion d'une journée de cette puce explique la complexité des chaînes d'approvisionnement mieux que n'importe quel graphique."],
    "container-cargo": ["Dans le sillage de l'accent mis par la réunion de l'APEC sur la connectivité, ce conteneur en dit plus sur la division régionale du travail que n'importe quel point de l'ordre du jour.", "Pendant que la réunion de l'APEC parle de facilitation des échanges, les conteneurs réels ont déjà fait de la division mondiale du travail une routine quotidienne."],
    "crossborder-decade": ["Les années où la réunion de l'APEC débattait du commerce numérique sont précisément celles où le commerce transfrontalier est passé des valises aux agents intelligents.", "Quand la réunion de l'APEC inscrit l'économie numérique dans son agenda de coopération, les entrepreneurs dirigent déjà cinq assistants IA d'une seule phrase pour vendre à l'autre bout du monde."],
    "smart-port": ["Lors de la réunion de l'APEC, la modernisation de la logistique d'Asie-Pacifique est devenue un point focal — et ces terminaux autonomes avaient la réponse depuis longtemps.", "Avec la réunion de l'APEC qui met en avant l'interconnectivité, les camions sans conducteur des quais poussent le mot « efficacité » à son comble."],
    "oem-to-brand": ["Quand la réunion de l'APEC discutait de la montée en gamme industrielle régionale, la transformation des cuiseurs de riz et des flacons de parfum racontait l'histoire mieux que n'importe quel rapport.", "Portées par l'élan de la réunion de l'APEC vers des chaînes de valeur régionales, de plus en plus d'usines inscrivent leur nom sur leurs produits."],
  },
  "-pt": {
    "chip-voyage": ["Com a reunião da APEC colocando a resiliência das cadeias de suprimento regionais na mesa, a viagem deste chip é a nota mais viva desse debate.", "Enquanto a reunião da APEC ilumina como as indústrias da Ásia-Pacífico se conectam, o passeio de um dia deste chip explica a complexidade das cadeias de suprimento melhor que qualquer gráfico."],
    "container-cargo": ["No contexto do foco da reunião da APEC na conectividade, este contêiner diz mais sobre a divisão regional do trabalho do que qualquer ponto da pauta.", "Enquanto a reunião da APEC fala em facilitação comercial, os contêineres reais já transformaram a divisão global do trabalho em rotina diária."],
    "crossborder-decade": ["Os anos em que a reunião da APEC debatia o comércio digital foram exatamente a década em que o comércio transfronteiriço passou das malas para os agentes inteligentes.", "Quando a reunião da APEC inscreve a economia digital em sua agenda de cooperação, empreendedores já comandam cinco assistentes de IA com uma única frase para vender do outro lado do mundo."],
    "smart-port": ["Durante a reunião da APEC, modernizar a logística da Ásia-Pacífico virou foco — e esses terminais autônomos já tinham a resposta.", "Com a reunião da APEC destacando a interconectividade, os caminhões sem motorista nos cais levam a palavra 'eficiência' ao limite."],
    "oem-to-brand": ["Quando a reunião da APEC discutia a atualização industrial regional, a transformação de panelas de arroz e frascos de perfume contava a história melhor que qualquer relatório.", "Impulsionadas pelo empurrão da reunião da APEC rumo a cadeias de valor regionais, mais fábricas estão estampando seu próprio nome nos produtos."],
  },
  "-tr": {
    "chip-voyage": ["APEC toplantısı bu yıl bölgesel tedarik zinciri dayanıklılığını gündeme getirirken, bu çipin yolculuğu o tartışmanın en canlı dipnotu oldu.", "APEC toplantısı Asya-Pasifik endüstrilerinin nasıl bağlandığına ışık tutarken, bu çipin bir günlük gezisi tedarik zincirlerinin karmaşıklığını herhangi bir grafikten daha iyi anlatıyor."],
    "container-cargo": ["APEC toplantısının bağlantıya odaklanması arka planında, bu tek konteyner bölgesel iş bölümünü herhangi bir gündem maddesinden daha iyi anlatıyor.", "APEC toplantısı ticaretin kolaylaştırılmasından söz ederken, gerçek konteynerler küresel iş bölümünü çoktan günlük rutine dönüştürdü."],
    "crossborder-decade": ["APEC toplantısının dijital ticareti tartıştığı yıllar, sınır ötesi ticaretin bavullardan akıllı ajanlara evrildiği on yılın ta kendisiydi.", "APEC toplantısı dijital ekonomiyi işbirliği gündemine yazarken, girişimciler tek bir cümleyle beş yapay zeka yardımcısını dünyanın öbür ucuna mal satmak için yönlendiriyor."],
    "smart-port": ["APEC toplantısında Asya-Pasifik lojistiğinin modernleşmesi odak noktası olurken, bu insansız terminaller cevabı çoktan vermişti.", "APEC toplantısı birbirine bağlılığı vurgularken, rıhtımdaki sürücüsüz kamyonlar 'verimlilik' kelimesini son noktasına taşıyor."],
    "oem-to-brand": ["APEC toplantısı bölgesel sanayi yükselişini tartışırken, pirinç pişirici ve parfüm şişesinin dönüşüm hikayesi herhangi bir rapordan daha yakın.", "APEC toplantısının bölgesel değer zinciri yükselişi rüzgarıyla, giderek daha fazla fabrika adını ürününün üzerine yazıyor."],
  },
};

let changed = 0;
for (const loc of LOCS) {
  const file = `data/original/premium${loc}-2026-11o.json`;
  const arr = JSON.parse(readFileSync(file, "utf8"));
  for (let i = 0; i < arr.length; i++) {
    const key = SLUGS[i];
    const [sumSent, bodySent] = TEXT[loc][key];
    // 幂等：移除旧的 APEC 追加句（以已知句首识别）
    let summary = arr[i].summary;
    let body0 = arr[i].body[0];
    // 若已含该 APEC 句则跳过追加（用句末标点+APEC 判断）
    if (!summary.includes("APEC")) {
      summary = summary + (loc === "" ? "" : " ") + sumSent;
    }
    if (!body0.includes("APEC")) {
      body0 = body0 + (loc === "" ? "" : " ") + bodySent;
    }
    if (summary !== arr[i].summary || body0 !== arr[i].body[0]) {
      arr[i].summary = summary;
      arr[i].body[0] = body0;
      changed++;
    }
  }
  writeFileSync(file, JSON.stringify(arr, null, 2), "utf8");
}
console.log(`已为 ${changed} 篇稿件融入 APEC 词汇（8 语种 × 5 篇）`);
