import { getLocationByAreaString } from '../data/map-regions.js'

const API_BASE = String(import.meta.env.VITE_DIALECT_API_BASE || 'http://127.0.0.1:8000').replace(/\/$/, '')

function buildQuery(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return
    const text = Array.isArray(value) ? value.join(',') : String(value)
    if (!text) return
    search.set(key, text)
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

function toApiUrl(path) {
  if (/^https?:\/\//.test(path)) return path
  return `${API_BASE}${path}`
}

async function requestJson(path, options) {
  const res = await fetch(toApiUrl(path), options)
  const json = await res.json().catch(() => ({}))
  if (!res.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.detail || json.message || `请求失败 (${res.status})`)
  }
  return json.data ?? json
}

function absolutizeUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  return `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`
}

function normalizeStatus(status) {
  const raw = String(status || '').trim().toLowerCase()
  if (raw === 'ready') return 'ready'
  if (raw === 'failed') return 'failed'
  if (raw === 'review' || raw === 'blocked_for_review') return 'review'
  if (raw === 'processing' || raw === 'running') return 'processing'
  return 'new'
}

function normalizeContributionType(value) {
  const text = String(value || '').trim()
  if (!text) return '方言'
  if (text.startsWith('audio/')) return '方言'
  return text
}

function normalizeStageState(state) {
  const raw = String(state || '').trim().toLowerCase()
  if (raw === 'completed' || raw === 'complete' || raw === 'skipped') return 'complete'
  if (raw === 'running') return 'running'
  if (raw === 'failed') return 'failed'
  if (raw === 'blocked') return 'review'
  return 'waiting'
}

function buildNextAction(detail, pipeline) {
  const volunteerSummary = detail.volunteerReviewSummary || pipeline.volunteerReviewSummary || null
  if (volunteerSummary?.isRejected) return '志愿者审核未通过'
  if (volunteerSummary?.status === 'risk_flagged') return '志愿者标记内容风险'
  if (
    volunteerSummary &&
    (String(volunteerSummary.status || '').startsWith('awaiting_reviewer_') ||
      volunteerSummary.status === 'pending' ||
      volunteerSummary.status === 'not_started')
  ) {
    return volunteerSummary.label || '等待志愿者复核'
  }
  const runningStage = (pipeline.agentStages || []).find((stage) => normalizeStageState(stage.state) === 'running')
  if (runningStage) return runningStage.label
  if (normalizeStatus(detail.status) === 'ready') return '已可入训'
  if (normalizeStatus(detail.status) === 'failed') return '治理失败'
  return '等待系统处理'
}

function normalizePoint(raw = {}) {
  const area = raw.area || ''
  return {
    id: raw.id,
    jobId: raw.jobId || raw.job_id || '',
    location: raw.location || getLocationByAreaString(area),
    area,
    dialectLabel: raw.dialectLabel || raw.dialectSelfReport || raw.dialect_label || '待识别方言',
    type: normalizeContributionType(raw.type || raw.contentType || raw.content_type || '方言'),
    status: normalizeStatus(raw.status || raw.pipelineState),
    audioUrl: absolutizeUrl(raw.audioUrl || raw.audio_url || ''),
    transcriptSnippet: raw.transcriptSnippet || raw.transcript_snippet || '',
    qualityScore: raw.qualityScore ?? raw.quality_score ?? null,
    readySegmentCount: raw.readySegmentCount ?? raw.ready_segment_count ?? 0,
    createdAt: raw.createdAt || raw.created_at || '',
    nickname: raw.nickname || '匿名贡献者',
    content: raw.content || '',
    riskFlags: raw.riskFlags || [],
    reviewReason: raw.reviewReason || '',
    nextAction: raw.nextAction || '',
    sourceType: raw.sourceType || raw.source_type || '',
    contentType: normalizeContributionType(raw.contentType || raw.content_type || raw.type || '方言'),
    currentStageKey: raw.currentStageKey || '',
    currentStageLabel: raw.currentStageLabel || raw.currentStage || '',
    errorMessage: raw.errorMessage || '',
    volunteerReviews: raw.volunteerReviews || [],
    volunteerReviewSummary: raw.volunteerReviewSummary || null
  }
}

