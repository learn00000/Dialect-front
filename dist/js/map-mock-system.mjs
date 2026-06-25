import { getLocationByAreaString } from '../src/data/map-regions.js'
import {
  INTERNAL_PIPELINE_STAGES,
  PUBLIC_PIPELINE_STAGES
} from '../src/data/dialect-map-config.js'

const DAY_MS = 24 * 60 * 60 * 1000

function isoOffset(minutesAgo) {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString()
}

function createSeedContribution(seed) {
  return {
    id: seed.id,
    area: seed.area,
    location: seed.location || getLocationByAreaString(seed.area),
    dialectSelfReport: seed.dialectSelfReport,
    dialectLabel: seed.dialectLabel || seed.dialectSelfReport,
    type: seed.type,
    audioUrl: seed.audioUrl,
    content: seed.content || '',
    transcriptBase: seed.transcriptBase || seed.content || '',
    nickname: seed.nickname || '匿名贡献者',
    createdAt: seed.createdAt,
    createdAtMs: new Date(seed.createdAt).getTime(),
    consentGranted: seed.consentGranted ?? true,
    uploaded: Boolean(seed.uploaded),
    mockScenario: seed.mockScenario,
    reviewReason: seed.reviewReason || '',
    riskFlags: seed.riskFlags || [],
    audioFilename: seed.audioFilename || '',
    metaNotes: seed.metaNotes || {}
  }
}

const contributionStore = [
  createSeedContribution({
    id: 'seed-001',
    area: '浙江省/杭州市/西湖区',
    dialectSelfReport: '吴语·杭州小片',
    type: '方言',
    audioUrl: './video-stitch/wenzhou/wenzhou-001.m4a',
    content: '吃过夜饭伐？',
    transcriptBase: '吃过夜饭伐？这是杭州城区日常寒暄口语。',
    nickname: '西湖阿姐',
    createdAt: isoOffset(15),
    mockScenario: 'new'
  }),
  createSeedContribution({
    id: 'seed-002',
    area: '广东省/广州市/越秀区',
    dialectSelfReport: '粤语·广府片',
    type: '戏曲',
    audioUrl: './video-learn/guangdongyueju/guangdongyueju-001.m4a',
    content: '帝女花之香夭（念白示范）',
    transcriptBase: '帝女花之香夭，粤剧念白片段，已完成初步转写。',
    nickname: '粤剧票友阿明',
    createdAt: isoOffset(48),
    mockScenario: 'processing'
  }),
  createSeedContribution({
    id: 'seed-003',
    area: '上海市/上海市/黄浦区',
    dialectSelfReport: '吴语·上海话',
    type: '童谣',
    audioUrl: './video-stitch/taizhou/taizhou-001.m4a',
    content: '落雨喽，打烊喽，小八辣子开会喽。',
    transcriptBase: '落雨喽，打烊喽，小八辣子开会喽。',
    nickname: '石库门囡囡',
    createdAt: isoOffset(92),
    mockScenario: 'review',
    reviewReason: '方言识别与自报信息接近，但童谣分句置信度偏低，需要人工复核断句。',
    riskFlags: ['低置信度断句', '待人工复核']
  }),
  createSeedContribution({
    id: 'seed-004',
    area: '四川省/成都市/锦江区',
    dialectSelfReport: '西南官话·成渝小片',
    type: '民俗',
    audioUrl: './video-stitch/taizhou/taizhou-003.m4a',
    content: '清明采茶调（口传版）',
    transcriptBase: '清明采茶调，民俗口传版本，已完成切分与规范化。',
    nickname: '锦江茶客',
    createdAt: isoOffset(210),
    mockScenario: 'ready'
  }),
  createSeedContribution({
    id: 'seed-005',
    area: '江苏省/苏州市/姑苏区',
    dialectSelfReport: '吴语·苏州话',
    type: '方言',
    audioUrl: './video-stitch/wenzhou/wenzhou002.m4a',
    content: '今朝天气蛮好个。',
    transcriptBase: '今朝天气蛮好个，城市日常问候样本。',
    nickname: '评弹小周',
    createdAt: isoOffset(320),
    mockScenario: 'ready'
  }),
  createSeedContribution({
    id: 'seed-006',
    area: '北京市/北京市/东城区',
    dialectSelfReport: '北京官话',
    type: '民谣',
    audioUrl: './video-stitch/minnan/minnan001.m4a',
    content: '前门情思大碗茶（节选哼唱）',
    transcriptBase: '前门情思大碗茶，民谣片段哼唱样本。',
    nickname: '胡同里的风',
    createdAt: isoOffset(75),
    mockScenario: 'processing'
  })
]

