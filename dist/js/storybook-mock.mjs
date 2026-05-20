/** 与 storybook-data.js 保持一致的 Mock（供 Vite dev server 使用） */
const IMAGE_POOL = [
  'assets/方音戏韵界面设计方案.png',
  'assets/digital-demo.png',
  'assets/avatar-demo.png'
]

const SCENE_PRESETS = {
  '粤剧《牡丹亭》': [
    { sceneTitle: '游园惊梦', classicLyrics: '原来姹紫嫣红开遍，似这般都付与断井颓垣。' },
    { sceneTitle: '寻梦', classicLyrics: '这般花花草草由人恋，生生死死随人愿。' },
    { sceneTitle: '离魂', classicLyrics: '恨匆匆，愁匆匆，人间何处似天宫。' }
  ],
  '粤剧《帝女花》': [
    { sceneTitle: '香劫', classicLyrics: '落花满天蔽月光，借一杯附荐凤台上。' },
    { sceneTitle: '妆台', classicLyrics: '妆台明镜照双影，愿作鸳鸯不羡仙。' },
    { sceneTitle: '殉爱', classicLyrics: '地老天荒情未了，碧落黄泉共此心。' }
  ],
  '越剧《梁祝》': [
    { sceneTitle: '草桥结拜', classicLyrics: '同窗共读三载，情深意长。' },
    { sceneTitle: '十八相送', classicLyrics: '送到长亭外，古道边，芳草碧连天。' },
    { sceneTitle: '化蝶', classicLyrics: '梁祝化蝶双飞，千古绝唱。' }
  ],
  '昆曲《长生殿》': [
    { sceneTitle: '定情', classicLyrics: '在天愿作比翼鸟，在地愿为连理枝。' },
    { sceneTitle: '霓裳羽衣', classicLyrics: '渔阳鼙鼓动地来，惊破霓裳羽衣曲。' },
    { sceneTitle: '马嵬诀别', classicLyrics: '天长地久有时尽，此恨绵绵无绝期。' }
  ]
}

const DIALECT_SAMPLE = {
  粤语: (role, scene) => `【${role}·${scene}】呀，呢一段戏文我用粤语轻轻念来，请你细听乡音里的情意。`,
  闽南语: (role, scene) => `【${role}·${scene}】阮用闽南语来讲，每一句拢是戏台顶底人情味。`,
  温州话: (role, scene) => `【${role}·${scene}】我用地道温州话唱念，腔调里藏着瓯越古意。`,
  台州话: (role, scene) => `【${role}·${scene}】台州方言念白，把乱弹高腔的韵味慢慢铺开。`
}

export function buildStorybookResponse(dialect, opera, role) {
  const scenes = SCENE_PRESETS[opera] || SCENE_PRESETS['粤剧《牡丹亭》']
  const dialectFn = DIALECT_SAMPLE[dialect] || DIALECT_SAMPLE['粤语']
  const pages = scenes.map((scene, i) => ({
    page: i + 1,
    sceneTitle: scene.sceneTitle,
    dialogue: dialectFn(role, scene.sceneTitle),
    classicLyrics: scene.classicLyrics,
    imagePrompt: `国风戏曲剧照，${opera}，${role}，场景「${scene.sceneTitle}」，${dialect}方言氛围`,
    imageUrl: IMAGE_POOL[i % IMAGE_POOL.length]
  }))
  return { success: true, meta: { dialect, opera, role }, pages }
}
