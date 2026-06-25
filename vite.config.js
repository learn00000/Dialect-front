import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { cpSync, createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildStorybookResponse } from './js/storybook-mock.mjs'
import { generateStorybookWithBailian, getBailianConfig } from './js/storybook-bailian.mjs'
import {
  deleteUploadedContribution,
  handleContributionCreate,
  handleLegacyMapUpload,
  listBackendMapPoints,
  serveMapUploadAudio
} from './js/map-mock-upload.mjs'
import {
  getContributionDetail,
  getContributionPipeline,
  getMapOverview,
  getPipelineMetrics,
  listMapPoints
} from './js/map-mock-system.mjs'
import { getStageQuestions } from './js/stage-questions-data.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const MAP_UPLOAD_DIR = resolve(__dirname, '.data', 'map-uploads')

/** 开发环境 Mock / 百炼代理：GET 点位、POST 上传、戏曲绘本生成 */
function dialectMapMockPlugin(env = {}) {
  const bailian = getBailianConfig(env)
  if (bailian.useFixtures) {
    console.log('[storybook] 测试模式：粤剧·牡丹亭 优先使用 assets/storybook-test/mudanting 缓存')
  } else if (bailian.apiKey) {
    console.log(
      `[storybook] 百炼已启用：文本 ${bailian.chatModel}，图像 ${bailian.imageModel}`
    )
  } else {
    console.log('[storybook] 未配置 DASHSCOPE_API_KEY，使用本地 Mock')
  }
  const MOCK_TTS_AUDIO = new Map()
  const MOCK_STAGES = [
    { id: 's1', order: 1, name: '乡音启程', theme: '吴语入门', difficulty: '简单' },
    { id: 's2', order: 2, name: '市井晨曲', theme: '粤语日常', difficulty: '简单' },
    { id: 's3', order: 3, name: '茶馆快问', theme: '川渝方言', difficulty: '中等' },
    { id: 's4', order: 4, name: '戏台试音', theme: '越剧片段', difficulty: '中等' },
    { id: 's5', order: 5, name: '乡韵进阶', theme: '多方言混合', difficulty: '困难' },
    { id: 's6', order: 6, name: '关城辨音', theme: '燕赵方音', difficulty: '困难' },
    { id: 's7', order: 7, name: '方音大师', theme: '综合挑战', difficulty: '大师' }
  ]

  function readJsonBody(req) {
    return new Promise((resolve) => {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk
      })
      req.on('end', () => {
        try {
          resolve(raw ? JSON.parse(raw) : {})
        } catch {
          resolve({})
        }
      })
      req.on('error', () => resolve({}))
    })
  }

  function createMockTtsWav(text = '') {
    const sampleRate = 22050
    const seconds = Math.min(7, Math.max(2.2, 1.6 + text.length * 0.08))
    const samples = Math.floor(sampleRate * seconds)
    const dataSize = samples * 2
    const buffer = Buffer.alloc(44 + dataSize)

    buffer.write('RIFF', 0)
    buffer.writeUInt32LE(36 + dataSize, 4)
    buffer.write('WAVE', 8)
    buffer.write('fmt ', 12)
    buffer.writeUInt32LE(16, 16)
    buffer.writeUInt16LE(1, 20)
    buffer.writeUInt16LE(1, 22)
    buffer.writeUInt32LE(sampleRate, 24)
    buffer.writeUInt32LE(sampleRate * 2, 28)
    buffer.writeUInt16LE(2, 32)
    buffer.writeUInt16LE(16, 34)
    buffer.write('data', 36)
    buffer.writeUInt32LE(dataSize, 40)

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate
      const syllable = Math.sin(t * Math.PI * 7.2) > -0.18 ? 1 : 0.18
      const envelope = Math.sin(Math.min(1, t / 0.08) * Math.PI * 0.5) * Math.sin(Math.min(1, (seconds - t) / 0.18) * Math.PI * 0.5)
      const wave = Math.sin(2 * Math.PI * 180 * t) * 0.55 + Math.sin(2 * Math.PI * 360 * t) * 0.22
      const sample = Math.max(-1, Math.min(1, wave * syllable * envelope * 0.5))
      buffer.writeInt16LE(Math.floor(sample * 32767), 44 + i * 2)
    }

    return buffer
  }

  return {
    name: 'dialect-map-mock-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        const cleanUrl = url.split('?')[0]

        if (cleanUrl === '/api/storybook/generate' && req.method === 'POST') {
          readJsonBody(req)
            .then(async (body) => {
              const dialect = typeof body.dialect === 'string' ? body.dialect : '粤语'
              const opera = typeof body.opera === 'string' ? body.opera : '粤剧《牡丹亭》'
              const role = typeof body.role === 'string' ? body.role : '杜丽娘（闺门旦）'
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              try {
                const payload = await generateStorybookWithBailian(env, { dialect, opera, role })
                res.statusCode = 200
                res.end(JSON.stringify(payload))
              } catch (err) {
                console.error('[storybook] generate failed, fallback mock:', err)
                res.statusCode = 200
                res.end(JSON.stringify(buildStorybookResponse(dialect, opera, role)))
              }
            })
            .catch((err) => {
              console.error('[storybook] request error:', err)
              res.statusCode = 500
              res.end(JSON.stringify({ success: false, message: '服务器处理失败' }))
            })
          return
        }

        if (cleanUrl === '/api/tts/synthesize' && req.method === 'POST') {
          readJsonBody(req).then((body) => {
            const text = typeof body.text === 'string' ? body.text : '你好，我是水墨数字人，正在展示口型同步效果。'
            const id = String(Date.now())
            MOCK_TTS_AUDIO.set(id, createMockTtsWav(text))
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.statusCode = 200
            res.end(
              JSON.stringify({
                code: 0,
                data: {
                  id,
                  text,
                  audioUrl: `/api/tts/audio/${id}.wav`
                }
              })
            )
          })
          return
        }

        const ttsAudioMatch = cleanUrl.match(/^\/api\/tts\/audio\/([^/]+)\.wav$/)
        if (ttsAudioMatch && req.method === 'GET') {
          const audio = MOCK_TTS_AUDIO.get(ttsAudioMatch[1])
          if (!audio) {
            res.statusCode = 404
            res.end('not found')
            return
          }
          res.setHeader('Content-Type', 'audio/wav')
          res.setHeader('Content-Length', String(audio.length))
          res.statusCode = 200
          res.end(audio)
          return
        }

        if (cleanUrl === '/api/map/overview' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.statusCode = 200
          res.end(JSON.stringify({ code: 0, data: getMapOverview() }))
          return
        }

        if (cleanUrl === '/api/map/points' && req.method === 'GET') {
          const requestUrl = new URL(req.url || '', 'http://localhost')
          const filters = Object.fromEntries(requestUrl.searchParams.entries())
          Promise.allSettled([Promise.resolve(listMapPoints(filters)), listBackendMapPoints(filters)])
            .then((results) => {
              const localItems = results[0].status === 'fulfilled' ? results[0].value : []
              const backendItems = results[1].status === 'fulfilled' ? results[1].value : []
              if (results[1].status === 'rejected') {
                console.error('[map] backend points fetch failed:', results[1].reason)
              }
              const merged = [...localItems]
              const indexById = new Map(localItems.map((item, index) => [item.id, index]))
              for (const item of backendItems) {
                if (indexById.has(item.id)) {
                  merged[indexById.get(item.id)] = { ...merged[indexById.get(item.id)], ...item }
                  continue
                }
                indexById.set(item.id, merged.length)
                merged.push(item)
              }
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.statusCode = 200
              res.end(JSON.stringify({ code: 0, data: merged }))
            })
            .catch((err) => {
              console.error('[map] points merge failed:', err)
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.statusCode = 500
              res.end(JSON.stringify({ code: 1, message: '点位获取失败' }))
            })
          return
        }

        const mapPointDeleteMatch = cleanUrl.match(/^\/api\/map\/points\/([^/]+)$/)
        if (mapPointDeleteMatch && req.method === 'DELETE') {
          deleteUploadedContribution(mapPointDeleteMatch[1], MAP_UPLOAD_DIR)
            .then((deleted) => {
              if (!deleted) {
                res.statusCode = 404
                res.setHeader('Content-Type', 'application/json; charset=utf-8')
                res.end(JSON.stringify({ code: 1, message: '点位不存在' }))
                return
              }
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.statusCode = 200
              res.end(JSON.stringify({ code: 0, message: 'ok' }))
            })
            .catch((err) => {
              console.error('[map] delete failed:', err)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ code: 1, message: err.message || '删除失败' }))
            })
          return
        }

        const contributionDetailMatch = cleanUrl.match(/^\/api\/contributions\/([^/]+)$/)
        if (contributionDetailMatch && req.method === 'GET') {
          const detail = getContributionDetail(contributionDetailMatch[1])
          if (!detail) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ code: 1, message: '贡献记录不存在' }))
            return
          }
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.statusCode = 200
          res.end(JSON.stringify({ code: 0, data: detail }))
          return
        }

        const contributionPipelineMatch = cleanUrl.match(/^\/api\/contributions\/([^/]+)\/pipeline$/)
        if (contributionPipelineMatch && req.method === 'GET') {
          const pipeline = getContributionPipeline(contributionPipelineMatch[1])
          if (!pipeline) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ code: 1, message: '流水线记录不存在' }))
            return
          }
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.statusCode = 200
          res.end(JSON.stringify({ code: 0, data: pipeline }))
          return
        }

        if (cleanUrl === '/api/pipeline/metrics' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.statusCode = 200
          res.end(JSON.stringify({ code: 0, data: getPipelineMetrics() }))
          return
        }

        if (cleanUrl === '/api/contributions' && req.method === 'POST') {
          handleContributionCreate(req, MAP_UPLOAD_DIR, { res }).catch((err) => {
            console.error('[map] contribution create failed:', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ code: 1, message: '上传处理失败' }))
          })
          return
        }

        const mapAudioMatch = cleanUrl.match(/^\/api\/map\/audio\/([^/]+)$/)
        if (mapAudioMatch && req.method === 'GET') {
          serveMapUploadAudio(req, res, MAP_UPLOAD_DIR, mapAudioMatch[1])
          return
        }

        if (cleanUrl === '/api/map/upload' && req.method === 'POST') {
          handleLegacyMapUpload(req, MAP_UPLOAD_DIR, { res }).catch((err) => {
            console.error('[map] legacy upload failed:', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ code: 1, message: '上传处理失败' }))
          })
          return
        }

        if (url.startsWith('/api/stages/list') && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.statusCode = 200
          res.end(JSON.stringify({ code: 0, data: MOCK_STAGES }))
          return
        }

        const stageDetailMatch = cleanUrl.match(/^\/api\/stages\/([^/]+)$/)
        if (stageDetailMatch && req.method === 'GET') {
          const stageId = stageDetailMatch[1]
          const questions = getStageQuestions(stageId)
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.statusCode = 200
          res.end(JSON.stringify({ code: 0, data: { id: stageId, questions } }))
          return
        }

        const stageSubmitMatch = cleanUrl.match(/^\/api\/stages\/([^/]+)\/submit$/)
        if (stageSubmitMatch && req.method === 'POST') {
          const drain = () =>
            new Promise((resolve) => {
              req.on('data', () => {})
              req.on('end', resolve)
              req.on('error', resolve)
            })
          drain().then(() => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.statusCode = 200
            res.end(JSON.stringify({ code: 0, message: 'ok' }))
          })
          return
        }

        next()
      })
    }
  }
}