function stageEnvelope(meta, patch = {}) {
  return {
    key: meta.key,
    label: meta.label,
    state: 'waiting',
    agentName: meta.agentName || meta.label,
    confidence: null,
    startedAt: null,
    endedAt: null,
    note: '',
    ...patch
  }
}

function completeStages(list, count, record, baseConfidence = 0.92) {
  return list.map((meta, index) => {
    if (index >= count) return stageEnvelope(meta)
    const startedAt = new Date(record.createdAtMs + index * 4 * 60 * 1000).toISOString()
    const endedAt = new Date(record.createdAtMs + (index + 1) * 4 * 60 * 1000).toISOString()
    return stageEnvelope(meta, {
      state: 'complete',
      startedAt,
      endedAt,
      confidence: Math.max(0.72, baseConfidence - index * 0.02),
      note: `${meta.label}节点已完成。`
    })
  })
}

function buildReadyProfile(record) {
  const stages = completeStages(PUBLIC_PIPELINE_STAGES, PUBLIC_PIPELINE_STAGES.length, record, 0.95)
  const internalStages = INTERNAL_PIPELINE_STAGES.map((meta, index) =>
    stageEnvelope(meta, {
      state: meta.key === 'human-review' ? 'waiting' : 'complete',
      confidence: meta.key === 'human-review' ? null : Math.max(0.8, 0.95 - index * 0.02),
      note: meta.key === 'human-review' ? '未触发人工复核。' : `${meta.label}通过。`
    })
  )

  return {
    status: 'ready',
    stages,
    internalStages,
    transcriptSnippet: record.transcriptBase,
    qualityScore: 94,
    readySegmentCount: 7,
    nextAction: '进入训练批次',
    reviewReason: '',
    riskFlags: record.riskFlags || []
  }
}

function buildReviewProfile(record) {
  const stages = PUBLIC_PIPELINE_STAGES.map((meta, index) => {
    if (index < 4) {
      return stageEnvelope(meta, {
        state: 'complete',
        confidence: Math.max(0.76, 0.9 - index * 0.03),
        note: `${meta.label}节点已完成。`
      })
    }
    if (meta.key === 'qa') {
      return stageEnvelope(meta, {
        state: 'review',
        confidence: 0.62,
        note: record.reviewReason || '检测到低置信度结果，等待人工复核。'
      })
    }
    return stageEnvelope(meta, {
      state: 'waiting',
      note: '等待质检完成后入库。'
    })
  })

  const internalStages = INTERNAL_PIPELINE_STAGES.map((meta) => {
    if (meta.key === 'normalize-text') {
      return stageEnvelope(meta, {
        state: 'failed',
        confidence: 0.58,
        note: '文本规范化与断句规则冲突，已回退到人工复核。'
      })
    }
    if (meta.key === 'human-review') {
      return stageEnvelope(meta, {
        state: 'review',
        confidence: 0.61,
        note: '请确认断句与发音归属。'
      })
    }
    return stageEnvelope(meta, {
      state: 'complete',
      confidence: 0.74,
      note: `${meta.label}已完成。`
    })
  })

  return {
    status: 'review',
    stages,
    internalStages,
    transcriptSnippet: record.transcriptBase,
    qualityScore: 73,
    readySegmentCount: 3,
    nextAction: '等待人工复核',
    reviewReason: record.reviewReason || '系统发现疑似低置信度样本，已转入人工复核队列。',
    riskFlags: record.riskFlags || ['待人工复核']
  }
}

