/**
 * 百炼 DashScope：戏曲绘本生成（仅服务端使用，读取 DASHSCOPE_API_KEY）
 */
import { buildStorybookResponse } from './storybook-mock.mjs'
import {
  loadMudantingFixture,
  isMudantingTestCase,
  getFixturePageImage,
  MUDANTING_TEST_CASE,
} from './storybook-fixture.mjs'

const DEFAULT_CHAT_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_IMAGE_BASE = 'https://dashscope.aliyuncs.com/api/v1'

/** 三页绘本共用的视觉锚点（写入每条 imagePrompt 前缀） */
const DEFAULT_STYLE_ANCHOR =
  '同一套戏曲绘本连续插图，统一画风：中国传统戏曲工笔重彩插画，高清细腻，色彩饱和适中，对比度清晰，' +
  '柔和侧光，无白色雾霭，无过曝泛白，无柔光滤镜，无梦幻虚化，' +
  '人物五官稳定，戏服纹样一致，横构图电影剧照，画面干净无文字无水印'

const IMAGE_NEGATIVE_PROMPT =
  '白色雾霭，白蒙蒙，过曝，泛白，低对比度，灰蒙蒙，柔光滤镜，梦幻虚化，朦胧曝光，' +
  '低分辨率，低画质，肢体畸形，手指畸形，蜡像感，强烈AI感，构图混乱，' +
  '现代服装，牛仔裤，T恤，西方油画，赛博朋克，霓虹灯，英文，乱码，水印，logo，边框，分格漫画'

export function getBailianConfig(env = {}) {
  const apiKey = (env.DASHSCOPE_API_KEY || '').trim()
  const promptExtend = String(env.DASHSCOPE_PROMPT_EXTEND || 'false').toLowerCase() === 'true'
  const useFixtures = String(env.DASHSCOPE_USE_FIXTURES || 'false').toLowerCase() === 'true'
  return {
    apiKey,
    chatModel: env.DASHSCOPE_CHAT_MODEL || 'qwen3.5-flash',
    imageModel: env.DASHSCOPE_IMAGE_MODEL || 'qwen-image-2.0-pro',
    chatBase: (env.DASHSCOPE_CHAT_BASE || DEFAULT_CHAT_BASE).replace(/\/$/, ''),
    imageBase: (env.DASHSCOPE_IMAGE_BASE || DEFAULT_IMAGE_BASE).replace(/\/$/, ''),
    imageSize: env.DASHSCOPE_IMAGE_SIZE || '1472*1104',
    promptExtend,
    styleAnchor: env.DASHSCOPE_STYLE_ANCHOR || DEFAULT_STYLE_ANCHOR,
    useFixtures,
  }
}

function resolvePageImageUrl(page, params, errMsg) {
  const local = getFixturePageImage(page.page)
  if (local) {
    if (errMsg) console.warn(`[bailian] 第 ${page.page} 页出图失败，使用本地测试图：`, errMsg)
    return { imageUrl: local, imageSource: errMsg ? 'fixture-fallback' : 'fixture' }
  }
  if (isMudantingTestCase(params)) {
    console.warn(`[bailian] 第 ${page.page} 页失败且无本地测试图，请运行: npm run fixtures:mudanting`)
  }
  const mock = buildStorybookResponse(params.dialect, params.opera, params.role)
  return {
    imageUrl: mock.pages[page.page - 1]?.imageUrl || 'assets/digital-demo.png',
    imageSource: 'mock-pool',
  }
}

function extractJsonObject(text) {
  if (!text) throw new Error('模型返回为空')
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenced) return JSON.parse(fenced[1].trim())
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1))
    throw new Error('无法解析模型返回的 JSON')
  }
}

async function chatCompletion(config, messages) {
  const url = `${config.chatBase}/chat/completions`
  const bodies = [
    { model: config.chatModel, messages, temperature: 0.65, response_format: { type: 'json_object' } },
    { model: config.chatModel, messages, temperature: 0.65 },
  ]
  let lastError = null
  for (const body of bodies) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      lastError = new Error(data?.error?.message || data?.message || res.statusText)
      continue
    }
    const content = data?.choices?.[0]?.message?.content
    return extractJsonObject(content)
  }
  throw new Error(`文本模型调用失败: ${lastError?.message || 'unknown'}`)
}

function buildFinalImagePrompt(config, meta, page) {
  const anchor = meta.styleAnchor || config.styleAnchor
  const characterLock =
    `角色固定为「${meta.role}」，剧目「${meta.opera}」，保持同一人物脸型、发饰、戏服主色与刺绣样式，仅随场景变换姿态与背景`
  const scene = String(page.imageScene || page.sceneTitle || '').trim()
  const detail = String(page.imagePrompt || '').trim()
  return [anchor, characterLock, `第${page.page}页场景：${scene}`, detail ? `画面细节：${detail}` : '']
    .filter(Boolean)
    .join('。')
    .slice(0, 780)
}