const VIDEO_STITCH_MIME = {
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8'
}

/** 支持 Range 请求，否则浏览器无法拖动 video/mp4 进度条 */
function serveMediaFile(req, res, filePath) {
  const st = statSync(filePath)
  const ext = extname(filePath).toLowerCase()
  const contentType = VIDEO_STITCH_MIME[ext] || 'application/octet-stream'
  const fileSize = st.size
  const range = req.headers.range

  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Type', contentType)

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (!match) {
      res.statusCode = 416
      res.setHeader('Content-Range', `bytes */${fileSize}`)
      res.end()
      return
    }
    let start = match[1] ? parseInt(match[1], 10) : 0
    let end = match[2] ? parseInt(match[2], 10) : fileSize - 1
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
      res.statusCode = 416
      res.setHeader('Content-Range', `bytes */${fileSize}`)
      res.end()
      return
    }
    end = Math.min(end, fileSize - 1)
    const chunkSize = end - start + 1
    res.statusCode = 206
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`)
    res.setHeader('Content-Length', chunkSize)
    createReadStream(filePath, { start, end }).pipe(res)
    return
  }

  res.setHeader('Content-Length', fileSize)
  createReadStream(filePath).pipe(res)
}

function createMediaStaticPlugin(route, folderName) {
  const root = resolve(__dirname, folderName)
  const attach = (server) => {
    server.middlewares.use(`/${route}`, (req, res, next) => {
      const urlPath = decodeURIComponent((req.url || '').split('?')[0])
      const filePath = join(root, urlPath.replace(/^\//, ''))
      try {
        const st = statSync(filePath)
        if (!st.isFile()) return next()
        serveMediaFile(req, res, filePath)
      } catch {
        next()
      }
    })
  }
  return {
    name: `${route}-static`,
    configureServer: attach,
    configurePreviewServer: attach,
    closeBundle() {
      const distDir = resolve(__dirname, 'dist')
      if (existsSync(root)) {
        mkdirSync(distDir, { recursive: true })
        cpSync(root, join(distDir, route), { recursive: true })
      }
    }
  }
}

/** 开发 / 预览时提供 video-stitch、video-learn 静态资源；构建时复制到 dist */
const videoStitchStaticPlugin = () => createMediaStaticPlugin('video-stitch', 'video-stitch')
const videoLearnStaticPlugin = () => createMediaStaticPlugin('video-learn', 'video-learn')
const videoStudyStaticPlugin = () => createMediaStaticPlugin('video-study', 'video-study')

/** 首页脚本在 js/（非 module），构建时需复制到 dist */
function copyHomeStaticAssetsPlugin() {
  return {
    name: 'copy-home-static-assets',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist')
      const jsSrc = resolve(__dirname, 'js')
      if (existsSync(jsSrc)) {
        mkdirSync(distDir, { recursive: true })
        cpSync(jsSrc, join(distDir, 'js'), { recursive: true })
      }
      const storybookTest = resolve(__dirname, 'assets', 'storybook-test')
      if (existsSync(storybookTest)) {
        cpSync(storybookTest, join(distDir, 'assets', 'storybook-test'), { recursive: true })
      }
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  base: './',
  plugins: [vue(), dialectMapMockPlugin(env), videoStitchStaticPlugin(), videoLearnStaticPlugin(), videoStudyStaticPlugin(), copyHomeStaticAssetsPlugin()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/chat': 'http://127.0.0.1:8001',
      '/health': 'http://127.0.0.1:8001',
      '/audio': 'http://127.0.0.1:8001',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        map: resolve(__dirname, 'map.html'),
        database: resolve(__dirname, 'database.html'),
        study: resolve(__dirname, 'study.html')
      }
    }
  }
  // 生产环境或接入真实后端时：删除 dialectMapMockPlugin，并在 server 中配置 proxy，例如：
  // server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8080' } }
  }
})