function buildProcessingProfile(record) {
  const stages = PUBLIC_PIPELINE_STAGES.map((meta, index) => {
    if (index < 2) {
      return stageEnvelope(meta, {
        state: 'complete',
        confidence: 0.9 - index * 0.03,
        note: `${meta.label}节点已完成。`
      })
    }
    if (meta.key === 'transcribe') {
      return stageEnvelope(meta, {
        state: 'running',
        confidence: 0.78,
        note: '系统正在进行音频转写与多轮对齐。'
      })
    }
    return stageEnvelope(meta, {
      state: 'waiting',
      note: '等待上游阶段完成。'
    })
  })

  const internalStages = INTERNAL_PIPELINE_STAGES.map((meta) => {
    if (meta.key === 'geo-normalize' || meta.key === 'denoise-vad') {
      return stageEnvelope(meta, {
        state: 'complete',
        confidence: 0.89,
        note: `${meta.label}已完成。`
      })
    }
    if (meta.key === 'asr') {
      return stageEnvelope(meta, {
        state: 'running',
        confidence: 0.78,
        note: 'ASR 正在生成多候选文本。'
      })
    }
    return stageEnvelope(meta, {
      state: 'waiting',
      note: '等待当前节点结束。'
    })
  })

  return {
    status: 'processing',
    stages,
    internalStages,
    transcriptSnippet: '系统已生成局部草稿，正在继续补全。',
    qualityScore: 66,
    readySegmentCount: 2,
    nextAction: '等待转写完成',
    reviewReason: '',
    riskFlags: []
  }
}

function buildNewProfile(record) {
  const stages = PUBLIC_PIPELINE_STAGES.map((meta) => {
    if (meta.key === 'ingest') {
      return stageEnvelope(meta, {
        state: 'running',
        confidence: 0.98,
        note: '音频与基础元数据已进入收录队列。'
      })
    }
    return stageEnvelope(meta, {
      state: 'waiting',
      note: '等待进入治理流水线。'
    })
  })

  const internalStages = INTERNAL_PIPELINE_STAGES.map((meta, index) =>
    stageEnvelope(meta, {
      state: index === 0 ? 'running' : 'waiting',
      confidence: index === 0 ? 0.95 : null,
      note: index === 0 ? '正在进行地区归一化。' : '等待前置节点完成。'
    })
  )

  return {
    status: 'new',
    stages,
    internalStages,
    transcriptSnippet: '',
    qualityScore: null,
    readySegmentCount: 0,
    nextAction: '等待进入清洗队列',
    reviewReason: '',
    riskFlags: []
  }
}

function buildFreshProfile(record) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - record.createdAtMs) / 1000))

  if (elapsedSeconds >= 36) return buildReadyProfile(record)
  if (elapsedSeconds >= 30) {
    const readyProfile = buildReadyProfile(record)
    readyProfile.status = 'processing'
    readyProfile.stages[5] = stageEnvelope(PUBLIC_PIPELINE_STAGES[5], {
      state: 'running',
      confidence: 0.93,
      note: '系统正在把样本归档到训练语料库。'
    })
    readyProfile.internalStages[7] = stageEnvelope(INTERNAL_PIPELINE_STAGES[7], {
      state: 'waiting',
      note: '当前样本未触发人工复核。'
    })
    readyProfile.nextAction = '等待语料入库完成'
    return readyProfile
  }
  if (elapsedSeconds >= 24) {
    const profile = buildProcessingProfile(record)
    profile.stages[2] = stageEnvelope(PUBLIC_PIPELINE_STAGES[2], {
      state: 'complete',
      confidence: 0.84,
      note: '转写已完成。'
    })
    profile.stages[3] = stageEnvelope(PUBLIC_PIPELINE_STAGES[3], {
      state: 'complete',
      confidence: 0.8,
      note: '标注已完成。'
    })
    profile.stages[4] = stageEnvelope(PUBLIC_PIPELINE_STAGES[4], {
      state: 'running',
      confidence: 0.77,
      note: '系统正在做置信度与授权校验。'
    })
    profile.internalStages = INTERNAL_PIPELINE_STAGES.map((meta, index) => {
      if (index <= 5) {
        return stageEnvelope(meta, {
          state: 'complete',
          confidence: Math.max(0.74, 0.9 - index * 0.03),
          note: `${meta.label}已完成。`
        })
      }
      if (meta.key === 'safety-check') {
        return stageEnvelope(meta, {
          state: 'running',
          confidence: 0.77,
          note: '正在核查授权与去重。'
        })
      }
      return stageEnvelope(meta, {
        state: 'waiting',
        note: '未触发。'
      })
    })
    profile.transcriptSnippet = record.transcriptBase || '系统已生成主要转写结果。'
    profile.qualityScore = 81
    profile.readySegmentCount = 4
    profile.nextAction = '等待质检完成'
    return profile
  }
  if (elapsedSeconds >= 18) {
    const profile = buildProcessingProfile(record)
    profile.stages[2] = stageEnvelope(PUBLIC_PIPELINE_STAGES[2], {
      state: 'complete',
      confidence: 0.82,
      note: '转写已完成。'
    })
    profile.stages[3] = stageEnvelope(PUBLIC_PIPELINE_STAGES[3], {
      state: 'running',
      confidence: 0.76,
      note: '系统正在做切分、词元与方言标签补全。'
    })
    profile.internalStages = INTERNAL_PIPELINE_STAGES.map((meta, index) => {
      if (index <= 3) {
        return stageEnvelope(meta, {
          state: 'complete',
          confidence: Math.max(0.75, 0.88 - index * 0.03),
          note: `${meta.label}已完成。`
        })
      }
      if (meta.key === 'segment') {
        return stageEnvelope(meta, {
          state: 'running',
          confidence: 0.76,
          note: '正在做自动切分。'
        })
      }
      return stageEnvelope(meta, {
        state: 'waiting',
        note: '等待上游完成。'
      })
    })
    profile.transcriptSnippet = record.transcriptBase || '系统已生成粗转写结果。'
    profile.qualityScore = 72
    profile.readySegmentCount = 2
    profile.nextAction = '等待标注完成'
    return profile
  }
  if (elapsedSeconds >= 12) return buildProcessingProfile(record)
  if (elapsedSeconds >= 6) {
    const profile = buildNewProfile(record)
    profile.status = 'processing'
    profile.stages[0] = stageEnvelope(PUBLIC_PIPELINE_STAGES[0], {
      state: 'complete',
      confidence: 0.98,
      note: '收录完成，已进入治理流。'
    })
    profile.stages[1] = stageEnvelope(PUBLIC_PIPELINE_STAGES[1], {
      state: 'running',
      confidence: 0.9,
      note: '正在执行降噪与语音活动检测。'
    })
    profile.internalStages[0] = stageEnvelope(INTERNAL_PIPELINE_STAGES[0], {
      state: 'complete',
      confidence: 0.98,
      note: '地理归一完成。'
    })
    profile.internalStages[1] = stageEnvelope(INTERNAL_PIPELINE_STAGES[1], {
      state: 'running',
      confidence: 0.9,
      note: '正在降噪与切静音。'
    })
    profile.nextAction = '等待清洗完成'
    return profile
  }
  return buildNewProfile(record)
}

