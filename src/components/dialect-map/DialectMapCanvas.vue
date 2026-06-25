<template>
  <section
    class="relative flex h-full min-h-[24rem] flex-col overflow-hidden rounded-[2rem] border border-[rgba(47,143,131,0.16)] bg-[linear-gradient(180deg,rgba(232,242,240,0.75)_0%,rgba(219,233,230,0.88)_100%)] shadow-[0_18px_46px_rgba(22,88,85,0.11)]"
  >
    <div class="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.82)_0%,transparent_32%),radial-gradient(circle_at_82%_22%,rgba(126,212,206,0.18)_0%,transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.28)_0%,transparent_58%)]" />
    <div class="absolute inset-x-0 top-0 z-10 flex flex-col gap-3 px-4 pt-4 sm:px-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="rounded-[1.35rem] border border-white/70 bg-white/78 px-4 py-3 shadow-[0_10px_24px_rgba(22,88,85,0.08)] backdrop-blur-md">
          <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2a726d]">
            {{ scene === 'public' ? '山河经纬' : '工作台地图' }}
          </div>
          <div class="mt-1 text-sm font-semibold text-[#123b39]">
            {{ scene === 'public' ? '方言数据流域' : '地图图层与点位状态' }}
          </div>
          <p class="mt-1 text-xs leading-5 text-[#607a77]">{{ filterSummary }}</p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="layer in layerOptions"
            :key="layer.key"
            type="button"
            class="rounded-full border px-3 py-2 text-xs font-semibold transition"
            :class="
              activeLayer === layer.key
                ? 'border-[#2f8f83] bg-[#dff5f2] text-[#174a47] shadow-[0_8px_18px_rgba(47,143,131,0.16)]'
                : 'border-white/70 bg-white/78 text-[#607a77] hover:border-[#2f8f83]'
            "
            @click="$emit('set-layer', layer.key)"
          >
            {{ layer.label }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="rounded-full bg-white/78 px-3 py-1.5 text-xs font-medium text-[#32514e] shadow-sm">
          当前图层 {{ activeLayerLabel }}
        </div>
        <div class="rounded-full bg-white/78 px-3 py-1.5 text-xs font-medium text-[#32514e] shadow-sm">
          地图点位 {{ points.length }}
        </div>
        <button
          v-if="scene === 'public'"
          type="button"
          class="rounded-full bg-[linear-gradient(135deg,#7ed4ce_0%,#3a8f8a_60%,#184f4b_100%)] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_10px_18px_rgba(22,88,85,0.18)]"
          @click="$emit('enter-workbench')"
        >
          我要上传乡音
        </button>
      </div>
    </div>

    <div ref="mapContainerRef" class="absolute inset-3 z-0 overflow-hidden rounded-[1.7rem]" />

    <div class="absolute inset-x-0 bottom-0 z-10 px-4 pb-4 sm:px-5">
      <div class="grid gap-3 lg:grid-cols-[1.25fr_0.95fr]">
        <div class="rounded-[1.35rem] border border-white/70 bg-white/78 px-4 py-3 shadow-[0_10px_24px_rgba(22,88,85,0.08)] backdrop-blur-md">
          <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2a726d]">标记规则</div>
          <div class="mt-3 flex flex-wrap gap-3 text-xs text-[#4f6a68]">
            <span class="inline-flex items-center gap-2">
              <span class="legend-dot legend-dot--new" />
              外环表示治理阶段
            </span>
            <span class="inline-flex items-center gap-2">
              <span class="legend-dot legend-dot--fill" />
              填充颜色表示内容类型
            </span>
            <span class="inline-flex items-center gap-2">
              <span class="legend-dot legend-dot--pulse" />
              脉冲代表处理中
            </span>
          </div>
        </div>

        <div class="rounded-[1.35rem] border border-white/70 bg-white/78 px-4 py-3 shadow-[0_10px_24px_rgba(22,88,85,0.08)] backdrop-blur-md">
          <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2a726d]">地图交互</div>
          <p class="mt-2 text-xs leading-6 text-[#4f6a68]">
            点击聚类可放大到局部，点击单点打开档案卡；点击空白处会选中当前图层内最近的点位。
          </p>
        </div>
      </div>
    </div>

    <div
      v-if="mapLoading"
      class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/34 backdrop-blur-[2px]"
    >
      <div class="rounded-2xl border border-[rgba(47,143,131,0.14)] bg-white/92 px-5 py-3 text-sm text-[#355451] shadow-[0_12px_24px_rgba(22,88,85,0.1)]">
        地图底图加载中…
      </div>
    </div>

    <div
      v-else-if="loading"
      class="pointer-events-none absolute inset-x-0 top-24 z-20 mx-auto w-fit rounded-full border border-[rgba(47,143,131,0.14)] bg-white/92 px-4 py-2 text-xs font-medium text-[#355451] shadow-[0_10px_20px_rgba(22,88,85,0.08)]"
    >
      数据刷新中…
    </div>

    <div
      v-if="!mapLoading && !points.length"
      class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6"
    >
      <div class="max-w-sm rounded-[1.6rem] border border-white/70 bg-white/84 px-6 py-5 text-center shadow-[0_16px_34px_rgba(22,88,85,0.08)] backdrop-blur-md">
        <div class="text-sm font-semibold text-[#123b39]">当前筛选下还没有点亮的乡音</div>
        <p class="mt-2 text-xs leading-6 text-[#607a77]">可以切换图层、放宽地区筛选，或者上传一段新的方言样本。</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  formatPercent,
  getTypeMeta
} from '../../data/dialect-map-config.js'

