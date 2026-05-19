/**
 * 辨音解意 · 关卡数据（/video-learn）
 * 选项仅显示「选项 A/B/C」，不在标签或题干中提示答案类型
 */
(function (global) {
  const BASE = "./video-learn/guangdongyueju";

  function yuejuAudio(n) {
    return `${BASE}/guangdongyueju-${String(n).padStart(3, "0")}.m4a`;
  }

  const YUEJU_QUESTIONS = [
    {
      id: "yq-001",
      wallId: "yueju",
      genreName: "粤剧",
      dialectName: "粤语",
      playTitle: "《昭君出塞》",
      question: "聆听唱段：下列哪一句，最符合你实际听到的唱词？",
      audioUrl: yuejuAudio(1),
      options: {
        A: "春光满眼万花妍，三春景致何曾见。",
        B: "此身入朔方，悲声低诉汉女念汉邦。",
        C: "拾钗人从绝赛归，坠钗人已移情去，归来空抱恨。"
      },
      answer: "B",
      explain: {
        original: "此身入朔方 悲声低诉汉女念汉邦",
        meaning: "此身已入北方边疆，低声悲诉，汉家女子仍心念汉朝故土。",
        source: "粤剧《昭君出塞》经典选段",
        genre: "粤剧常演历史悲歌，唱腔兼叙事与抒情，文辞多保留古汉语词法。",
        dialect: "粤语演唱保留古入声与连读，句读处拖腔悠长，悲怆感强。",
        etymology: "「朔方」指北方边疆；「汉邦」即汉朝故土，戏曲中借代家国。",
        culture: "王昭君和亲故事在粤剧中重在“念汉邦”的身份认同，而非仅述个人哀怨。"
      }
    },
    {
      id: "yq-002",
      wallId: "yueju",
      genreName: "粤剧",
      dialectName: "粤语",
      playTitle: "《牡丹亭》",
      hidePlayTitle: true,
      hideOptionsUntilListen: true,
      question: "先听唱段：从词意与情绪判断，它最可能出自哪一出戏？",
      audioUrl: yuejuAudio(2),
      options: {
        A: "《昭君出塞》",
        B: "《牡丹亭》",
        C: "《帝女花》"
      },
      answer: "B",
      explain: {
        original: "春光满眼万花妍 三春景致何曾见",
        meaning: "满眼春光繁花盛开，这般美好的暮春景致我何曾见过。",
        source: "粤剧《牡丹亭》游园惊梦相关唱段",
        genre: "粤剧吸收昆曲名剧，《牡丹亭》词境婉约，多写春景与情思初萌。",
        dialect: "粤语行腔在“三春”“何曾”等处加重语气，突出惊叹与沉醉。",
        etymology: "「三春」指春季三月或整个春季；「何曾见」为古典反问句式。",
        culture: "春景词在戏曲中常象征青春觉醒，连接杜丽娘对自由爱情的向往。"
      }
    },
    {
      id: "yq-003",
      wallId: "yueju",
      genreName: "粤剧",
      dialectName: "粤语",
      playTitle: "《帝女花》",
      question: "聆听唱段：下列哪一种说法，最符合词中所写的情境与情绪？",
      audioUrl: yuejuAudio(3),
      options: {
        A: "落花遮月，在凤台设祭，帝女花含泪献香，气氛哀婉肃穆。",
        B: "身在塞外朔方，低声诉说汉女心念故国，悲怆缠绵。",
        C: "暮春繁花满眼，惊叹春色之盛，似有初见心动、流连园景之意。"
      },
      answer: "A",
      explain: {
        original: "落花满天蔽月光 借一杯附荐凤台上 帝女花带泪上香",
        meaning: "落花漫天遮住月光，在凤台借酒祭奠，帝女花含着泪献上香火。",
        source: "粤剧《帝女花·香夭》等经典段落",
        genre: "《帝女花》为粤剧代表性悲剧，词藻绵密，意象哀艳。",
        dialect: "粤语咬字在“落花”“附荐”等词上顿挫分明，烘托祭奠氛围。",
        etymology: "「附荐」即附带祭品致祭；「帝女花」为剧中公主象征性称谓。",
        culture: "落花、月光、香火并置，构成传统祭奠场景的戏曲化表达。"
      }
    },
    {
      id: "yq-004",
      wallId: "yueju",
      genreName: "粤剧",
      dialectName: "粤语",
      playTitle: "《紫钗记》",
      question: "聆听唱段：结合词面与唱腔，下列哪一种解读最贴切？",
      audioUrl: yuejuAudio(4),
      options: {
        A: "写和亲女子身在边塞，仍念念不忘汉家故土，以悲声抒怀。",
        B: "以落花、月光、凤台祭奠为景，写公主殉情前凄艳哀绝的心境。",
        C: "写故人远行归来，对方却已变心，重逢成恨，怨愤难以消解。"
      },
      answer: "C",
      explain: {
        original: "拾钗人从绝赛归 坠钗人已移情去 归来空抱恨 此恨永难翻",
        meaning: "拾钗的人从远方归来，赠钗的人却已变心，归来徒抱怨恨，此恨难以消解。",
        source: "粤剧《紫钗记》根据唐传奇《霍小玉传》改编",
        genre: "粤剧擅演才子佳人悲剧，词章多借物（紫钗）贯穿情缘。",
        dialect: "粤语演唱在“空抱恨”“永难翻”处拉腔，强化决绝与沉痛。",
        etymology: "「绝赛」作极远之路解；「翻」在此为翻转、化解之意。",
        culture: "紫钗作为信物连接二人情感，变心后形成戏曲中经典的“恨难翻”主题。"
      }
    }
  ];

  global.BIANYIN_WALL = [
    { id: "yueju", genreName: "粤剧", icon: "🎵", dialectName: "粤语", questionIds: ["yq-001", "yq-002", "yq-003", "yq-004"] },
    { id: "minnan", genreName: "闽南戏", icon: "🎭", dialectName: "闽南语", placeholder: true },
    { id: "yueju-wu", genreName: "越剧", icon: "🪭", dialectName: "吴语", placeholder: true },
    { id: "luntan", genreName: "乱弹", icon: "🥁", dialectName: "台州官话", placeholder: true },
    { id: "nanxi", genreName: "南戏", icon: "🏮", dialectName: "温州南戏", placeholder: true },
    { id: "kunqu", genreName: "昆曲", icon: "🎐", dialectName: "中州韵系", placeholder: true }
  ];

  global.BIANYIN_QUESTIONS = YUEJU_QUESTIONS;
})(typeof window !== "undefined" ? window : globalThis);