async function generateImage(config, prompt) {
  const url = `${config.imageBase}/services/aigc/multimodal-generation/generation`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.imageModel,
      input: {
        messages: [
          {
            role: 'user',
            content: [{ text: prompt }],
          },
        ],
      },
      parameters: {
        negative_prompt: IMAGE_NEGATIVE_PROMPT,
        prompt_extend: config.promptExtend,
        watermark: false,
        size: config.imageSize,
      },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.message || data?.code || res.statusText
    throw new Error(`图像模型调用失败: ${msg}`)
  }
  const content = data?.output?.choices?.[0]?.message?.content
  let imageUrl = null
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item?.image) {
        imageUrl = item.image
        break
      }
    }
  }
  if (!imageUrl) throw new Error('图像模型未返回图片 URL')
  return imageUrl
}

function buildTextPrompt(dialect, opera, role) {
  return `你是一位戏曲文化与方言专家。请为「AI 戏曲方言绘本」生成连续 3 页内容。

参数：
- 方言：${dialect}
- 剧目：${opera}
- 角色：${role}

要求：
1. 严格输出 JSON 对象，不要 Markdown，不要解释。
2. 顶层字段：styleAnchor（全剧统一画风描述，80-120字，中文）、pages（长度 3）。
3. pages 每项：page(1-3)、sceneTitle、dialogue、classicLyrics、imageScene（本页场景一句话，15-30字）、imagePrompt（仅写本页独有道具/背景/动作，30-60字，不要重复画风描述）。
4. dialogue：用指定方言书写念白，80-160 字，有戏曲韵味。
5. classicLyrics：相关经典唱词（中文，20-60 字）。
6. 三页为同一角色、同一套戏服色系、同一插画风格，仅场景与动作递进；禁止一页写实摄影、一页卡通、一页水墨。
7. imageScene 与 imagePrompt 不要包含「白色雾气」「柔光」「梦幻」「过曝」等描述。

JSON 示例：
{"styleAnchor":"工笔重彩戏曲插画，饱和清晰…","pages":[{"page":1,"sceneTitle":"…","dialogue":"…","classicLyrics":"…","imageScene":"…","imagePrompt":"…"},…]}`
}

function normalizePages(parsed, dialect, opera, role, config) {
  const pages = parsed?.pages
  if (!Array.isArray(pages) || pages.length < 3) {
    throw new Error('模型返回的 pages 数量不足')
  }
  const styleAnchor = String(parsed?.styleAnchor || config.styleAnchor).slice(0, 200)
  return {
    styleAnchor,
    pages: pages.slice(0, 3).map((p, i) => ({
      page: i + 1,
      sceneTitle: String(p.sceneTitle || `第 ${i + 1} 幕`).slice(0, 40),
      dialogue: String(p.dialogue || '').slice(0, 500),
      classicLyrics: String(p.classicLyrics || '').slice(0, 200),
      imageScene: String(p.imageScene || p.sceneTitle || '').slice(0, 80),
      imagePrompt: String(p.imagePrompt || '').slice(0, 200),
      imageUrl: '',
    })),
  }
}

/**
 * @param {Record<string, string>} env process.env / loadEnv
 * @param {{ dialect: string, opera: string, role: string }} params
 */
export async function generateStorybookWithBailian(env, params) {
  const { dialect, opera, role } = params
  const config = getBailianConfig(env)

  if (config.useFixtures && isMudantingTestCase(params)) {
    const fixture = loadMudantingFixture()
    if (fixture) {
      console.log('[storybook] 使用本地测试缓存：粤剧《牡丹亭》')
      return fixture
    }
    console.warn('[storybook] DASHSCOPE_USE_FIXTURES=true 但 manifest 不存在，改走在线生成')
  }

  if (!config.apiKey) {
    const fixture = isMudantingTestCase(params) ? loadMudantingFixture() : null
    return fixture || buildStorybookResponse(dialect, opera, role)
  }

  const parsed = await chatCompletion(config, [
    {
      role: 'system',
      content: '你只输出合法 JSON 对象。三页绘本必须视觉风格统一、角色造型一致。',
    },
    {
      role: 'user',
      content: buildTextPrompt(dialect, opera, role),
    },
  ])

  const { styleAnchor, pages } = normalizePages(parsed, dialect, opera, role, config)
  const meta = { dialect, opera, role, styleAnchor }

  const imageResults = []
  for (const page of pages) {
    try {
      const fullPrompt = buildFinalImagePrompt(config, meta, page)
      const imageUrl = await generateImage(config, fullPrompt)
      imageResults.push({
        ...page,
        imagePrompt: fullPrompt,
        imageUrl,
      })
    } catch (err) {
      const { imageUrl, imageSource } = resolvePageImageUrl(page, params, err.message)
      imageResults.push({ ...page, imageUrl, imageSource })
    }
  }

  return {
    success: true,
    meta: { ...meta, models: { text: config.chatModel, image: config.imageModel } },
    pages: imageResults,
  }
}
