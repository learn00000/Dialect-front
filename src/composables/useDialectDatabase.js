import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { MAP_REGION_TREE } from '../data/map-regions.js'
import { CONTENT_TYPES, EMPTY_OVERVIEW, EMPTY_PIPELINE_METRICS } from '../data/dialect-map-config.js'
import {
  applyVolunteer,
  fetchContribution,
  fetchContributionPipeline,
  fetchContributionRows,
  fetchContributionSegments,
  fetchMapOverview,
  fetchPipelineMetrics,
  fetchTrainingDialects,
  startTrainingJob,
  submitVolunteerReview as submitVolunteerReviewRequest
} from '../services/dialect-map-api.js'

function createOverviewState() {
  return { ...EMPTY_OVERVIEW }
}

function createPipelineMetricState() {
  return {
    ...EMPTY_PIPELINE_METRICS,
    stages: EMPTY_PIPELINE_METRICS.stages.map((stage) => ({ ...stage }))
  }
}

function createExpandedState() {
  return {
    loading: false,
    error: '',
    detail: null,
    pipeline: null,
    segments: []
  }
}

const POLL_MS = 12000
const WENZHOU_VOLUNTEER_BASE = {
  province: '浙江省',
  city: '温州市',
  district: '鹿城区',
  areaScope: '浙江省 / 温州市 / 鹿城区',
  status: 'approved'
}

const FIXED_VOLUNTEER_PROFILE = {
  reviewerName: '20050103',
  ...WENZHOU_VOLUNTEER_BASE
}

async function fetchCurrentMapContributionIds() {
  const response = await fetch('/api/map/points')
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.detail || payload.message || `地图点位加载失败 (${response.status})`)
  }
  const items = Array.isArray(payload) ? payload : Array.isArray(payload.data) ? payload.data : []
  return new Set(items.map((item) => String(item.id || '')).filter(Boolean))
}

