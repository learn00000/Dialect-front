export const CONTENT_TYPES = ['方言', '戏曲', '民谣', '童谣', '民俗']

export const CONTENT_TYPE_META = {
  方言: { color: '#2f8f83', glow: 'rgba(47,143,131,0.28)' },
  戏曲: { color: '#c66b4b', glow: 'rgba(198,107,75,0.28)' },
  民谣: { color: '#5b8fd6', glow: 'rgba(91,143,214,0.28)' },
  童谣: { color: '#d88ca8', glow: 'rgba(216,140,168,0.28)' },
  民俗: { color: '#9b8354', glow: 'rgba(155,131,84,0.28)' }
}

export const LAYER_OPTIONS = [
  { key: 'new', label: '新贡献', description: '刚刚收录，等待进入治理链路' },
  { key: 'processing', label: '治理中', description: '正在被智能体清洗、转写、标注与过滤' },
  { key: 'ready', label: '可训练', description: '已通过治理，可进入训练语料库' }
]

export const STATUS_META = {
  new: {
    label: '新贡献',
    tone: 'text-[#2a726d]',
    chip: 'bg-[#dff5f2] text-[#195954] ring-1 ring-[rgba(47,143,131,0.18)]'
  },
  processing: {
    label: '治理中',
    tone: 'text-[#165c58]',
    chip: 'bg-[#e8f5ff] text-[#21537d] ring-1 ring-[rgba(91,143,214,0.18)]'
  },
  review: {
    label: '待复核',
    tone: 'text-[#8c5b16]',
    chip: 'bg-[#fff4dd] text-[#8c5b16] ring-1 ring-[rgba(214,150,41,0.22)]'
  },
  ready: {
    label: '可训练',
    tone: 'text-[#1f5d37]',
    chip: 'bg-[#e6f8ec] text-[#1f5d37] ring-1 ring-[rgba(72,155,102,0.2)]'
  },
  failed: {
    label: '失败',
    tone: 'text-[#963737]',
    chip: 'bg-[#fff0f0] text-[#963737] ring-1 ring-[rgba(194,61,61,0.22)]'
  }
}

export const PUBLIC_PIPELINE_STAGES = [
  { key: 'ingest', label: '收录', agentName: '采集入口' },
  { key: 'clean', label: '清洗', agentName: '音频治理体' },
  { key: 'transcribe', label: '转写', agentName: '转写体' },
  { key: 'annotate', label: '标注', agentName: '标注体' },
  { key: 'qa', label: '质检', agentName: '质检体' },
  { key: 'archive', label: '入库', agentName: '语料入库体' }
]

export const INTERNAL_PIPELINE_STAGES = [
  { key: 'geo-normalize', label: '地理归一' },
  { key: 'denoise-vad', label: '降噪 / VAD' },
  { key: 'asr', label: 'ASR' },
  { key: 'dialect-id', label: '方言识别' },
  { key: 'segment', label: '切分' },
  { key: 'normalize-text', label: '文本规范化' },
  { key: 'safety-check', label: '去重脱敏 / 授权检查' },
  { key: 'human-review', label: '志愿者复核' }
]

export const EMPTY_OVERVIEW = {
  totalContributions: 0,
  processingCount: 0,
  readyCount: 0,
  newCount: 0,
  reviewCount: 0,
  regionCoverage: 0,
  newLast24h: 0,
  readyRate: 0,
  highlightSentence: '每一段乡音，都有坐标、状态与去向。'
}

export const EMPTY_PIPELINE_METRICS = {
  throughput24h: 0,
  reviewQueueCount: 0,
  failedCount: 0,
  stages: PUBLIC_PIPELINE_STAGES.map((stage) => ({
    key: stage.key,
    label: stage.label,
    completedCount: 0,
    runningCount: 0,
    failedCount: 0
  }))
}

export function parseArea(area) {
  const [province = '', city = '', district = ''] = String(area || '').split('/')
  return { province, city, district }
}

export function describeArea(area) {
  const { province, city, district } = parseArea(area)
  return [province, city, district].filter(Boolean).join(' / ')
}