function mergePublicStages(agentStages = []) {
  const buckets = new Map([
    ['ingest', { key: 'ingest', label: '收录', agentName: '采集入口', state: 'waiting', confidence: null, note: '' }],
    ['clean', { key: 'clean', label: '清洗', agentName: '音频治理体', state: 'waiting', confidence: null, note: '' }],
    ['transcribe', { key: 'transcribe', label: '转写', agentName: '转写体', state: 'waiting', confidence: null, note: '' }],
    ['annotate', { key: 'annotate', label: '标注', agentName: '标注体', state: 'waiting', confidence: null, note: '' }],
    ['qa', { key: 'qa', label: '质检', agentName: '质检体', state: 'waiting', confidence: null, note: '' }],
    ['archive', { key: 'archive', label: '入库', agentName: '语料入库体', state: 'waiting', confidence: null, note: '' }]
  ])

  const keyMap = {
    intake_agent: 'ingest',
    subtitle_source_agent: 'clean',
    audio_prep_agent: 'clean',
    transcription_agent: 'transcribe',
    llm_proofread_agent: 'annotate',
    segmentation_agent: 'annotate',
    mandarin_filter_agent: 'qa',
    metadata_writer_agent: 'archive'
  }

  const rank = { waiting: 0, complete: 1, running: 2, review: 3, failed: 4 }

  agentStages.forEach((stage) => {
    const bucketKey = keyMap[stage.key]
    if (!bucketKey) return
    const bucket = buckets.get(bucketKey)
    const state = normalizeStageState(stage.state)
    if (rank[state] >= rank[bucket.state]) {
      bucket.state = state
      bucket.confidence = stage.confidence ?? bucket.confidence
      bucket.note = stage.note || bucket.note
    }
  })

  return [...buckets.values()]
}

function buildInternalStages(agentStages = [], reviewTasks = [], volunteerSummary = null) {
  const stageByKey = new Map(agentStages.map((stage) => [stage.key, stage]))
  const volunteerPending = Boolean(
    volunteerSummary &&
    !volunteerSummary.isPassed &&
    (String(volunteerSummary.status || '').startsWith('awaiting_reviewer_') ||
      volunteerSummary.status === 'pending' ||
      volunteerSummary.status === 'not_started' ||
      volunteerSummary.status === 'risk_flagged' ||
      volunteerSummary.isRejected)
  )
  return [
    mapInternalStage('geo-normalize', '地理归一', stageByKey.get('intake_agent')),
    mapInternalStage('denoise-vad', '降噪 / VAD', stageByKey.get('audio_prep_agent') || stageByKey.get('subtitle_source_agent')),
    mapInternalStage('asr', 'ASR', stageByKey.get('transcription_agent')),
    mapInternalStage('dialect-id', '方言识别', stageByKey.get('llm_proofread_agent')),
    mapInternalStage('segment', '切分', stageByKey.get('segmentation_agent')),
    mapInternalStage('normalize-text', '文本规范化', stageByKey.get('llm_proofread_agent')),
    mapInternalStage('safety-check', '去重脱敏 / 授权检查', stageByKey.get('mandarin_filter_agent')),
    {
      key: 'human-review',
      label: '志愿者复核',
      state: volunteerPending ? 'review' : volunteerSummary?.isPassed ? 'complete' : 'waiting',
      note: volunteerPending ? volunteerSummary?.label || '等待志愿者复核' : volunteerSummary?.isPassed ? '志愿者审核已通过。' : ''
    }
  ]
}

function mapInternalStage(key, label, source) {
  return {
    key,
    label,
    state: normalizeStageState(source?.state),
    note: source?.note || ''
  }
}