export function useDialectDatabase() {
  const regionTree = MAP_REGION_TREE
  const contentTypes = CONTENT_TYPES
  const filters = reactive({
    search: '',
    province: '',
    city: '',
    district: '',
    type: '方言',
    status: '',
    sourceType: 'audio_upload',
    hasReview: '',
    sort: 'createdAt',
    order: 'desc',
    page: 1,
    pageSize: 12
  })

  const overview = ref(createOverviewState())
  const pipelineMetrics = ref(createPipelineMetricState())
  const rows = ref([])
  const total = ref(0)
  const selectedRowId = ref('')
  const expandedRowIds = ref([])
  const mapPanelOpen = ref(false)
  const expandedStateById = reactive({})
  const volunteerProfile = reactive({ ...FIXED_VOLUNTEER_PROFILE })

  const loading = reactive({
    rows: false,
    summary: false,
    create: false,
    volunteerApply: false,
    training: false
  })

  const trainingStats = ref({
    recommendedClips: 0,
    minClips: 0,
    realTrainingEnabled: false,
    dialects: []
  })

  const cityOptions = computed(() => {
    const province = regionTree.find((item) => item.name === filters.province)
    return province?.cities || []
  })

  const districtOptions = computed(() => {
    const city = cityOptions.value.find((item) => item.name === filters.city)
    return city?.districts || []
  })

  const selectedRow = computed(
    () => rows.value.find((item) => String(item.id) === String(selectedRowId.value)) || null
  )

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / filters.pageSize)))

  const mapRows = computed(() => rows.value)

  function ensureExpandedState(id) {
    if (!expandedStateById[id]) {
      expandedStateById[id] = createExpandedState()
    }
    return expandedStateById[id]
  }

  function buildListQuery() {
    return {
      search: filters.search,
      province: filters.province,
      city: filters.city,
      district: filters.district,
      type: '方言',
      status: filters.status,
      sourceType: 'audio_upload',
      hasReview: filters.hasReview,
      sort: filters.sort,
      order: filters.order,
      page: filters.page,
      pageSize: filters.pageSize
    }
  }

  async function loadRows(options = {}) {
    const { silent = false } = options
    if (!silent) {
      loading.rows = true
    }
    try {
      const [data, currentMapIds] = await Promise.all([
        fetchContributionRows({
          ...buildListQuery(),
          page: 1,
          pageSize: 1000
        }),
        fetchCurrentMapContributionIds()
      ])
      const activeItems = data.items.filter((item) => currentMapIds.has(String(item.id)))
      total.value = activeItems.length
      const maxPage = Math.max(1, Math.ceil(total.value / filters.pageSize))
      if (filters.page > maxPage) {
        filters.page = maxPage
      }
      const start = (filters.page - 1) * filters.pageSize
      const end = start + filters.pageSize
      rows.value = activeItems.slice(start, end)
      if (selectedRowId.value && !rows.value.some((row) => String(row.id) === String(selectedRowId.value))) {
        selectedRowId.value = rows.value[0]?.id || ''
      }
    } finally {
      if (!silent) {
        loading.rows = false
      }
    }
  }

  async function loadSummary(options = {}) {
    const { silent = false } = options
    if (!silent) {
      loading.summary = true
    }
    try {
      const [overviewData, metricsData] = await Promise.all([fetchMapOverview(), fetchPipelineMetrics()])
      overview.value = overviewData
      pipelineMetrics.value = metricsData
    } finally {
      if (!silent) {
        loading.summary = false
      }
    }
  }

  async function refreshDashboard(options = {}) {
    const { silent = false } = options
    await Promise.all([loadRows({ silent }), loadSummary({ silent })])
  }

  let trainingPollTimer = null

  function hasActiveTraining() {
    return (trainingStats.value.dialects || []).some((item) => {
      const status = item.latestJob?.status
      return status === 'running' || status === 'queued'
    })
  }

  function ensureTrainingPolling() {
    if (hasActiveTraining()) {
      if (trainingPollTimer == null) {
        trainingPollTimer = window.setInterval(() => {
          void loadTrainingStats({ silent: true }).catch((error) => console.error(error))
        }, 2500)
      }
    } else if (trainingPollTimer != null) {
      window.clearInterval(trainingPollTimer)
      trainingPollTimer = null
    }
  }

  async function loadTrainingStats(options = {}) {
    const { silent = false } = options
    if (!silent) {
      loading.training = true
    }
    try {
      trainingStats.value = await fetchTrainingDialects()
      ensureTrainingPolling()
    } finally {
      if (!silent) {
        loading.training = false
      }
    }
  }

  async function startTraining(dialectKey) {
    await startTrainingJob(dialectKey)
    await loadTrainingStats({ silent: true })
    ensureTrainingPolling()
  }

  function setFilter(key, value) {
    if (key === 'type') {
      filters.type = '方言'
      return
    }
    if (key === 'sourceType') {
      filters.sourceType = 'audio_upload'
      return
    }
    filters[key] = value
  }

  function setProvince(value) {
    filters.province = value
    filters.city = ''
    filters.district = ''
  }

  function setCity(value) {
    filters.city = value
    filters.district = ''
  }

  function setDistrict(value) {
    filters.district = value
  }

  function setPage(nextPage) {
    filters.page = Math.min(Math.max(1, nextPage), totalPages.value)
  }

  function selectRow(id) {
    selectedRowId.value = String(id || '')
  }

  async function expandRow(id, force = false) {
    const key = String(id)
    const state = ensureExpandedState(key)
    if (state.loading) return
    if (!force && state.detail && state.pipeline) return
    state.loading = true
    state.error = ''
    try {
      const [detail, pipeline, segments] = await Promise.all([
        fetchContribution(key),
        fetchContributionPipeline(key),
        fetchContributionSegments(key)
      ])
      detail.nextAction = pipeline.nextAction || detail.nextAction || ''
      detail.reviewReason = pipeline.reviewReason || detail.reviewReason || ''
      state.detail = detail
      state.pipeline = pipeline
      state.segments = segments
      const reviewerName = String(volunteerProfile.reviewerName || '').trim()
      if (reviewerName && Array.isArray(detail.volunteerReviews)) {
        for (const review of detail.volunteerReviews) {
          if (String(review.reviewer_name || '').trim() === reviewerName) {
            markVolunteerReviewed(reviewerName, key)
          }
        }
      }
    } catch (error) {
      console.error(error)
      state.error = error.message || '展开记录失败'
    } finally {
      state.loading = false
    }
  }

  async function toggleExpandRow(id) {
    const key = String(id)
    if (expandedRowIds.value.includes(key)) {
      expandedRowIds.value = expandedRowIds.value.filter((item) => item !== key)
      return
    }
    expandedRowIds.value = [key]
    selectRow(key)
    await expandRow(key)
  }

  async function openRow(id) {
    const key = String(id)
    selectRow(key)
    if (!expandedRowIds.value.includes(key)) {
      expandedRowIds.value = [key]
    }
    await expandRow(key)
  }

  const volunteerReviewedIds = reactive({})

  function loadReviewedIdsFromStorage(reviewerName) {
    const key = String(reviewerName || '').trim()
    if (!key) return new Set()
    try {
      const raw = sessionStorage.getItem(`vol-review:${key}`)
      return new Set(JSON.parse(raw || '[]').map(String))
    } catch {
      return new Set()
    }
  }

  function hasVolunteerReviewed(reviewerName, contributionId) {
    const key = String(reviewerName || '').trim()
    if (!key) return false
    if (!volunteerReviewedIds[key]) {
      volunteerReviewedIds[key] = loadReviewedIdsFromStorage(key)
    }
    return volunteerReviewedIds[key].has(String(contributionId))
  }

  function markVolunteerReviewed(reviewerName, contributionId) {
    const key = String(reviewerName || '').trim()
    if (!key) return
    if (!volunteerReviewedIds[key]) {
      volunteerReviewedIds[key] = loadReviewedIdsFromStorage(key)
    }
    volunteerReviewedIds[key].add(String(contributionId))
    sessionStorage.setItem(`vol-review:${key}`, JSON.stringify([...volunteerReviewedIds[key]]))
  }

  function updateVolunteerName(value) {
    const id = String(value || '').trim()
    volunteerProfile.reviewerName = id
    if (id) {
      Object.assign(volunteerProfile, WENZHOU_VOLUNTEER_BASE)
      if (!volunteerReviewedIds[id]) {
        volunteerReviewedIds[id] = loadReviewedIdsFromStorage(id)
      }
    } else {
      volunteerProfile.province = ''
      volunteerProfile.city = ''
      volunteerProfile.district = ''
      volunteerProfile.areaScope = ''
      volunteerProfile.status = ''
    }
  }

  function toggleMapPanel() {
    mapPanelOpen.value = !mapPanelOpen.value
  }

  async function applyVolunteerForCurrentScope() {
    Object.assign(volunteerProfile, FIXED_VOLUNTEER_PROFILE)
    filters.province = volunteerProfile.province
    filters.city = volunteerProfile.city
    filters.district = volunteerProfile.district
    filters.search = ''
    filters.status = ''
    filters.page = 1
    await loadRows()
    const firstRow = rows.value[0]
    if (firstRow) {
      await openRow(firstRow.id)
    } else {
      expandedRowIds.value = []
      selectedRowId.value = ''
    }
    return { ...FIXED_VOLUNTEER_PROFILE }
  }

  async function submitVolunteerReview(contributionId, payload) {
    // 自动注册志愿者（后端需要先有申请记录才能提交审核）
    await applyVolunteer({
      reviewerName: payload.reviewerName,
      province: volunteerProfile.province || '浙江省',
      city: volunteerProfile.city || '温州市',
      district: volunteerProfile.district || '鹿城区',
      areaScope: volunteerProfile.areaScope || '浙江省 / 温州市 / 鹿城区'
    }).catch(() => { /* 已申请过则忽略重复错误 */ })
    const result = await submitVolunteerReviewRequest(contributionId, payload)
    markVolunteerReviewed(payload.reviewerName, contributionId)
    const state = ensureExpandedState(String(contributionId))
    state.detail = result
    state.error = ''
    const pipeline = await fetchContributionPipeline(String(contributionId))
    state.pipeline = pipeline
    const rowIndex = rows.value.findIndex((item) => String(item.id) === String(contributionId))
    if (rowIndex >= 0) {
      const summary = result.volunteerReviewSummary || {}
      rows.value.splice(rowIndex, 1, {
        ...rows.value[rowIndex],
        status: result.status || rows.value[rowIndex].status,
        content: result.content,
        transcriptSnippet: result.transcriptSnippet,
        reviewReason: result.volunteerReviewSummary?.label || result.reviewReason || rows.value[rowIndex].reviewReason,
        hasReview: Boolean(result.reviewTasks?.length) || rows.value[rowIndex].hasReview,
        volunteerReviewStatus: summary.status || rows.value[rowIndex].volunteerReviewStatus,
        volunteerReviewCount: summary.totalReviews ?? rows.value[rowIndex].volunteerReviewCount,
        volunteerNextReviewerNumber: summary.nextReviewerNumber ?? rows.value[rowIndex].volunteerNextReviewerNumber,
        updatedAt: result.updatedAt || rows.value[rowIndex].updatedAt
      })
    }
    return result
  }

  watch(
    () => [filters.search, filters.province, filters.city, filters.district, filters.type, filters.status, filters.sourceType, filters.hasReview, filters.sort, filters.order],
    () => {
      filters.page = 1
      void loadRows().catch((error) => {
        console.error(error)
        window.alert(error.message || '记录列表加载失败')
      })
    }
  )

  watch(
    () => [filters.page, filters.pageSize],
    () => {
      void loadRows().catch((error) => {
        console.error(error)
        window.alert(error.message || '记录列表加载失败')
      })
    }
  )

  let pollTimer = null

  onMounted(() => {
    Object.assign(volunteerProfile, FIXED_VOLUNTEER_PROFILE)
    if (volunteerProfile.reviewerName) {
      volunteerReviewedIds[volunteerProfile.reviewerName] = loadReviewedIdsFromStorage(volunteerProfile.reviewerName)
    }
    void refreshDashboard().then(() => {
      if (!selectedRowId.value && rows.value[0]) {
        selectedRowId.value = rows.value[0].id
      }
    }).catch((error) => {
      console.error(error)
      window.alert(error.message || '数据库数据加载失败')
    })
    void loadTrainingStats({ silent: true }).catch((error) => console.error(error))
    pollTimer = window.setInterval(() => {
      void refreshDashboard({ silent: true }).catch((error) => {
        console.error(error)
      })
      void loadTrainingStats({ silent: true }).catch((error) => console.error(error))
    }, POLL_MS)
  })

  onBeforeUnmount(() => {
    if (pollTimer != null) {
      window.clearInterval(pollTimer)
      pollTimer = null
    }
    if (trainingPollTimer != null) {
      window.clearInterval(trainingPollTimer)
      trainingPollTimer = null
    }
  })

  return {
    regionTree,
    contentTypes,
    filters,
    cityOptions,
    districtOptions,
    overview,
    pipelineMetrics,
    rows,
    total,
    totalPages,
    selectedRowId,
    selectedRow,
    expandedRowIds,
    expandedStateById,
    mapRows,
    mapPanelOpen,
    volunteerProfile,
    loading,
    setFilter,
    setProvince,
    setCity,
    setDistrict,
    setPage,
    selectRow,
    toggleExpandRow,
    openRow,
    updateVolunteerName,
    hasVolunteerReviewed,
    toggleMapPanel,
    applyVolunteerForCurrentScope,
    submitVolunteerReview,
    refreshDashboard,
    expandRow,
    trainingStats,
    loadTrainingStats,
    startTraining
  }
}
