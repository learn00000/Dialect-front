import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { MAP_REGION_TREE } from '../data/map-regions.js'
import {
  CONTENT_TYPES,
  EMPTY_OVERVIEW,
  EMPTY_PIPELINE_METRICS,
  LAYER_OPTIONS,
  getLayerFromStatus,
  isPointInLayer,
  parseArea,
  summarizeFilterText
} from '../data/dialect-map-config.js'
import {
  createContribution,
  fetchContribution,
  fetchContributionPipeline,
  fetchMapOverview,
  fetchMapPoints,
  fetchPipelineMetrics
} from '../services/dialect-map-api.js'

const POLL_MS = 6000

function createOverviewState() {
  return { ...EMPTY_OVERVIEW }
}

function createPipelineMetricState() {
  return {
    ...EMPTY_PIPELINE_METRICS,
    stages: EMPTY_PIPELINE_METRICS.stages.map((stage) => ({ ...stage }))
  }
}

export function useDialectMap() {
  const scene = ref('public')
  const activeLayer = ref('processing')
  const regionFilters = reactive({
    province: '',
    city: '',
    district: ''
  })
  const selectedTypes = ref([])

  const regionTree = MAP_REGION_TREE
  const layerOptions = LAYER_OPTIONS
  const contentTypes = CONTENT_TYPES

  const overview = ref(createOverviewState())
  const pipelineMetrics = ref(createPipelineMetricState())
  const points = ref([])
  const selectedPointId = ref('')
  const selectedPoint = ref(null)
  const selectedPipeline = ref(null)
  const focusPointToken = ref('')

  const loading = reactive({
    overview: false,
    points: false,
    metrics: false,
    detail: false,
    submit: false
  })

  const cityOptions = computed(() => {
    const province = regionTree.find((item) => item.name === regionFilters.province)
    return province?.cities || []
  })

  const districtOptions = computed(() => {
    const city = cityOptions.value.find((item) => item.name === regionFilters.city)
    return city?.districts || []
  })

  const selectedLayerMeta = computed(
    () => layerOptions.find((item) => item.key === activeLayer.value) || layerOptions[1]
  )

  const filterSummary = computed(() =>
    summarizeFilterText(regionFilters, selectedTypes.value)
  )

  const selectedPointQuickView = computed(() => {
    if (selectedPoint.value) return selectedPoint.value
    return points.value.find((point) => String(point.id) === String(selectedPointId.value)) || null
  })

  function setScene(nextScene) {
    scene.value = nextScene
  }

  function setLayer(layerKey) {
    activeLayer.value = layerKey
  }

  function setProvince(province) {
    regionFilters.province = province
    regionFilters.city = ''
    regionFilters.district = ''
  }

  function setCity(city) {
    regionFilters.city = city
    regionFilters.district = ''
  }

  function setDistrict(district) {
    regionFilters.district = district
  }

  function toggleType(type) {
    const next = new Set(selectedTypes.value)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    selectedTypes.value = [...next]
  }

  function selectPoint(pointId, options = {}) {
    if (!pointId) {
      selectedPointId.value = ''
      selectedPoint.value = null
      selectedPipeline.value = null
      return
    }
    selectedPointId.value = String(pointId)
    if (options.scene !== false) {
      scene.value = 'workbench'
    }
    if (options.focus !== false) {
      focusPointToken.value = `${pointId}:${Date.now()}`
    }
  }

  function closeInspector() {
    selectedPointId.value = ''
    selectedPoint.value = null
    selectedPipeline.value = null
  }

  function buildPointQuery() {
    return {
      layer: activeLayer.value,
      province: regionFilters.province,
      city: regionFilters.city,
      district: regionFilters.district,
      type: selectedTypes.value
    }
  }

  async function loadOverview() {
    loading.overview = true
    try {
      overview.value = await fetchMapOverview()
    } finally {
      loading.overview = false
    }
  }

  async function loadPoints() {
    loading.points = true
    try {
      points.value = await fetchMapPoints(buildPointQuery())
    } finally {
      loading.points = false
    }
  }

  async function loadMetrics() {
    loading.metrics = true
    try {
      pipelineMetrics.value = await fetchPipelineMetrics()
    } finally {
      loading.metrics = false
    }
  }

  async function loadSelectedPoint(pointId = selectedPointId.value) {
    if (!pointId) {
      selectedPoint.value = null
      selectedPipeline.value = null
      return
    }
    loading.detail = true
    try {
      const [detail, pipeline] = await Promise.all([
        fetchContribution(pointId),
        fetchContributionPipeline(pointId)
      ])
      detail.nextAction = pipeline.nextAction || detail.nextAction || ''
      detail.reviewReason = pipeline.reviewReason || detail.reviewReason || ''
      selectedPoint.value = detail
      selectedPipeline.value = pipeline
    } finally {
      loading.detail = false
    }
  }

  function pointMatchesFilters(point) {
    if (!point) return false
    if (!isPointInLayer(point, activeLayer.value)) return false
    if (selectedTypes.value.length && !selectedTypes.value.includes(point.type)) return false

    const area = parseArea(point.area)
    if (regionFilters.province && area.province !== regionFilters.province) return false
    if (regionFilters.city && area.city !== regionFilters.city) return false
    if (regionFilters.district && area.district !== regionFilters.district) return false
    return true
  }

  function upsertPoint(point) {
    const list = [...points.value]
    const index = list.findIndex((item) => String(item.id) === String(point.id))
    if (pointMatchesFilters(point)) {
      if (index >= 0) list.splice(index, 1, point)
      else list.unshift(point)
    } else if (index >= 0) {
      list.splice(index, 1)
    }
    points.value = list
  }

  async function refreshDashboard(options = {}) {
    const includeSelection = options.selection ?? Boolean(selectedPointId.value)
    try {
      await Promise.all([loadOverview(), loadPoints(), loadMetrics()])
      if (includeSelection && selectedPointId.value) {
        await loadSelectedPoint()
      }
    } catch (error) {
      console.error(error)
      if (!options.silent) {
        window.alert(error.message || '地图数据加载失败')
      }
    }
  }

  async function submitContribution(payload) {
    loading.submit = true
    try {
      const formData = new FormData()
      formData.append('file', payload.file)
      formData.append('area', payload.area)
      formData.append('dialectSelfReport', payload.dialectSelfReport)
      formData.append('type', payload.type)
      formData.append('content', payload.content || '')
      formData.append('nickname', payload.nickname || '新贡献者')
      formData.append('consentGranted', payload.consentGranted ? 'true' : 'false')

      const data = await createContribution(formData)
      const point = data.point || null
      const nextId = point?.id || data.id

      if (point) {
        setLayer(getLayerFromStatus(point.status))
        upsertPoint(point)
      } else {
        setLayer('processing')
      }

      scene.value = 'workbench'
      if (nextId) {
        selectPoint(nextId)
      }

      await Promise.all([loadOverview(), loadPoints(), loadMetrics()])
      if (nextId) {
        await loadSelectedPoint(nextId)
      }
      return data
    } catch (error) {
      console.error(error)
      window.alert(error.message || '上传失败')
      throw error
    } finally {
      loading.submit = false
    }
  }

  watch(
    [activeLayer, () => regionFilters.province, () => regionFilters.city, () => regionFilters.district, selectedTypes],
    () => {
      void loadPoints().catch((error) => {
        console.error(error)
        window.alert(error.message || '地图点位刷新失败')
      })
    }
  )

  watch(selectedPointId, (pointId) => {
    if (!pointId) {
      selectedPoint.value = null
      selectedPipeline.value = null
      return
    }
    void loadSelectedPoint(pointId).catch((error) => {
      console.error(error)
      window.alert(error.message || '样本详情加载失败')
    })
  })

  let pollTimer = null

  onMounted(() => {
    void refreshDashboard({ silent: false })
    pollTimer = window.setInterval(() => {
      void refreshDashboard({ silent: true })
    }, POLL_MS)
  })

  onBeforeUnmount(() => {
    if (pollTimer != null) {
      window.clearInterval(pollTimer)
      pollTimer = null
    }
  })

  return {
    scene,
    activeLayer,
    layerOptions,
    regionTree,
    contentTypes,
    regionFilters,
    cityOptions,
    districtOptions,
    selectedTypes,
    selectedLayerMeta,
    filterSummary,
    overview,
    pipelineMetrics,
    points,
    selectedPointId,
    selectedPoint,
    selectedPointQuickView,
    selectedPipeline,
    focusPointToken,
    loading,
    setScene,
    setLayer,
    setProvince,
    setCity,
    setDistrict,
    toggleType,
    selectPoint,
    closeInspector,
    refreshDashboard,
    submitContribution
  }
}
