<template>
  <aside class="flex h-full min-h-[28rem] flex-col overflow-hidden rounded-[1.7rem] border border-[rgba(47,143,131,0.12)] bg-white shadow-[0_18px_40px_rgba(22,88,85,0.08)]">
    <header class="flex items-start justify-between gap-3 border-b border-[rgba(47,143,131,0.08)] px-4 py-4">
      <div>
        <div class="text-xs font-semibold uppercase tracking-[0.2em] text-[#2a726d]">Spatial View</div>
        <div class="mt-1 text-lg font-semibold text-[#123b39]">空间视图</div>
        <p class="mt-1 text-xs leading-6 text-[#607a77]">辅助定位当前表格记录，不承担主叙事。</p>
      </div>
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(47,143,131,0.16)] text-[#456664]"
        @click="$emit('close')"
      >
        ×
      </button>
    </header>

    <div ref="mapContainerRef" class="relative min-h-0 flex-1">
      <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-sm text-[#607a77]">
        地图加载中…
      </div>
      <div v-if="error" class="absolute inset-0 z-10 flex items-center justify-center bg-white/90 px-6 text-center text-sm text-[#8b2d2d]">
        {{ error }}
      </div>
    </div>

    <footer class="border-t border-[rgba(47,143,131,0.08)] px-4 py-3">
      <div class="flex items-center justify-between gap-3 text-xs text-[#607a77]">
        <span>点位 {{ rows.length }}</span>
        <span v-if="selectedLabel">已选：{{ selectedLabel }}</span>
      </div>
    </footer>
  </aside>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { describeArea, getStatusMeta } from '../../data/dialect-map-config.js'

const AMAP_KEY = 'c7c2b7231fb6ed1d7ac88eb83c7d86c2'

const props = defineProps({
  rows: {
    type: Array,
    default: () => []
  },
  selectedRowId: {
    type: [String, Number],
    default: ''
  }
})

const emit = defineEmits(['select-row', 'close'])

const mapContainerRef = ref(null)
const map = shallowRef(null)
const markers = shallowRef([])
const loading = ref(true)
const error = ref('')

const selectedLabel = computed(() => {
  const current = props.rows.find((row) => String(row.id) === String(props.selectedRowId))
  return current ? describeArea(current.area) : ''
})

function loadAmapScript() {
  if (window.AMap) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const callbackName = `__amap_db_cb_${Date.now()}`
    window[callbackName] = () => {
      resolve()
      delete window[callbackName]
    }
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.Scale,AMap.ToolBar&callback=${callbackName}`
    script.onerror = () => reject(new Error('高德地图脚本加载失败'))
    document.head.appendChild(script)
  })
}

function clearMarkers() {
  if (map.value && markers.value.length) {
    map.value.remove(markers.value)
  }
  markers.value = []
}

function createMarker(row) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'db-marker'
  if (String(row.id) === String(props.selectedRowId)) {
    el.classList.add('is-selected')
  }
  const statusMeta = getStatusMeta(row.status)
  el.style.setProperty(
    '--marker-fill',
    row.status === 'ready' ? '#2f8f83' : row.status === 'failed' ? '#c23d3d' : row.status === 'review' ? '#c66b4b' : '#5b8fd6'
  )
  el.innerHTML = `<span class="db-marker__dot"></span><span class="db-marker__halo"></span>`

  const marker = new window.AMap.Marker({
    position: [row.location.lng, row.location.lat],
    content: el,
    offset: new window.AMap.Pixel(-12, -12),
    anchor: 'center',
    title: `${row.dialectLabel} · ${statusMeta.label}`
  })
  marker.on('click', () => emit('select-row', row.id))
  return marker
}

function renderRows() {
  if (!map.value || !window.AMap) return
  clearMarkers()
  const nextMarkers = props.rows
    .filter((row) => row.location && typeof row.location.lng === 'number' && typeof row.location.lat === 'number')
    .map((row) => createMarker(row))
  if (nextMarkers.length) {
    map.value.add(nextMarkers)
    map.value.setFitView(nextMarkers, false, [36, 36, 36, 36], 12)
  }
  markers.value = nextMarkers
  focusSelected()
}

function focusSelected() {
  if (!map.value) return
  const current = props.rows.find((row) => String(row.id) === String(props.selectedRowId))
  if (!current?.location) return
  map.value.setZoomAndCenter(Math.max(map.value.getZoom(), 7), [current.location.lng, current.location.lat], true)
}

async function initMap() {
  loading.value = true
  error.value = ''
  try {
    await loadAmapScript()
    await nextTick()
    if (!mapContainerRef.value) return
    map.value = new window.AMap.Map(mapContainerRef.value, {
      zoom: 5,
      center: [108.55, 34.32],
      viewMode: '2D',
      mapStyle: 'amap://styles/whitesmoke'
    })
    map.value.addControl(new window.AMap.Scale())
    renderRows()
  } catch (err) {
    console.error(err)
    error.value = err.message || '地图初始化失败'
  } finally {
    loading.value = false
  }
}

watch(
  () => props.rows,
  () => {
    renderRows()
  },
  { deep: true }
)

watch(
  () => props.selectedRowId,
  () => {
    renderRows()
  }
)

onMounted(() => {
  void initMap()
})

onBeforeUnmount(() => {
  clearMarkers()
  if (map.value) {
    map.value.destroy()
    map.value = null
  }
})
</script>

<style scoped>
:deep(.db-marker) {
  position: relative;
  display: block;
  height: 1.5rem;
  width: 1.5rem;
  border: 0;
  padding: 0;
  background: transparent;
}

:deep(.db-marker__dot),
:deep(.db-marker__halo) {
  position: absolute;
  inset: 0;
  border-radius: 999px;
}

:deep(.db-marker__dot) {
  inset: 0.32rem;
  background: var(--marker-fill);
}

:deep(.db-marker__halo) {
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--marker-fill) 20%, transparent);
}

:deep(.db-marker.is-selected .db-marker__halo) {
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--marker-fill) 30%, transparent);
}
</style>