function normalizePipeline(raw = {}, detail = null) {
  const agentStages = (raw.agentStages || raw.stages || []).map((stage) => ({
    key: stage.key,
    label: stage.label,
    agentName: stage.agentName || stage.agent_name || '',
    state: normalizeStageState(stage.state),
    confidence: stage.confidence ?? null,
    note: stage.note || '',
    startedAt: stage.startedAt || '',
    endedAt: stage.endedAt || '',
    artifacts: stage.artifacts || {},
    metadata: stage.metadata || {}
  }))
  const reviewTasks = raw.reviewTasks || detail?.reviewTasks || []
  const volunteerSummary = detail?.volunteerReviewSummary || raw.volunteerReviewSummary || null
  return {
    contributionId: raw.contributionId || detail?.id || '',
    jobId: raw.jobId || detail?.jobId || '',
    stages: mergePublicStages(agentStages),
    internalStages: buildInternalStages(agentStages, reviewTasks, volunteerSummary),
    agentStages,
    reviewTasks,
    volunteerReviewSummary: volunteerSummary
  }
}

function normalizeOverview(raw = {}) {
  return {
    totalContributions: raw.totalContributions ?? 0,
    processingCount: raw.processingCount ?? 0,
    readyCount: raw.readyCount ?? 0,
    newCount: raw.newCount ?? 0,
    reviewCount: raw.reviewCount ?? 0,
    regionCoverage: raw.regionCoverage ?? 0,
    newLast24h: raw.newLast24h ?? 0,
    readyRate: raw.readyRate ?? 0,
    highlightSentence: raw.highlightSentence || '每一段乡音，都有坐标、状态与去向。'
  }
}

function normalizeMetrics(raw = {}) {
  return {
    throughput24h: raw.throughput24h ?? 0,
    reviewQueueCount: raw.reviewQueueCount ?? 0,
    failedCount: raw.failedCount ?? 0,
    stages: Array.isArray(raw.stages) ? raw.stages : []
  }
}

export async function fetchMapOverview() {
  return normalizeOverview(await requestJson('/api/map/overview'))
}

export async function fetchMapPoints(filters = {}) {
  const data = await requestJson(`/api/map/points${buildQuery(filters)}`)
  return (Array.isArray(data) ? data : []).map((item) => normalizePoint(item))
}

export async function createContribution(formData) {
  const data = await requestJson('/api/contributions', { method: 'POST', body: formData })
  return {
    ...data,
    id: data.id || data.contributionId || '',
    contributionId: data.contributionId || data.id || ''
  }
}

export async function fetchContribution(id) {
  const data = await requestJson(`/api/contributions/${id}`)
  const detail = normalizePoint(data)
  detail.reviewReason = (data.reviewTasks || []).find((task) => task.status === 'pending')?.reason || detail.reviewReason
  detail.riskFlags = data.riskFlags || []
  detail.reviewTasks = data.reviewTasks || []
  detail.currentStageKey = data.currentStageKey || detail.currentStageKey
  detail.currentStageLabel = data.currentStageLabel || detail.currentStageLabel
  detail.errorMessage = data.errorMessage || detail.errorMessage
  detail.assets = (data.assets || []).map((asset) => ({
    ...asset,
    url: absolutizeUrl(asset.url || asset.path || '')
  }))
  detail.userTranscript = data.userTranscript || ''
  detail.asrTranscript = data.asrTranscript || ''
  detail.transcriptSource = data.transcriptSource || ''
  detail.volunteerReviews = data.volunteerReviews || []
  detail.volunteerReviewSummary = data.volunteerReviewSummary || null
  return detail
}