const AMAP_KEY = 'c7c2b7231fb6ed1d7ac88eb83c7d86c2'
const MAP_CLICK_PICK_MAX_M = 280_000

const props = defineProps({
  points: {
    type: Array,
    required: true
  },
  selectedPointId: {
    type: [String, Number],
    default: ''
  },
  focusPointToken: {
    type: String,
    default: ''
  },
  activeLayer: {
    type: String,
    required: true
  },
  layerOptions: {
    type: Array,
    required: true
  },
  scene: {
    type: String,
    required: true
  },
  filterSummary: {
    type: String,
    default: '全国 · 全部类型'
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select-point', 'set-layer', 'enter-workbench'])

const mapContainerRef = ref(null)
const mapLoading = ref(true)
const mapInstance = shallowRef(null)
const overlays = shallowRef([])

let lastOverlayClickAt = 0
let rerenderQueued = false

const activeLayerLabel = computed(() => {
  return props.layerOptions.find((item) => item.key === props.activeLayer)?.label || '治理中'
})

function loadAmapScript() {
  if (window.AMap) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const callbackName = `__amap_live_cb_${Date.now()}`
    window[callbackName] = () => {
      resolve()
      delete window[callbackName]
    }
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.Scale,AMap.ToolBar,AMap.Geolocation&callback=${callbackName}`
    script.onerror = () => reject(new Error('高德地图脚本加载失败'))
    document.head.appendChild(script)
  })
}

function haversineMeters(lng1, lat1, lng2, lat2) {
  const R = 6371000
  const toRad = (value) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function readEventLngLat(event) {
  const lnglat = event?.lnglat
  if (!lnglat) return null
  if (typeof lnglat.getLng === 'function' && typeof lnglat.getLat === 'function') {
    return { lng: lnglat.getLng(), lat: lnglat.getLat() }
  }
  if (typeof lnglat.lng === 'number' && typeof lnglat.lat === 'number') {
    return { lng: lnglat.lng, lat: lnglat.lat }
  }
  return null
}

function estimatePointReadiness(point) {
  if (!point) return 0
  if (point.status === 'ready') return 1
  if (point.status === 'review') return 0.7
  if (point.status === 'processing') return 0.46
  return 0.15
}

function findNearestPoint(lng, lat) {
  let best = null
  let bestDistance = Infinity
  for (const point of props.points) {
    const plng = point?.location?.lng
    const plat = point?.location?.lat
    if (typeof plng !== 'number' || typeof plat !== 'number') continue
    const distance = haversineMeters(lng, lat, plng, plat)
    if (distance < bestDistance) {
      bestDistance = distance
      best = point
    }
  }
  if (!best || bestDistance > MAP_CLICK_PICK_MAX_M) return null
  return best
}

function clearOverlays() {
  const map = mapInstance.value
  if (map && overlays.value.length) {
    map.remove(overlays.value)
  }
  overlays.value = []
}

function getClusterGridSize(zoom) {
  if (zoom <= 5) return 90
  if (zoom <= 7) return 74
  if (zoom <= 9) return 60
  if (zoom <= 11) return 48
  return 40
}

function buildClusters(list) {
  const map = mapInstance.value
  if (!map || !window.AMap) return []

  const gridSize = getClusterGridSize(map.getZoom())
  const buckets = new Map()

  list.forEach((point) => {
    const lng = point?.location?.lng
    const lat = point?.location?.lat
    if (typeof lng !== 'number' || typeof lat !== 'number') return
    const pixel = map.lngLatToContainer([lng, lat])
    if (!pixel) return
    const key = `${Math.floor(pixel.x / gridSize)}:${Math.floor(pixel.y / gridSize)}`
    if (!buckets.has(key)) {
      buckets.set(key, [])
    }
    buckets.get(key).push(point)
  })

  return [...buckets.values()].map((group) => {
    const lng = group.reduce((sum, point) => sum + point.location.lng, 0) / group.length
    const lat = group.reduce((sum, point) => sum + point.location.lat, 0) / group.length
    const readiness =
      group.reduce((sum, point) => sum + estimatePointReadiness(point), 0) / group.length
    return {
      id: group.map((point) => point.id).join(','),
      lng,
      lat,
      points: group,
      readiness
    }
  })
}

function createPointMarker(point) {
  const markerRoot = document.createElement('button')
  markerRoot.type = 'button'
  markerRoot.className = `node-marker node-marker--${point.status === 'review' ? 'review' : point.status}`
  markerRoot.setAttribute('aria-label', point.area || '方言点位')
  if (String(point.id) === String(props.selectedPointId)) {
    markerRoot.classList.add('is-selected')
  }
  const typeMeta = getTypeMeta(point.type)
  markerRoot.style.setProperty('--node-color', typeMeta.color)
  markerRoot.style.setProperty('--node-glow', typeMeta.glow)
  markerRoot.innerHTML = `
    <span class="node-marker__pulse"></span>
    <span class="node-marker__halo"></span>
    <span class="node-marker__core"></span>
  `

  const marker = new window.AMap.Marker({
    position: [point.location.lng, point.location.lat],
    offset: new window.AMap.Pixel(-18, -18),
    anchor: 'center',
    content: markerRoot,
    title: point.area
  })

  marker.on('click', () => {
    lastOverlayClickAt = Date.now()
    emit('select-point', point.id)
  })
  return marker
}

function createClusterMarker(cluster) {
  const markerRoot = document.createElement('button')
  markerRoot.type = 'button'
  markerRoot.className = 'cluster-marker'
  markerRoot.innerHTML = `
    <span class="cluster-marker__count">${cluster.points.length}</span>
    <span class="cluster-marker__rate">${formatPercent(cluster.readiness)}</span>
  `

  const marker = new window.AMap.Marker({
    position: [cluster.lng, cluster.lat],
    offset: new window.AMap.Pixel(-28, -28),
    anchor: 'center',
    content: markerRoot
  })

  marker.on('click', () => {
    lastOverlayClickAt = Date.now()
    const map = mapInstance.value
    if (!map) return
    const nextZoom = Math.min(map.getZoom() + 2, 15)
    map.setZoomAndCenter(nextZoom, [cluster.lng, cluster.lat], true)
  })

  return marker
}

function renderPoints() {
  const map = mapInstance.value
  if (!map || !window.AMap) return
  clearOverlays()
  const clusters = buildClusters(props.points)
  const nextOverlays = clusters.map((cluster) => {
    if (cluster.points.length === 1) {
      return createPointMarker(cluster.points[0])
    }
    return createClusterMarker(cluster)
  })
  if (nextOverlays.length) {
    map.add(nextOverlays)
  }
  overlays.value = nextOverlays
}

function queueRender() {
  if (rerenderQueued) return
  rerenderQueued = true
  window.requestAnimationFrame(() => {
    rerenderQueued = false
    renderPoints()
  })
}

function focusSelectedPoint() {
  const map = mapInstance.value
  if (!map || !props.selectedPointId) return
  const target = props.points.find((point) => String(point.id) === String(props.selectedPointId))
  if (!target?.location) return
  map.setZoomAndCenter(Math.max(map.getZoom(), 8), [target.location.lng, target.location.lat], true)
}

async function initMap() {
  mapLoading.value = true
  try {
    await loadAmapScript()
    await nextTick()
    const element = mapContainerRef.value
    if (!element) return
    const map = new window.AMap.Map(element, {
      zoom: 5,
      center: [108.55, 34.32],
      viewMode: '2D',
      mapStyle: 'amap://styles/whitesmoke'
    })
    map.addControl(new window.AMap.Scale())
    map.addControl(new window.AMap.ToolBar({ position: { right: 14, top: 130 } }))
    map.on('click', (event) => {
      if (Date.now() - lastOverlayClickAt < 220) return
      const position = readEventLngLat(event)
      if (!position) return
      const nearest = findNearestPoint(position.lng, position.lat)
      if (nearest) {
        emit('select-point', nearest.id)
      }
    })
    map.on('zoomend', queueRender)
    map.on('moveend', queueRender)
    mapInstance.value = map
    renderPoints()
  } catch (error) {
    console.error(error)
    window.alert('地图初始化失败，请检查 Key、网络或高德安全密钥配置。')
  } finally {
    mapLoading.value = false
  }
}

watch(
  () => props.points,
  () => {
    queueRender()
  },
  { deep: true }
)

watch(
  () => props.selectedPointId,
  () => {
    queueRender()
  }
)

watch(
  () => props.focusPointToken,
  () => {
    focusSelectedPoint()
  }
)

watch(
  () => props.activeLayer,
  () => {
    queueRender()
  }
)

onMounted(() => {
  void initMap()
})

onBeforeUnmount(() => {
  clearOverlays()
  if (mapInstance.value) {
    mapInstance.value.destroy()
    mapInstance.value = null
  }
})
</script>

<style scoped>
.legend-dot {
  position: relative;
  display: inline-flex;
  height: 0.95rem;
  width: 0.95rem;
  border-radius: 999px;
}

.legend-dot--new {
  background: #dff5f2;
  border: 2px solid #2f8f83;
}

.legend-dot--fill {
  background: #c66b4b;
  border: 2px solid rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 0 2px rgba(198, 107, 75, 0.18);
}

.legend-dot--pulse {
  background: #5b8fd6;
}

.legend-dot--pulse::after {
  content: '';
  position: absolute;
  inset: -0.3rem;
  border-radius: inherit;
  border: 1px solid rgba(91, 143, 214, 0.35);
}

:deep(.node-marker) {
  position: relative;
  display: block;
  height: 2.25rem;
  width: 2.25rem;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

:deep(.node-marker__pulse),
:deep(.node-marker__halo),
:deep(.node-marker__core) {
  position: absolute;
  inset: 0;
  border-radius: 999px;
}

:deep(.node-marker__pulse) {
  inset: -0.38rem;
  opacity: 0;
}

:deep(.node-marker__halo) {
  border: 2px solid rgba(255, 255, 255, 0.88);
  box-shadow: 0 0 0 5px var(--node-glow);
}

:deep(.node-marker__core) {
  inset: 0.34rem;
  background: var(--node-color);
  border: 2px solid rgba(255, 255, 255, 0.92);
  box-shadow: 0 10px 16px rgba(19, 59, 57, 0.16);
}

:deep(.node-marker--new .node-marker__halo) {
  box-shadow: 0 0 0 5px rgba(47, 143, 131, 0.18);
}

:deep(.node-marker--processing .node-marker__pulse),
:deep(.node-marker--review .node-marker__pulse) {
  border: 1px solid rgba(91, 143, 214, 0.38);
  animation: mapPulse 1.9s ease-out infinite;
}

:deep(.node-marker--review .node-marker__pulse) {
  border-color: rgba(214, 150, 41, 0.4);
}

:deep(.node-marker.is-selected) {
  transform: scale(1.1);
}

:deep(.node-marker.is-selected .node-marker__halo) {
  box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.88), 0 0 0 10px rgba(47, 143, 131, 0.18);
}

:deep(.cluster-marker) {
  display: flex;
  min-width: 3.5rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.08rem;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.96) 0%, rgba(223, 245, 242, 0.96) 100%);
  box-shadow: 0 16px 28px rgba(22, 88, 85, 0.16), 0 0 0 1px rgba(47, 143, 131, 0.16);
  padding: 0.65rem 0.7rem;
  cursor: pointer;
}

:deep(.cluster-marker__count) {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1;
  color: #123b39;
}

:deep(.cluster-marker__rate) {
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1;
  color: #2a726d;
  letter-spacing: 0.02em;
}

@keyframes mapPulse {
  0% {
    opacity: 0.55;
    transform: scale(0.7);
  }
  100% {
    opacity: 0;
    transform: scale(1.28);
  }
}
</style>