function buildProfile(record) {
  switch (record.mockScenario) {
    case 'ready':
      return buildReadyProfile(record)
    case 'review':
      return buildReviewProfile(record)
    case 'processing':
      return buildProcessingProfile(record)
    case 'fresh':
      return buildFreshProfile(record)
    case 'new':
    default:
      return buildNewProfile(record)
  }
}

function toMapPoint(record, profile) {
  return {
    id: record.id,
    location: record.location,
    area: record.area,
    dialectLabel: record.dialectLabel,
    type: record.type,
    status: profile.status,
    audioUrl: record.audioUrl,
    transcriptSnippet: profile.transcriptSnippet,
    qualityScore: profile.qualityScore,
    readySegmentCount: profile.readySegmentCount,
    createdAt: record.createdAt
  }
}

function toContributionDetail(record, profile) {
  return {
    ...toMapPoint(record, profile),
    dialectSelfReport: record.dialectSelfReport,
    nickname: record.nickname,
    content: record.content,
    consentGranted: record.consentGranted,
    reviewReason: profile.reviewReason,
    riskFlags: profile.riskFlags,
    nextAction: profile.nextAction
  }
}

function toContributionPipeline(record, profile) {
  return {
    id: record.id,
    stages: profile.stages,
    internalStages: profile.internalStages,
    latestOutput: {
      label: profile.nextAction,
      text: profile.transcriptSnippet || '尚未生成文本输出。'
    }
  }
}

function hydrateRecord(record) {
  const profile = buildProfile(record)
  return {
    point: toMapPoint(record, profile),
    detail: toContributionDetail(record, profile),
    pipeline: toContributionPipeline(record, profile)
  }
}

