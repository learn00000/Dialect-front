/**
 * 断章寻韵 · 戏曲拼接关卡数据（对应 /video-stitch 目录）
 */
(function (global) {
  const BASE = "./video-stitch";

  function wenzhouAudio(n) {
    const pad = String(n).padStart(3, "0");
    if (n === 1) return `${BASE}/wenzhou/wenzhou-001.m4a`;
    return `${BASE}/wenzhou/wenzhou${pad}.m4a`;
  }

  function taizhouAudio(n) {
    return `${BASE}/taizhou/taizhou-${String(n).padStart(3, "0")}.m4a`;
  }

  function minnanAudio(n) {
    return `${BASE}/minnan/minnan${String(n).padStart(3, "0")}.m4a`;
  }

  function makeSegments(prefix, lines, audioFn) {
    return lines.map((text, i) => ({
      id: `${prefix}-${String(i + 1).padStart(3, "0")}`,
      order: i + 1,
      text,
      audioUrl: audioFn(i + 1)
    }));
  }

  const wenzhouLines = [
    "誓言犹在心已变",
    "可叹我看戏人变成戏中人",
    "只道是雪压霜欺竹节劲",
    "谁知道随波逐流柳絮轻",
    "只道是紫燕恋旧栖故巢",
    "谁知你黄鹂又拣新枝鸣"
  ];

  const taizhouLines = [
    "谁料想热望未遂身先殒",
    "郎失知己妾离君",
    "我不怨此生多乖运",
    "不怨失足落泥泞",
    "不怨宋江刀刎颈",
    "只怨孽债未遂清",
    "你不该忘却旧时景",
    "负我殷殷一片情",
    "今夜魂游来索命"
  ];

  const minnanLines = [
    "我身骑白马过三关",
    "改换素衣唷归中原",
    "放下西凉无人管",
    "思思念念喔王宝钏"
  ];

  global.DUANZHANG_LIBRARY = [
    {
      id: "ouju-wenzhou",
      name: "《高机与吴三春》",
      dialect: "温州话（瓯剧）",
      genre: "瓯剧 · 温州南戏",
      intro:
        "瓯剧经典悲剧选段，女主角吴三春面对情郎变心时的内心独白，以今昔对比抒发痴情错付的悔恨与怨怼。",
      fullReference: wenzhouLines.join("，") + "。",
      fullVideoUrl: `${BASE}/wenzhou/wenzhou-all.mp4`,
      wiki: {
        title: "戏曲文化百科介绍 · 瓯剧（温州南戏）《高机与吴三春》选段",
        background:
          "出自瓯剧经典悲剧《高机与吴三春》，为女主角吴三春面对情郎变心时的核心内心独白，以强烈的今昔对比抒发痴情错付的悔恨与怨怼，是南戏体系中「痴心女子负心汉」主题的代表性抒情段落。",
        dialectFeature:
          "以温州吴语演唱，咬字软糯细腻，保留了吴语连读的音韵韵味，句尾拖腔兼具瓯剧「乱弹腔」的婉转与南戏古调的苍劲，乡音辨识度高，情绪张力极强。",
        source:
          "瓯剧传统「慢板乱弹」经典段式，是《高机与吴三春》中传唱度最高的核心唱段之一，广泛收录于地方戏改编唱本与教学示范中。",
        history:
          "瓯剧（温州乱弹）是南戏的重要活态传承剧种，发源于浙江温州，声腔体系融合了南戏古调、乱弹腔与昆曲元素，兼具民间口传与文人创作传统，是浙南地区最具代表性的地方戏曲之一。",
        glossary:
          "「看戏人变成戏中人」指本以为是他人故事，最终却亲历了相似的悲剧；「雪压霜欺竹节劲」以竹喻当初坚贞的誓言；「随波逐流柳絮轻」「黄鹂拣新枝」则用柳絮、黄鹂比喻情郎的变心与薄情。"
      },
      segments: makeSegments("wz", wenzhouLines, wenzhouAudio)
    },
    {
      id: "luntan-taizhou",
      name: "《活捉三郎》",
      dialect: "台州官话",
      genre: "台州乱弹",
      intro:
        "台州乱弹经典折子戏选段，阎惜娇鬼魂向张文远索命时的独白，层层递进抒发对负心之人的怨怼与不甘。",
      fullReference: taizhouLines.join("，") + "。",
      fullVideoUrl: `${BASE}/taizhou/taizhou-all.mp4`,
      wiki: {
        title: "戏曲文化百科介绍 · 台州乱弹《活捉三郎》选段",
        background:
          "出自台州乱弹经典折子戏《活捉三郎》，为阎惜娇鬼魂向张文远索命时的核心独白唱段，层层递进地抒发了对情人负心的怨怼、对自身悲剧的不甘，是传统戏曲「鬼戏」题材中，兼具幽怨与刚烈气质的代表性段落。",
        dialectFeature:
          "以台州官话为演唱基础，咬字硬朗却带着缠绵尾韵，既保留了乱弹腔的刚劲顿挫，又融入了台州方言特有的连读与拖腔韵味，地方辨识度极强，将角色的怨念与痴情演绎得极具张力。",
        source:
          "台州乱弹传统保留剧目核心段式，属乱弹腔抒情慢板，是地方戏教学与舞台演出中，展现台州乱弹文戏唱功的代表性选段。",
        history:
          "台州乱弹为国家级非物质文化遗产，是台州本土唯一的地方剧种，声腔体系融合乱弹、昆曲、高腔等多种元素，兼具山野质朴的气质与文戏细腻的抒情风格，是浙南地区极具特色的戏曲流派。",
        glossary:
          "「热望未遂身先殒」指阎惜娇未盼到与情人相守，便已丧命；「乖运」「落泥泞」代指她坎坷不幸的命运；「刀刎颈」点明她死于宋江刀下；「孽债未遂清」指她与张文远的情缘未了、怨念难消；「魂游来索命」则点出鬼魂前来向负心人索债的剧情核心。"
      },
      segments: makeSegments("tz", taizhouLines, taizhouAudio)
    },
    {
      id: "gezaixi-minnan",
      name: "《我身骑白马》",
      dialect: "闽南语",
      genre: "歌仔戏（芗剧）",
      intro:
        "薛平贵告别西凉、奔赴长安与王宝钏团聚时的核心唱段，借赶路独白直抒归乡心切与对故人的思念。",
      fullReference: minnanLines.join("，") + "。",
      fullVideoUrl: `${BASE}/minnan/minnan-all.mp4`,
      wiki: {
        title: "戏曲文化百科介绍 · 歌仔戏《我身骑白马》选段",
        background:
          "出自传统经典《薛平贵与王宝钏》，为薛平贵告别西凉、奔赴长安与王宝钏团聚时的核心唱段，借赶路独白直抒归乡心切与对故人的思念，是戏曲中「归乡」主题的标志性段落。",
        dialectFeature:
          "以闽南语演唱，保留古语词与连读韵味，句尾拖腔舒展，兼具赶路的铿锵节奏与抒情唱腔的婉转韵律，乡音辨识度极高。",
        source:
          "歌仔戏传统「七字调」经典段式，广泛收录于地方戏改编唱本与教学示例中，是闽南语戏曲最具代表性的普及型选段。",
        history:
          "歌仔戏（芗剧）发源于闽南地区，兼具民间口传与文人创作传统，《薛平贵与王宝钏》作为其核心保留剧目，传唱度极高，是两岸闽南文化交流的重要载体。",
        glossary:
          "「过三关」指薛平贵跨越西凉与中原间的险阻关隘；「西凉」指他滞留的西凉国；「王宝钏」是他发妻，象征着归乡的执念与牵挂。"
      },
      segments: makeSegments("mn", minnanLines, minnanAudio)
    }
  ];
})(typeof window !== "undefined" ? window : globalThis);