export function formatDateTime(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatPercent(value) {
  const n = Number(value || 0)
  return `${Math.round(n * 100)}%`
}

export function getLayerFromStatus(status) {
  if (status === 'ready') return 'ready'
  if (status === 'new') return 'new'
  return 'processing'
}

export function isPointInLayer(point, layer) {
  return getLayerFromStatus(point?.status) === layer
}

export function summarizeFilterText(filters, selectedTypes) {
  const area = [filters.province, filters.city, filters.district].filter(Boolean).join(' / ')
  const typeText = selectedTypes.length ? selectedTypes.join('、') : '全部类型'
  return [area || '全国', typeText].join(' · ')
}

export function stageStateText(state) {
  switch (state) {
    case 'complete':
      return '已完成'
    case 'running':
      return '进行中'
    case 'failed':
      return '失败'
    case 'review':
      return '待复核'
    default:
      return '待开始'
  }
}

export function getPipelineProgress(stages) {
  const list = Array.isArray(stages) ? stages : []
  if (!list.length) return 0
  const score = list.reduce((sum, stage) => {
    if (stage.state === 'complete') return sum + 1
    if (stage.state === 'running') return sum + 0.55
    if (stage.state === 'review') return sum + 0.7
    if (stage.state === 'failed') return sum + 0.35
    return sum
  }, 0)
  return Math.min(1, score / list.length)
}

export function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.processing
}

const VOLUNTEER_REVIEW_CHIP = {
  pending: 'bg-[#fff4dd] text-[#8c5b16] ring-1 ring-[rgba(214,150,41,0.22)]',
  mine: 'bg-[#eef4ff] text-[#275a8a] ring-1 ring-[rgba(91,143,214,0.22)]',
  pass: 'bg-[#e6f8ec] text-[#1f5d37] ring-1 ring-[rgba(72,155,102,0.2)]',
  fail: 'bg-[#fff0f0] text-[#963737] ring-1 ring-[rgba(194,61,61,0.2)]',
  risk: 'bg-[#fff4ef] text-[#8b4a33] ring-1 ring-[rgba(198,107,75,0.22)]'
}

export function getVolunteerRowStatusMeta(row = {}, reviewerName = '', reviewedByMe = false) {
  const status = String(row.volunteerReviewStatus || 'not_started')
  const count = Number(row.volunteerReviewCount || 0)

  if (status === 'approved') {
    return {
      label: reviewedByMe ? '我已审核 · 已通过' : '审核通过',
      chip: VOLUNTEER_REVIEW_CHIP.pass
    }
  }
  if (status === 'rejected') {
    return {
      label: reviewedByMe ? '我已审核 · 未通过' : '审核未通过',
      chip: VOLUNTEER_REVIEW_CHIP.fail
    }
  }
  if (status === 'risk_flagged') {
    return {
      label: reviewedByMe ? '我已审核 · 有风险' : '标记有风险',
      chip: VOLUNTEER_REVIEW_CHIP.risk
    }
  }
  if (reviewedByMe) {
    return {
      label: count >= 2 ? `我已审核 · 已 ${count} 人` : '我已审核',
      chip: VOLUNTEER_REVIEW_CHIP.mine
    }
  }
  if (status.startsWith('awaiting_reviewer_')) {
    const n = status.replace('awaiting_reviewer_', '')
    return {
      label: `待第 ${n} 位审核`,
      chip: VOLUNTEER_REVIEW_CHIP.pending
    }
  }
  if (status === 'pending') {
    return { label: '投票进行中', chip: VOLUNTEER_REVIEW_CHIP.pending }
  }
  if (count > 0) {
    return { label: `已 ${count} 人审核`, chip: VOLUNTEER_REVIEW_CHIP.pending }
  }
  return { label: '待我审核', chip: VOLUNTEER_REVIEW_CHIP.pending }
}

export function getTypeMeta(type) {
  return CONTENT_TYPE_META[type] || CONTENT_TYPE_META.方言
}
