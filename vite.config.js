import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/** 开发环境 Mock：GET 点位、POST 上传（消费 multipart 体后返回成功） */
function dialectMapMockPlugin() {
  const MOCK_TTS_AUDIO = new Map()
  const MOCK_POINTS = [
    {
      id: '1',
      location: { lng: 120.153576, lat: 30.287459 },
      area: '浙江省/杭州市/西湖区',
      dialect: '吴语·杭州小片',
      type: '方言',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      content: '你好，吃饭了吗？',
      nickname: '西湖阿姐',
      time: '2026-04-10 14:22:00'
    },
    {
      id: '2',
      location: { lng: 121.473701, lat: 31.230416 },
      area: '上海市/上海市/黄浦区',
      dialect: '吴语·上海话',
      type: '童谣',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      content: '落雨喽，打烊喽，小八辣子开会喽。',
      nickname: '石库门囡囡',
      time: '2026-04-12 09:05:33'
    },
    {
      id: '3',
      location: { lng: 116.397428, lat: 39.90923 },
      area: '北京市/北京市/东城区',
      dialect: '北京官话',
      type: '民谣',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      content: '前门情思大碗茶（节选哼唱）',
      nickname: '胡同里的风',
      time: '2026-04-15 18:40:12'
    },
    {
      id: '4',
      location: { lng: 113.264385, lat: 23.129112 },
      area: '广东省/广州市/越秀区',
      dialect: '粤语·广府片',
      type: '戏曲',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
      content: '帝女花之香夭（念白示范）',
      nickname: '粤剧票友阿明',
      time: '2026-04-16 11:18:45'
    },
    {
      id: '5',
      location: { lng: 104.065735, lat: 30.659462 },
      area: '四川省/成都市/锦江区',
      dialect: '西南官话·成渝小片',
      type: '民俗',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
      content: '清明采茶调（口传版）',
      nickname: '锦江茶客',
      time: '2026-04-17 08:56:21'
    },
    {
      id: '6',
      location: { lng: 120.585315, lat: 31.298886 },
      area: '江苏省/苏州市/姑苏区',
      dialect: '吴语·苏州话',
      type: '方言',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
      content: '今朝天气蛮好个。',
      nickname: '评弹小周',
      time: '2026-04-17 16:02:00'
    }
  ]
  const MOCK_STAGES = [
    { id: 's1', order: 1, name: '乡音启程', theme: '吴语入门', difficulty: '简单' },
    { id: 's2', order: 2, name: '市井晨曲', theme: '粤语日常', difficulty: '简单' },
    { id: 's3', order: 3, name: '茶馆快问', theme: '川渝方言', difficulty: '中等' },
    { id: 's4', order: 4, name: '戏台试音', theme: '越剧片段', difficulty: '中等' },
    { id: 's5', order: 5, name: '乡韵进阶', theme: '多方言混合', difficulty: '困难' },
    { id: 's6', order: 6, name: '方音大师', theme: '综合挑战', difficulty: '困难' }
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

        if (cleanUrl === '/api/tts/synthesize' && req.method === 'POST') {
          readJsonBody(req).then((body) => {
            const text = typeof body.text === 'string' ? body.text : '你好，我是语墨，正在展示口型同步效果。'
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

        if (url.startsWith('/api/map/points') && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.statusCode = 200
          res.end(JSON.stringify({ code: 0, data: MOCK_POINTS }))
          return
        }

        if (url.startsWith('/api/map/upload') && req.method === 'POST') {
          const drain = () =>
            new Promise((resolve) => {
              req.on('data', () => {})
              req.on('end', resolve)
              req.on('error', resolve)
            })
          drain().then(() => {
            const id = String(Date.now())
            MOCK_POINTS.push({
              id,
              location: { lng: 120.15 + Math.random() * 0.02, lat: 30.25 + Math.random() * 0.02 },
              area: '浙江省/杭州市/西湖区',
              dialect: '新上传样本',
              type: '方言',
              audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
              content: '（Mock 已接收上传）',
              nickname: '访客',
              time: new Date().toISOString().slice(0, 19).replace('T', ' ')
            })
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.statusCode = 200
            res.end(JSON.stringify({ code: 0, message: 'ok', data: { id } }))
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
          const questions = [
            {
              id: `${stageId}-q1`,
              type: 'audioMeaning',
              audioUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
              options: ['快点回家', '今天真热闹', '你吃饭了吗', '小雨下不停'],
              correctIndex: 2
            },
            {
              id: `${stageId}-q2`,
              type: 'repeatScore',
              sentence: '侬今朝开心伐？'
            },
            {
              id: `${stageId}-q3`,
              type: 'fillBlank',
              stem: '方言填空：阿拉___去茶馆白相。',
              options: ['今朝', '昨日', '明朝', '晚点'],
              correctIndex: 0
            },
            {
              id: `${stageId}-q4`,
              type: 'operaRepeat',
              script: '越音轻转，水袖拂风，侬且听我唱一段。'
            }
          ]
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

export default defineConfig({
  base: './',
  plugins: [vue(), dialectMapMockPlugin()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        map: resolve(__dirname, 'map.html'),
        study: resolve(__dirname, 'study.html')
      }
    }
  }
  // 生产环境或接入真实后端时：删除 dialectMapMockPlugin，并在 server 中配置 proxy，例如：
  // server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8080' } }
})