function parseTypes(value) {
  if (!value) return []
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function listMapPoints(filters = {}) {
  const types = parseTypes(filters.type)
  return contributionStore
    .map(hydrateRecord)
    .map((item) => item.point)
    .filter((point) => {
      if (filters.layer) {
        if (filters.layer === 'new' && point.status !== 'new') return false
        if (filters.layer === 'processing' && !['processing', 'review'].includes(point.status)) return false
        if (filters.layer === 'ready' && point.status !== 'ready') return false
      }

      const [province = '', city = '', district = ''] = String(point.area || '').split('/')
      if (filters.province && province !== filters.province) return false
      if (filters.city && city !== filters.city) return false
      if (filters.district && district !== filters.district) return false
      if (types.length && !types.includes(point.type)) return false
      if (filters.status && point.status !== filters.status) return false
      return true
    })
}

export function getMapOverview() {
  const details = contributionStore.map(hydrateRecord).map((item) => item.detail)
  const totalContributions = details.length
  const processingCount = details.filter((item) => item.status === 'processing').length
  const readyCount = details.filter((item) => item.status === 'ready').length
  const newCount = details.filter((item) => item.status === 'new').length
  const reviewCount = details.filter((item) => item.status === 'review').length
  const regionCoverage = new Set(details.map((item) => item.area)).size
  const newLast24h = details.filter((item) => Date.now() - new Date(item.createdAt).getTime() <= DAY_MS).length

  return {
    totalContributions,
    processingCount,
    readyCount,
    newCount,
    reviewCount,
    regionCoverage,
    newLast24h,
    readyRate: totalContributions ? readyCount / totalContributions : 0,
    highlightSentence: '每一段乡音，都有坐标、状态与去向。'
  }
}

export function getPipelineMetrics() {
  const hydrated = contributionStore.map(hydrateRecord)
  const reviewQueueCount = hydrated.filter((item) => item.detail.status === 'review').length
  const failedCount = hydrated.filter(
    (item) =>
      item.pipeline.stages.some((stage) => stage.state === 'failed') ||
      item.pipeline.internalStages.some((stage) => stage.state === 'failed')
  ).length

  const stages = PUBLIC_PIPELINE_STAGES.map((meta) => {
    let completedCount = 0
    let runningCount = 0
    let stageFailedCount = 0
    hydrated.forEach((item) => {
      const stage = item.pipeline.stages.find((candidate) => candidate.key === meta.key)
      if (!stage) return
      if (stage.state === 'complete') completedCount += 1
      if (stage.state === 'running' || stage.state === 'review') runningCount += 1
      if (stage.state === 'failed') stageFailedCount += 1
    })
    return {
      key: meta.key,
      label: meta.label,
      completedCount,
      runningCount,
      failedCount: stageFailedCount
    }
  })

  const throughput24h = hydrated.filter((item) => {
    const archived = item.pipeline.stages.find((stage) => stage.key === 'archive')
    return archived?.state === 'complete' && Date.now() - new Date(item.detail.createdAt).getTime() <= DAY_MS
  }).length

  return {
    throughput24h,
    reviewQueueCount,
    failedCount,
    stages
  }
}

export function getContributionDetail(id) {
  const record = contributionStore.find((item) => String(item.id) === String(id))
  if (!record) return null
  return hydrateRecord(record).detail
}

export function getContributionPipeline(id) {
  const record = contributionStore.find((item) => String(item.id) === String(id))
  if (!record) return null
  return hydrateRecord(record).pipeline
}

export function createContributionRecord(fields, fileInfo = {}) {
  const id = String(fields.id || Date.now())
  const createdAt = new Date().toISOString()
  const record = createSeedContribution({
    id,
    area: String(fields.area || '').trim(),
    location: getLocationByAreaString(fields.area),
    dialectSelfReport: String(fields.dialectSelfReport || fields.dialect || '').trim(),
    dialectLabel: String(fields.dialectSelfReport || fields.dialect || '').trim(),
    type: String(fields.type || '方言').trim(),
    audioUrl: fileInfo.audioUrl || '',
    audioFilename: fileInfo.filename || '',
    content: String(fields.content || '').trim() || '（用户上传录音）',
    transcriptBase: String(fields.content || '').trim() || '系统将根据音频自动生成转写摘要。',
    nickname: String(fields.nickname || '新贡献者').trim(),
    createdAt,
    consentGranted: String(fields.consentGranted || 'false') === 'true',
    uploaded: true,
    mockScenario: 'fresh'
  })

  contributionStore.unshift(record)
  return hydrateRecord(record).detail
}

export function deleteContributionRecord(id) {
  const index = contributionStore.findIndex((item) => String(item.id) === String(id))
  if (index === -1) return null
  const [removed] = contributionStore.splice(index, 1)
  return removed
}