export async function fetchContributionPipeline(id) {
  const [detail, pipeline] = await Promise.all([
    requestJson(`/api/contributions/${id}`),
    requestJson(`/api/contributions/${id}/pipeline`)
  ])
  const normalizedDetail = normalizePoint(detail)
  const normalizedPipeline = normalizePipeline(pipeline, detail)
  normalizedPipeline.nextAction = buildNextAction(detail, normalizedPipeline)
  normalizedPipeline.reviewReason =
    (detail.reviewTasks || []).find((task) => task.status === 'pending')?.reason ||
    normalizedDetail.reviewReason
  return normalizedPipeline
}

export async function applyVolunteer(payload) {
  return requestJson('/api/volunteer-applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

export async function submitVolunteerReview(id, payload) {
  return requestJson(`/api/contributions/${id}/volunteer-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
}

export async function fetchPipelineMetrics() {
  return normalizeMetrics(await requestJson('/api/pipeline/metrics'))
}

function normalizeContributionRow(raw = {}) {
  const area = raw.area || ''
  return {
    id: raw.id,
    jobId: raw.jobId || '',
    createdAt: raw.createdAt || '',
    updatedAt: raw.updatedAt || '',
    area,
    location: getLocationByAreaString(area),
    dialectLabel: raw.dialectLabel || '待识别方言',
    sourceType: raw.sourceType || '',
    type: normalizeContributionType(raw.type || '方言'),
    status: normalizeStatus(raw.status),
    currentStageKey: raw.currentStageKey || '',
    currentStage: raw.currentStage || '待处理',
    readySegmentCount: raw.readySegmentCount ?? 0,
    qualityScore: raw.qualityScore ?? null,
    nickname: raw.nickname || '匿名贡献者',
    hasReview: Boolean(raw.hasReview),
    reviewReason: raw.reviewReason || '',
    reviewCount: raw.reviewCount ?? 0,
    pendingReviewCount: raw.pendingReviewCount ?? 0,
    transcriptSnippet: raw.transcriptSnippet || '',
    content: raw.content || '',
    volunteerReviewStatus: raw.volunteerReviewStatus || 'not_started',
    volunteerReviewCount: raw.volunteerReviewCount ?? 0,
    volunteerNextReviewerNumber: raw.volunteerNextReviewerNumber ?? null
  }
}

export async function fetchContributionRows(filters = {}) {
  const data = await requestJson(`/api/contributions${buildQuery(filters)}`)
  return {
    items: Array.isArray(data.items) ? data.items.map((item) => normalizeContributionRow(item)) : [],
    total: data.total ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? filters.pageSize ?? 20
  }
}

export async function fetchContributionSegments(id) {
  const data = await requestJson(`/api/contributions/${id}/segments`)
  return (Array.isArray(data) ? data : []).map((item) => ({
    id: item.id,
    clipId: item.clipId || item.clip_id || '',
    text: item.text || '',
    wavPath: item.wavPath || item.wav_path || '',
    wavUrl: absolutizeUrl(item.wavUrl || item.wav_url || ''),
    txtPath: item.txtPath || item.txt_path || '',
    startSec: item.startSec ?? item.start_sec ?? 0,
    endSec: item.endSec ?? item.end_sec ?? 0,
    status: item.status || 'ready'
  }))
}

export async function fetchTrainingDialects() {
  const data = await requestJson('/api/training/dialects')
  return {
    recommendedClips: data.recommendedClips ?? 0,
    minClips: data.minClips ?? 0,
    realTrainingEnabled: Boolean(data.realTrainingEnabled),
    dialects: Array.isArray(data.dialects) ? data.dialects : []
  }
}

export async function startTrainingJob(dialectKey) {
  return requestJson('/api/training/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dialectKey })
  })
}

export async function fetchTrainingJob(jobId) {
  return requestJson(`/api/training/jobs/${jobId}`)
}

export async function fetchTrainingJobLog(jobId) {
  const data = await requestJson(`/api/training/jobs/${jobId}/log`)
  return data.log || ''
}

export function trainingWeightsUrl(jobId) {
  return toApiUrl(`/api/training/jobs/${jobId}/weights`)
}
