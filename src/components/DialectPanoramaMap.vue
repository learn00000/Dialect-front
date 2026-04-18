<template>
  <div class="flex h-full min-h-0 flex-col bg-slate-950 text-slate-100">
    <!-- 顶部导航 -->
    <header
      class="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-gradient-to-r from-slate-950 via-[#0a1628] to-slate-950 px-4 shadow-[0_8px_30px_rgba(22,93,255,0.12)] backdrop-blur"
    >
      <div class="flex items-center gap-3">
        <div
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-[#165DFF] text-sm font-bold text-white shadow-lg shadow-[#165DFF]/35"
        >
          方
        </div>
        <div>
          <div class="text-sm font-semibold tracking-wide text-white">方言文化保护</div>
          <div class="text-[11px] text-slate-400">方言全景地图</div>
        </div>
      </div>
      <nav class="flex items-center gap-2 text-sm">
        <a
          href="/"
          class="rounded-lg px-3 py-1.5 text-slate-300 transition hover:bg-white/5 hover:text-white"
        >
          返回首页
        </a>
        <a
          href="/profile"
          class="rounded-lg px-3 py-1.5 text-slate-300 transition hover:bg-white/5 hover:text-white"
          @click.prevent="onPersonalCenter"
        >
          个人中心
        </a>
      </nav>
    </header>

    <div class="relative flex min-h-0 flex-1">
      <!-- 左侧边栏 -->
      <aside
        class="relative z-20 flex shrink-0 flex-col border-r border-white/10 bg-slate-950/90 shadow-card backdrop-blur transition-[width] duration-300 ease-out"
        :class="sidebarCollapsed ? 'w-[52px]' : 'w-[320px]'"
      >
        <button
          type="button"
          class="absolute -right-3 top-16 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-xs text-slate-200 shadow-md transition hover:border-[#165DFF]/50 hover:text-white"
          :title="sidebarCollapsed ? '展开侧栏' : '收起侧栏'"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          {{ sidebarCollapsed ? '›' : '‹' }}
        </button>

        <div v-if="!sidebarCollapsed" class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <section class="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-950/90 p-4 shadow-inner">
            <h3 class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#7aa8ff]">
              <span class="h-1.5 w-1.5 rounded-full bg-[#165DFF] shadow-[0_0_12px_#165DFF]" />
              地区选择
            </h3>
            <div class="space-y-2">
              <select
                v-model="selProvince"
                class="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none ring-[#165DFF]/40 focus:border-[#165DFF]/60 focus:ring-2"
                @change="onProvinceChange"
              >
                <option value="">请选择省</option>
                <option v-for="p in regionTree" :key="p.name" :value="p.name">{{ p.name }}</option>
              </select>
              <select
                v-model="selCity"
                class="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none ring-[#165DFF]/40 focus:border-[#165DFF]/60 focus:ring-2"
                :disabled="!selProvince"
                @change="onCityChange"
              >
                <option value="">请选择市</option>
                <option v-for="c in cityOptions" :key="c.name" :value="c.name">{{ c.name }}</option>
              </select>
              <select
                v-model="selDistrict"
                class="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none ring-[#165DFF]/40 focus:border-[#165DFF]/60 focus:ring-2"
                :disabled="!selCity"
              >
                <option value="">请选择区县</option>
                <option v-for="d in districtOptions" :key="d" :value="d">{{ d }}</option>
              </select>
            </div>
          </section>

          <section class="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-[#7aa8ff]">内容类型（多选）</h3>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="t in contentTypes"
                :key="t"
                type="button"
                class="rounded-full border px-3 py-1 text-xs transition"
                :class="
                  selectedTypes.includes(t)
                    ? 'border-[#165DFF] bg-[#165DFF]/20 text-white shadow-[0_0_16px_rgba(22,93,255,0.35)]'
                    : 'border-white/10 bg-slate-950/40 text-slate-300 hover:border-[#165DFF]/40'
                "
                @click="toggleType(t)"
              >
                {{ t }}
              </button>
            </div>
            <p class="mt-2 text-[11px] text-slate-500">未选择任何类型时，显示全部类型点位。</p>
          </section>

          <div class="mt-auto flex flex-col gap-2">
            <button
              type="button"
              class="flex items-center justify-center gap-2 rounded-xl bg-[#165DFF] px-3 py-2.5 text-sm font-medium text-white shadow-lg shadow-[#165DFF]/30 transition hover:bg-[#0f4fe0] active:scale-[0.99]"
              @click="goMyLocation"
            >
              <span class="inline-block h-2 w-2 rounded-full bg-white/90 shadow-[0_0_10px_white]" />
              前往我的位置
            </button>
            <button
              type="button"
              class="rounded-xl border border-[#165DFF]/40 bg-slate-900/80 px-3 py-2.5 text-sm text-[#a8c4ff] transition hover:border-[#165DFF] hover:text-white"
              @click="openRecordPanel"
            >
              上传方言录音
            </button>
          </div>
        </div>

        <div
          v-else
          class="flex flex-1 flex-col items-center gap-3 py-4 text-[10px] text-slate-500 [writing-mode:vertical-rl]"
        >
          侧栏已收起
        </div>
      </aside>

      <!-- 地图主区域 -->
      <main class="relative min-h-0 min-w-0 flex-1 bg-slate-900">
        <div id="amap-container" ref="mapContainerRef" class="absolute inset-0 z-0" />

        <div
          v-if="mapLoading"
          class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm"
        >
          <div
            class="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/90 px-5 py-3 text-sm text-slate-200 shadow-card"
          >
            <span
              class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#165DFF] border-t-transparent"
            />
            地图加载中…
          </div>
        </div>

        <!-- 右侧信息卡片 -->
        <transition name="slide-fade">
          <aside
            v-if="panelOpen && selectedPoint"
            class="absolute right-0 top-0 z-20 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-gradient-to-b from-slate-950/95 via-slate-950/95 to-[#0a1628]/98 p-5 shadow-[-12px_0_40px_rgba(0,0,0,0.45)] backdrop-blur-md sm:w-96"
          >
            <div class="mb-4 flex items-start justify-between gap-2">
              <div>
                <div class="text-[11px] font-medium uppercase tracking-wider text-[#7aa8ff]">点位详情</div>
                <h2 class="mt-1 text-lg font-semibold text-white">{{ selectedPoint.area }}</h2>
              </div>
              <button
                type="button"
                class="rounded-full border border-white/10 p-1.5 text-slate-400 transition hover:border-[#165DFF]/50 hover:text-white"
                aria-label="关闭"
                @click="closeDetailPanel"
              >
                ✕
              </button>
            </div>

            <div class="space-y-3 text-sm">
              <div class="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                <div class="text-[11px] text-slate-500">方言片区</div>
                <div class="mt-1 text-slate-100">{{ selectedPoint.dialect }}</div>
              </div>
              <div class="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                <div class="text-[11px] text-slate-500">发言人昵称</div>
                <div class="mt-1 text-slate-100">{{ selectedPoint.nickname }}</div>
              </div>
              <div class="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                <div class="text-[11px] text-slate-500">内容类型</div>
                <div class="mt-1">
                  <span
                    class="inline-flex rounded-full border border-[#165DFF]/40 bg-[#165DFF]/15 px-2 py-0.5 text-xs text-[#b6ceff]"
                  >
                    {{ selectedPoint.type }}
                  </span>
                </div>
              </div>
              <div class="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                <div class="text-[11px] text-slate-500">文字内容</div>
                <p class="mt-1 leading-relaxed text-slate-200">{{ selectedPoint.content }}</p>
              </div>
              <div class="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                <div class="text-[11px] text-slate-500">上传时间</div>
                <div class="mt-1 text-slate-300">{{ selectedPoint.time }}</div>
              </div>
            </div>

            <div class="mt-4 rounded-2xl border border-[#165DFF]/25 bg-slate-900/80 p-3 shadow-inner">
              <div class="mb-2 text-xs text-slate-400">音频播放</div>
              <audio
                ref="detailAudioRef"
                class="w-full rounded-lg"
                controls
                :src="selectedPoint.audioUrl"
                @ended="onDetailAudioEnded"
              />
            </div>
          </aside>
        </transition>
      </main>

      <!-- 右下角悬浮：快速录音上传 -->
      <button
        type="button"
        class="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#165DFF] to-[#0b3fbf] text-2xl text-white shadow-[0_12px_40px_rgba(22,93,255,0.45)] ring-2 ring-white/10 transition hover:scale-105 active:scale-95"
        title="快速录音上传"
        aria-label="快速录音上传"
        @click="openRecordPanel"
      >
        🎙
      </button>
    </div>

    <!-- 录音 / 上传面板 -->
    <teleport to="body">
      <div
        v-if="recordPanelOpen"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
        @click.self="closeRecordPanel"
      >
        <div
          class="w-full max-w-lg rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-card"
          @click.stop
        >
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-white">方言录音上传</h3>
            <button
              type="button"
              class="rounded-full border border-white/10 px-2 py-1 text-sm text-slate-400 hover:text-white"
              @click="closeRecordPanel"
            >
              关闭
            </button>
          </div>

          <div class="space-y-4 text-sm">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="mb-1 block text-xs text-slate-400">省</span>
                <select
                  v-model="uploadProvince"
                  class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-[#165DFF]/60"
                  @change="onUploadProvinceChange"
                >
                  <option value="">请选择</option>
                  <option v-for="p in regionTree" :key="'u-' + p.name" :value="p.name">{{ p.name }}</option>
                </select>
              </label>
              <label class="block">
                <span class="mb-1 block text-xs text-slate-400">市</span>
                <select
                  v-model="uploadCity"
                  class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-[#165DFF]/60"
                  :disabled="!uploadProvince"
                  @change="onUploadCityChange"
                >
                  <option value="">请选择</option>
                  <option v-for="c in uploadCityOptions" :key="'u-' + c.name" :value="c.name">{{ c.name }}</option>
                </select>
              </label>
              <label class="block sm:col-span-2">
                <span class="mb-1 block text-xs text-slate-400">区县</span>
                <select
                  v-model="uploadDistrict"
                  class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-[#165DFF]/60"
                  :disabled="!uploadCity"
                >
                  <option value="">请选择</option>
                  <option v-for="d in uploadDistrictOptions" :key="'u-' + d" :value="d">{{ d }}</option>
                </select>
              </label>
            </div>

            <label class="block">
              <span class="mb-1 block text-xs text-slate-400">方言类型 / 片区</span>
              <input
                v-model="uploadDialect"
                type="text"
                placeholder="例如：吴语·杭州小片"
                class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-[#165DFF]/60"
              />
            </label>

            <label class="block">
              <span class="mb-1 block text-xs text-slate-400">内容类型</span>
              <select
                v-model="uploadContentType"
                class="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-[#165DFF]/60"
              >
                <option v-for="t in contentTypes" :key="'ut-' + t" :value="t">{{ t }}</option>
              </select>
            </label>

            <label class="block">
              <span class="mb-1 block text-xs text-slate-400">文字说明（可选）</span>
              <textarea
                v-model="uploadText"
                rows="2"
                class="w-full resize-none rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-[#165DFF]/60"
                placeholder="补充说明、注音或翻译等"
              />
            </label>

            <div class="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div class="mb-2 text-xs text-slate-400">录音控制</div>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-xl bg-[#165DFF] px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
                  :disabled="isRecording"
                  @click="startRecording"
                >
                  开始录音
                </button>
                <button
                  type="button"
                  class="rounded-xl border border-rose-400/50 px-4 py-2 text-xs text-rose-100 disabled:opacity-40"
                  :disabled="!isRecording"
                  @click="stopRecording"
                >
                  结束录音
                </button>
                <button
                  type="button"
                  class="rounded-xl border border-white/15 px-4 py-2 text-xs text-slate-200 disabled:opacity-40"
                  :disabled="!previewUrl"
                  @click="togglePreviewPlayback"
                >
                  {{ previewPlaying ? '停止试听' : '播放试听' }}
                </button>
              </div>
              <p v-if="recordError" class="mt-2 text-xs text-rose-300">{{ recordError }}</p>
              <p v-else class="mt-2 text-[11px] text-slate-500">
                使用浏览器 MediaRecorder 采集音频；结束录音后可试听再上传。
              </p>
              <audio v-show="false" ref="previewAudioRef" :src="previewUrl || undefined" @ended="previewPlaying = false" />
            </div>

            <button
              type="button"
              class="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#165DFF] to-[#3b82f6] py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#165DFF]/30 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="uploading || !recordBlob"
              @click="submitUpload"
            >
              {{ uploading ? '上传中…' : '上传录音' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

/** 高德 Key（可按需替换为环境变量） */
const AMAP_KEY = 'c7c2b7231fb6ed1d7ac88eb83c7d86c2'

const contentTypes = ['方言', '戏曲', '民谣', '童谣', '民俗']

/** 省市区三级示例数据（可按项目扩展为完整行政区划） */
const regionTree = [
  {
    name: '浙江省',
    cities: [
      { name: '杭州市', districts: ['上城区', '拱墅区', '西湖区', '滨江区', '余杭区'] },
      { name: '宁波市', districts: ['海曙区', '江北区', '鄞州区'] }
    ]
  },
  {
    name: '上海市',
    cities: [{ name: '上海市', districts: ['黄浦区', '徐汇区', '浦东新区', '静安区'] }]
  },
  {
    name: '北京市',
    cities: [{ name: '北京市', districts: ['东城区', '西城区', '朝阳区', '海淀区'] }]
  },
  {
    name: '广东省',
    cities: [
      { name: '广州市', districts: ['越秀区', '荔湾区', '天河区'] },
      { name: '深圳市', districts: ['福田区', '南山区', '罗湖区'] }
    ]
  },
  {
    name: '四川省',
    cities: [{ name: '成都市', districts: ['锦江区', '青羊区', '武侯区', '高新区'] }]
  },
  {
    name: '江苏省',
    cities: [{ name: '苏州市', districts: ['姑苏区', '虎丘区', '吴中区'] }]
  }
]

const sidebarCollapsed = ref(false)
const selProvince = ref('')
const selCity = ref('')
const selDistrict = ref('')
const selectedTypes = ref([])

const cityOptions = computed(() => {
  const p = regionTree.find((x) => x.name === selProvince.value)
  return p?.cities || []
})

const districtOptions = computed(() => {
  const c = cityOptions.value.find((x) => x.name === selCity.value)
  return c?.districts || []
})

function onProvinceChange() {
  selCity.value = ''
  selDistrict.value = ''
}
function onCityChange() {
  selDistrict.value = ''
}

const uploadProvince = ref('')
const uploadCity = ref('')
const uploadDistrict = ref('')
const uploadDialect = ref('')
const uploadContentType = ref('方言')
const uploadText = ref('')

const uploadCityOptions = computed(() => {
  const p = regionTree.find((x) => x.name === uploadProvince.value)
  return p?.cities || []
})
const uploadDistrictOptions = computed(() => {
  const c = uploadCityOptions.value.find((x) => x.name === uploadCity.value)
  return c?.districts || []
})
function onUploadProvinceChange() {
  uploadCity.value = ''
  uploadDistrict.value = ''
}
function onUploadCityChange() {
  uploadDistrict.value = ''
}

function toggleType(t) {
  const arr = [...selectedTypes.value]
  const i = arr.indexOf(t)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(t)
  selectedTypes.value = arr
}

const allPoints = ref([])
const pointsLoading = ref(false)
const mapLoading = ref(true)
const mapContainerRef = ref(null)
const mapInstance = shallowRef(null)
const markers = shallowRef([])

const panelOpen = ref(false)
const selectedPoint = ref(null)
const detailAudioRef = ref(null)

const recordPanelOpen = ref(false)
const isRecording = ref(false)
const recordBlob = ref(null)
const previewUrl = ref('')
const previewAudioRef = ref(null)
const previewPlaying = ref(false)
const recordError = ref('')
const uploading = ref(false)

let mediaRecorder = null
let mediaChunks = []
let recordStream = null

const filteredPoints = computed(() => {
  const list = allPoints.value
  return list.filter((pt) => matchesRegion(pt) && matchesTypes(pt))
})

function buildAreaPrefix() {
  const p = selProvince.value
  const c = selCity.value
  const d = selDistrict.value
  if (!p) return ''
  if (p && c && d) return `${p}/${c}/${d}`
  if (p && c) return `${p}/${c}/`
  if (p) return `${p}/`
  return ''
}

function matchesRegion(pt) {
  const prefix = buildAreaPrefix()
  if (!prefix) return true
  const area = pt.area || ''
  if (selDistrict.value) return area === `${selProvince.value}/${selCity.value}/${selDistrict.value}`
  if (selCity.value) return area.startsWith(`${selProvince.value}/${selCity.value}/`)
  return area.startsWith(`${selProvince.value}/`)
}

function matchesTypes(pt) {
  if (!selectedTypes.value.length) return true
  return selectedTypes.value.includes(pt.type)
}

function onPersonalCenter() {
  window.alert('请在项目中接入「个人中心」路由或页面。')
}

async function fetchMapPoints() {
  pointsLoading.value = true
  try {
    const res = await fetch('/api/map/points')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const data = Array.isArray(json) ? json : json.data
    if (!Array.isArray(data)) throw new Error('点位数据格式错误')
    allPoints.value = data
  } catch (e) {
    console.error(e)
    window.alert('获取地图点位失败，请检查后端 GET /api/map/points 是否可用。')
  } finally {
    pointsLoading.value = false
  }
}

function loadAmapScript() {
  if (window.AMap) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const cbName = `__amap_cb_${Date.now()}`
    window[cbName] = () => {
      resolve()
      delete window[cbName]
    }
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.Scale,AMap.ToolBar,AMap.Geolocation&callback=${cbName}`
    script.onerror = () => reject(new Error('高德地图脚本加载失败'))
    document.head.appendChild(script)
  })
}

function clearMarkers() {
  const m = markers.value
  if (m?.length && mapInstance.value) {
    mapInstance.value.remove(m)
  }
  markers.value = []
}

function renderMarkers() {
  const map = mapInstance.value
  if (!map || !window.AMap) return
  clearMarkers()
  const list = filteredPoints.value
  const ms = []
  for (const pt of list) {
    const { lng, lat } = pt.location || {}
    if (typeof lng !== 'number' || typeof lat !== 'number') continue
    const marker = new window.AMap.Marker({
      position: [lng, lat],
      title: pt.area,
      extData: pt
    })
    marker.setMap(map)
    marker.on('click', () => onMarkerClicked(pt))
    ms.push(marker)
  }
  markers.value = ms
}

function onMarkerClicked(pt) {
  selectedPoint.value = pt
  panelOpen.value = true
  void nextTick(() => {
    const el = detailAudioRef.value
    if (!el) return
    el.pause()
    el.currentTime = 0
    el.src = pt.audioUrl
    const p = el.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  })
}

function closeDetailPanel() {
  panelOpen.value = false
  const el = detailAudioRef.value
  if (el) {
    el.pause()
    el.currentTime = 0
  }
}

function onDetailAudioEnded() {
  /* 预留：例如自动连播 */
}

function goMyLocation() {
  const map = mapInstance.value
  if (!map || !window.AMap) return
  map.plugin('AMap.Geolocation', () => {
    const geo = new window.AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 12000,
      zoomToAccuracy: true,
      needAddress: false
    })
    geo.getCurrentPosition()
    const AMap = window.AMap
    const onComplete = (e) => {
      const pos = e?.position
      let lng
      let lat
      if (pos && typeof pos.getLng === 'function') {
        lng = pos.getLng()
        lat = pos.getLat()
      } else if (pos && typeof pos.lng === 'number') {
        lng = pos.lng
        lat = pos.lat
      }
      if (lng != null && lat != null) {
        map.setZoomAndCenter(14, [lng, lat], true)
      }
      AMap.Event?.removeListener?.(completeHandle)
      AMap.Event?.removeListener?.(errorHandle)
    }
    const onError = () => {
      window.alert('定位失败，请检查浏览器定位权限或稍后重试。')
      AMap.Event?.removeListener?.(completeHandle)
      AMap.Event?.removeListener?.(errorHandle)
    }
    const completeHandle = AMap.Event.addListener(geo, 'complete', onComplete)
    const errorHandle = AMap.Event.addListener(geo, 'error', onError)
  })
}

async function initMap() {
  mapLoading.value = true
  try {
    await loadAmapScript()
    await nextTick()
    const el = mapContainerRef.value
    if (!el) return
    const map = new window.AMap.Map(el, {
      zoom: 5,
      center: [108.55, 34.32],
      viewMode: '2D'
    })
    map.addControl(new window.AMap.Scale())
    map.addControl(new window.AMap.ToolBar({ position: { right: 12, top: 110 } }))
    mapInstance.value = map
    renderMarkers()
  } catch (e) {
    console.error(e)
    window.alert('地图初始化失败，请检查 Key 与网络，或配置安全密钥 securityJsCode。')
  } finally {
    mapLoading.value = false
  }
}

watch(filteredPoints, () => {
  renderMarkers()
})

function pickMimeType() {
  if (!window.MediaRecorder) return ''
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  return ''
}

function revokePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
}

async function startRecording() {
  recordError.value = ''
  revokePreview()
  recordBlob.value = null
  previewPlaying.value = false
  if (!navigator.mediaDevices?.getUserMedia) {
    recordError.value = '当前浏览器不支持录音。'
    return
  }
  try {
    recordStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaChunks = []
    const mime = pickMimeType()
    mediaRecorder = mime ? new MediaRecorder(recordStream, { mimeType: mime }) : new MediaRecorder(recordStream)
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) mediaChunks.push(e.data)
    }
    mediaRecorder.onerror = (ev) => {
      recordError.value = (ev.error && ev.error.message) || '录音过程出错'
    }
    mediaRecorder.onstop = () => {
      const blob = new Blob(mediaChunks, { type: mediaRecorder.mimeType || 'audio/webm' })
      recordBlob.value = blob
      revokePreview()
      previewUrl.value = URL.createObjectURL(blob)
      if (recordStream) {
        recordStream.getTracks().forEach((t) => t.stop())
        recordStream = null
      }
    }
    mediaRecorder.start()
    isRecording.value = true
  } catch (e) {
    console.error(e)
    recordError.value = '无法访问麦克风，请授予权限后重试。'
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    isRecording.value = false
    return
  }
  mediaRecorder.stop()
  isRecording.value = false
}

function togglePreviewPlayback() {
  const a = previewAudioRef.value
  if (!a || !previewUrl.value) return
  if (previewPlaying.value) {
    a.pause()
    previewPlaying.value = false
  } else {
    a.currentTime = 0
    const p = a.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
    previewPlaying.value = true
  }
}

function openRecordPanel() {
  syncUploadRegionFromFilter()
  recordPanelOpen.value = true
}

function closeRecordPanel() {
  recordPanelOpen.value = false
  if (isRecording.value) stopRecording()
}

function syncUploadRegionFromFilter() {
  uploadProvince.value = selProvince.value || uploadProvince.value
  uploadCity.value = selCity.value || uploadCity.value
  uploadDistrict.value = selDistrict.value || uploadDistrict.value
}

async function submitUpload() {
  if (!recordBlob.value) {
    window.alert('请先完成录音。')
    return
  }
  if (!uploadProvince.value || !uploadCity.value || !uploadDistrict.value) {
    window.alert('请完整选择省 / 市 / 区县。')
    return
  }
  if (!uploadDialect.value.trim()) {
    window.alert('请填写方言类型 / 片区。')
    return
  }
  const area = `${uploadProvince.value}/${uploadCity.value}/${uploadDistrict.value}`
  const fd = new FormData()
  const ext = recordBlob.value.type.includes('webm') ? 'webm' : recordBlob.value.type.includes('mp4') ? 'm4a' : 'dat'
  fd.append('file', recordBlob.value, `dialect-${Date.now()}.${ext}`)
  fd.append('area', area)
  fd.append('dialect', uploadDialect.value.trim())
  fd.append('type', uploadContentType.value)
  fd.append('content', uploadText.value.trim())
  uploading.value = true
  try {
    const res = await fetch('/api/map/upload', { method: 'POST', body: fd })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || (json.code !== undefined && json.code !== 0)) {
      throw new Error(json.message || `上传失败（${res.status}）`)
    }
    window.alert('上传成功')
    closeRecordPanel()
    revokePreview()
    recordBlob.value = null
    await fetchMapPoints()
    renderMarkers()
  } catch (e) {
    console.error(e)
    window.alert(e.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchMapPoints(), initMap()])
})

onBeforeUnmount(() => {
  clearMarkers()
  if (mapInstance.value) {
    mapInstance.value.destroy()
    mapInstance.value = null
  }
  revokePreview()
  if (recordStream) {
    recordStream.getTracks().forEach((t) => t.stop())
    recordStream = null
  }
})
</script>

<style scoped>
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: transform 0.28s ease, opacity 0.28s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
.slide-fade-enter-to,
.slide-fade-leave-from {
  transform: translateX(0);
  opacity: 1;
}
</style>
