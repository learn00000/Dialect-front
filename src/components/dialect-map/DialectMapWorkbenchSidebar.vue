<template>
  <section
    class="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.85rem] border border-[rgba(47,143,131,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(245,251,250,0.9)_100%)] shadow-[0_18px_40px_rgba(22,88,85,0.1)]"
  >
    <header class="flex items-start justify-between gap-3 border-b border-[rgba(47,143,131,0.1)] px-5 py-4">
      <div>
        <div class="text-xs font-semibold uppercase tracking-[0.22em] text-[#2a726d]">数据工作台</div>
        <h2 class="mt-1 text-lg font-semibold text-[#123b39]">采集与筛选</h2>
        <p class="mt-1 text-xs leading-5 text-[#5f7774]">先让更多人愿意上传，再由系统把语音慢慢治理成能用的语料。</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-full border border-[rgba(47,143,131,0.18)] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#174a47] transition hover:border-[#2f8f83] hover:bg-white"
          @click="$emit('back-public')"
        >
          返回总览
        </button>
        <button
          v-if="mobile"
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(47,143,131,0.18)] bg-white text-[#5f7774]"
          aria-label="关闭工作台"
          @click="$emit('close-mobile')"
        >
          ×
        </button>
      </div>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <section class="rounded-[1.45rem] border border-[rgba(47,143,131,0.1)] bg-white/80 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">地图筛选</div>
            <p class="mt-1 text-xs text-[#607a77]">地域与内容类型会同步影响地图图层。</p>
          </div>
        </div>

        <div class="mt-4 grid gap-2">
          <select :value="regionFilters.province" class="side-field" @change="$emit('set-province', $event.target.value)">
            <option value="">全国</option>
            <option v-for="province in regionTree" :key="province.name" :value="province.name">{{ province.name }}</option>
          </select>
          <select
            :value="regionFilters.city"
            class="side-field"
            :disabled="!regionFilters.province"
            @change="$emit('set-city', $event.target.value)"
          >
            <option value="">全部城市</option>
            <option v-for="city in cityOptions" :key="city.name" :value="city.name">{{ city.name }}</option>
          </select>
          <select
            :value="regionFilters.district"
            class="side-field"
            :disabled="!regionFilters.city"
            @change="$emit('set-district', $event.target.value)"
          >
            <option value="">全部区县</option>
            <option v-for="district in districtOptions" :key="district" :value="district">{{ district }}</option>
          </select>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="type in contentTypes"
            :key="type"
            type="button"
            class="rounded-full border px-3 py-1.5 text-xs font-medium transition"
            :class="
              selectedTypes.includes(type)
                ? 'border-[#2f8f83] bg-[#dff5f2] text-[#174a47] shadow-[0_8px_16px_rgba(47,143,131,0.14)]'
                : 'border-[rgba(47,143,131,0.18)] bg-white/75 text-[#5f7774] hover:border-[#2f8f83]'
            "
            @click="$emit('toggle-type', type)"
          >
            {{ type }}
          </button>
        </div>
      </section>

      <section class="mt-4 rounded-[1.45rem] border border-[rgba(47,143,131,0.1)] bg-white/84 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">上传乡音</div>
            <p class="mt-1 text-xs text-[#607a77]">最少只要求录音、地区、自报方言和授权同意。</p>
          </div>
          <button
            type="button"
            class="rounded-full border border-[rgba(47,143,131,0.16)] bg-[#eff8f5] px-3 py-1 text-[11px] font-medium text-[#174a47]"
            @click="adoptFilterRegion"
          >
            带入当前筛选
          </button>
        </div>

        <div class="mt-4 grid gap-3">
          <div class="grid grid-cols-3 gap-2">
            <label class="block min-w-0">
              <span class="mb-1 block text-[11px] text-[#607a77]">省</span>
              <select v-model="uploadProvince" class="side-field" @change="onUploadProvinceChange">
                <option value="">请选择</option>
                <option v-for="province in regionTree" :key="`u-${province.name}`" :value="province.name">
                  {{ province.name }}
                </option>
              </select>
            </label>
            <label class="block min-w-0">
              <span class="mb-1 block text-[11px] text-[#607a77]">市</span>
              <select v-model="uploadCity" class="side-field" :disabled="!uploadProvince" @change="onUploadCityChange">
                <option value="">请选择</option>
                <option v-for="city in uploadCityOptions" :key="`uc-${city.name}`" :value="city.name">
                  {{ city.name }}
                </option>
              </select>
            </label>
            <label class="block min-w-0">
              <span class="mb-1 block text-[11px] text-[#607a77]">区县</span>
              <select v-model="uploadDistrict" class="side-field" :disabled="!uploadCity">
                <option value="">请选择</option>
                <option v-for="district in uploadDistrictOptions" :key="`ud-${district}`" :value="district">
                  {{ district }}
                </option>
              </select>
            </label>
          </div>

          <p class="rounded-xl bg-[#f3faf8] px-3 py-2 text-xs text-[#2a726d]">
            {{ uploadAreaPreview || '完整地区将决定地图坐标与后续地理归一结果。' }}
          </p>

          <label class="block">
            <span class="mb-1 block text-[11px] text-[#607a77]">方言自报</span>
            <input v-model="dialectSelfReport" class="side-field" type="text" placeholder="例如：吴语·杭州小片" />
          </label>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1 block text-[11px] text-[#607a77]">内容类型</span>
              <select v-model="contributionType" class="side-field">
                <option v-for="type in contentTypes" :key="`ct-${type}`" :value="type">{{ type }}</option>
              </select>
            </label>
            <label class="block">
              <span class="mb-1 block text-[11px] text-[#607a77]">上传者昵称</span>
              <input v-model="nickname" class="side-field" type="text" maxlength="20" placeholder="可留空，系统会给默认名" />
            </label>
          </div>

          <label class="block">
            <span class="mb-1 block text-[11px] text-[#607a77]">文本说明</span>
            <textarea
              v-model="content"
              rows="3"
              class="side-field resize-none"
              placeholder="一句唱词、日常表达、场景说明，系统会后续转写补全。"
            />
          </label>
        </div>
      </section>

      <section class="mt-4 rounded-[1.45rem] border border-[rgba(47,143,131,0.1)] bg-[linear-gradient(180deg,rgba(239,248,245,0.92)_0%,rgba(255,255,255,0.88)_100%)] p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">原声录制</div>
            <p class="mt-1 text-xs text-[#607a77]">录到就先收，后续由治理流水线处理成结构化语料。</p>
          </div>
          <span
            class="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            :class="
              isRecording
                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                : recordBlob
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : 'bg-white text-[#607a77] ring-1 ring-[rgba(47,143,131,0.12)]'
            "
          >
            {{ recordStatusLabel }}
          </span>
        </div>

        <div class="mt-4 flex flex-col items-center">
          <button
            type="button"
            class="record-button relative flex h-[5.1rem] w-[5.1rem] items-center justify-center rounded-full text-white transition"
            :class="
              isRecording
                ? 'record-button--active'
                : recordBlob
                  ? 'record-button--done'
                  : 'record-button--idle'
            "
            :aria-label="isRecording ? '结束录音' : '开始录音'"
            @click="toggleMainRecord"
          >
            <svg
              v-if="!isRecording"
              class="h-7 w-7"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3M8 21h8" />
            </svg>
            <span v-else class="h-5 w-5 rounded-sm bg-white" />
          </button>
          <p class="mt-3 text-center text-sm text-[#34514f]">
            {{ isRecording ? '录音进行中，点击结束' : recordBlob ? '录音已就绪，可试听或提交' : '点击麦克风开始录音' }}
          </p>
          <p v-if="isRecording" class="mt-1 font-mono text-xs text-rose-600">{{ recordDurationLabel }}</p>
        </div>

        <div v-if="recordBlob && !isRecording" class="mt-4 flex flex-wrap justify-center gap-2 border-t border-[rgba(47,143,131,0.08)] pt-4">
          <button type="button" class="side-ghost-btn" @click="togglePreviewPlayback">
            {{ previewPlaying ? '停止试听' : '播放试听' }}
          </button>
          <button type="button" class="side-ghost-btn" @click="discardRecording">重新录制</button>
        </div>

        <p v-if="recordError" class="mt-3 text-center text-xs text-rose-600">{{ recordError }}</p>
        <audio v-show="false" ref="previewAudioRef" :src="previewUrl || undefined" @ended="previewPlaying = false" />
      </section>

      <label class="mt-4 flex items-start gap-3 rounded-[1.3rem] border border-[rgba(47,143,131,0.1)] bg-white/84 px-4 py-3 text-xs leading-6 text-[#466462]">
        <input v-model="consentGranted" type="checkbox" class="mt-1 h-4 w-4 rounded border-[rgba(47,143,131,0.3)] text-[#2f8f83] focus:ring-[#2f8f83]" />
        <span>我确认已获得录音上传与后续研究使用授权，允许系统对音频进行清洗、转写、标注与训练就绪处理。</span>
      </label>
    </div>

    <footer class="flex shrink-0 items-center justify-between gap-3 border-t border-[rgba(47,143,131,0.1)] bg-white/90 px-5 py-4">
      <p class="text-xs leading-5 text-[#607a77]">上传后会先进入治理中状态，并自动打开右侧追踪卡。</p>
      <button
        type="button"
        class="rounded-2xl bg-[linear-gradient(135deg,#7ed4ce_0%,#3a8f8a_48%,#184f4b_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(22,88,85,0.2)] transition hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-45"
        :disabled="submitting || !recordBlob"
        @click="submitLocalContribution"
      >
        {{ submitting ? '提交中…' : '提交并进入治理链路' }}
      </button>
    </footer>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { buildAreaString } from '../../data/map-regions.js'

const props = defineProps({
  regionTree: {
    type: Array,
    required: true
  },
  contentTypes: {
    type: Array,
    required: true
  },
  selectedTypes: {
    type: Array,
    required: true
  },
  regionFilters: {
    type: Object,
    required: true
  },
  cityOptions: {
    type: Array,
    required: true
  },
  districtOptions: {
    type: Array,
    required: true
  },
  submitting: {
    type: Boolean,
    default: false
  },
  submitContribution: {
    type: Function,
    required: true
  },
  mobile: {
    type: Boolean,
    default: false
  }
})

defineEmits(['set-province', 'set-city', 'set-district', 'toggle-type', 'close-mobile', 'back-public'])

const uploadProvince = ref('')
const uploadCity = ref('')
const uploadDistrict = ref('')
const dialectSelfReport = ref('')
const contributionType = ref('方言')
const nickname = ref('')
const content = ref('')
const consentGranted = ref(false)

const recordBlob = ref(null)
const previewUrl = ref('')
const previewAudioRef = ref(null)
const previewPlaying = ref(false)
const isRecording = ref(false)
const recordError = ref('')
const recordDurationSec = ref(0)

let mediaRecorder = null
let recordStream = null
let mediaChunks = []
let recordTimerId = null

const uploadCityOptions = computed(() => {
  const province = props.regionTree.find((item) => item.name === uploadProvince.value)
  return province?.cities || []
})

const uploadDistrictOptions = computed(() => {
  const city = uploadCityOptions.value.find((item) => item.name === uploadCity.value)
  return city?.districts || []
})

const uploadAreaPreview = computed(() => {
  if (uploadProvince.value && uploadCity.value && uploadDistrict.value) {
    return `将标记为：${uploadProvince.value} / ${uploadCity.value} / ${uploadDistrict.value}`
  }
  return ''
})

const recordStatusLabel = computed(() => {
  if (isRecording.value) return '录音中'
  if (recordBlob.value) return '已录制'
  return '待录制'
})

const recordDurationLabel = computed(() => {
  const minutes = Math.floor(recordDurationSec.value / 60)
  const seconds = recordDurationSec.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

function adoptFilterRegion() {
  uploadProvince.value = props.regionFilters.province || uploadProvince.value
  uploadCity.value = props.regionFilters.city || uploadCity.value
  uploadDistrict.value = props.regionFilters.district || uploadDistrict.value
}

watch(
  () => [props.regionFilters.province, props.regionFilters.city, props.regionFilters.district],
  ([province, city, district]) => {
    if (!uploadProvince.value && province) uploadProvince.value = province
    if (!uploadCity.value && city) uploadCity.value = city
    if (!uploadDistrict.value && district) uploadDistrict.value = district
  },
  { immediate: true }
)

function onUploadProvinceChange() {
  uploadCity.value = ''
  uploadDistrict.value = ''
}

function onUploadCityChange() {
  uploadDistrict.value = ''
}

function pickMimeType() {
  if (!window.MediaRecorder) return ''
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  return ''
}

function revokePreview() {
  if (!previewUrl.value) return
  URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

function clearRecordTimer() {
  if (recordTimerId != null) {
    window.clearInterval(recordTimerId)
    recordTimerId = null
  }
  recordDurationSec.value = 0
}

function discardRecording() {
  if (isRecording.value) stopRecording()
  recordBlob.value = null
  previewPlaying.value = false
  recordError.value = ''
  revokePreview()
  clearRecordTimer()
}

async function startRecording() {
  recordError.value = ''
  discardRecording()
  if (!navigator.mediaDevices?.getUserMedia) {
    recordError.value = '当前浏览器不支持录音。'
    return
  }
  try {
    recordStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaChunks = []
    const mimeType = pickMimeType()
    mediaRecorder = mimeType
      ? new MediaRecorder(recordStream, { mimeType })
      : new MediaRecorder(recordStream)
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        mediaChunks.push(event.data)
      }
    }
    mediaRecorder.onerror = (event) => {
      recordError.value = event.error?.message || '录音过程发生错误'
    }
    mediaRecorder.onstop = () => {
      const blob = new Blob(mediaChunks, { type: mediaRecorder.mimeType || 'audio/webm' })
      recordBlob.value = blob
      revokePreview()
      previewUrl.value = URL.createObjectURL(blob)
      if (recordStream) {
        recordStream.getTracks().forEach((track) => track.stop())
        recordStream = null
      }
    }
    mediaRecorder.start()
    isRecording.value = true
    recordTimerId = window.setInterval(() => {
      recordDurationSec.value += 1
    }, 1000)
  } catch (error) {
    console.error(error)
    recordError.value = '无法访问麦克风，请授予权限后重试。'
    clearRecordTimer()
  }
}

function stopRecording() {
  clearRecordTimer()
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    isRecording.value = false
    return
  }
  mediaRecorder.stop()
  isRecording.value = false
}

function toggleMainRecord() {
  if (isRecording.value) {
    stopRecording()
    return
  }
  void startRecording()
}

function togglePreviewPlayback() {
  const audio = previewAudioRef.value
  if (!audio || !previewUrl.value) return
  if (previewPlaying.value) {
    audio.pause()
    previewPlaying.value = false
    return
  }
  audio.currentTime = 0
  const playback = audio.play()
  if (playback && typeof playback.catch === 'function') {
    playback.catch(() => {})
  }
  previewPlaying.value = true
}

async function submitLocalContribution() {
  if (!recordBlob.value) {
    window.alert('请先完成录音。')
    return
  }
  if (!uploadProvince.value || !uploadCity.value || !uploadDistrict.value) {
    window.alert('请完整选择省、市、区县。')
    return
  }
  if (!dialectSelfReport.value.trim()) {
    window.alert('请填写方言自报。')
    return
  }
  if (!consentGranted.value) {
    window.alert('请先确认授权同意。')
    return
  }

  const extension = recordBlob.value.type.includes('mp4')
    ? 'm4a'
    : recordBlob.value.type.includes('ogg')
      ? 'ogg'
      : 'webm'
  const file = new File([recordBlob.value], `dialect-${Date.now()}.${extension}`, {
    type: recordBlob.value.type || 'audio/webm'
  })

  await props.submitContribution({
    file,
    area: buildAreaString(uploadProvince.value, uploadCity.value, uploadDistrict.value),
    dialectSelfReport: dialectSelfReport.value.trim(),
    type: contributionType.value,
    content: content.value.trim(),
    nickname: nickname.value.trim(),
    consentGranted: consentGranted.value
  })

  dialectSelfReport.value = ''
  content.value = ''
  nickname.value = ''
  consentGranted.value = false
  contributionType.value = '方言'
  discardRecording()
}

onBeforeUnmount(() => {
  clearRecordTimer()
  revokePreview()
  if (recordStream) {
    recordStream.getTracks().forEach((track) => track.stop())
    recordStream = null
  }
})
</script>

<style scoped>
.side-field {
  width: 100%;
  border-radius: 0.95rem;
  border: 1px solid rgba(47, 143, 131, 0.18);
  background: rgba(255, 255, 255, 0.92);
  padding: 0.68rem 0.82rem;
  color: #183b39;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.side-field:focus {
  border-color: #2f8f83;
  box-shadow: 0 0 0 3px rgba(47, 143, 131, 0.14);
}

.side-field:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.record-button--idle {
  background: linear-gradient(135deg, #7ed4ce 0%, #3a8f8a 52%, #184f4b 100%);
  box-shadow: 0 14px 28px rgba(22, 88, 85, 0.25);
}

.record-button--active {
  background: linear-gradient(135deg, #fb7185 0%, #e11d48 100%);
  box-shadow: 0 0 0 7px rgba(251, 113, 133, 0.18), 0 16px 30px rgba(225, 29, 72, 0.28);
  animation: pulse-record 1.35s ease-in-out infinite;
}

.record-button--done {
  background: linear-gradient(135deg, #6ee7b7 0%, #2f8f83 100%);
  box-shadow: 0 14px 28px rgba(47, 143, 131, 0.23);
}

.side-ghost-btn {
  border-radius: 999px;
  border: 1px solid rgba(47, 143, 131, 0.18);
  background: rgba(255, 255, 255, 0.86);
  padding: 0.55rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #174a47;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.side-ghost-btn:hover {
  border-color: #2f8f83;
  background: white;
}

@keyframes pulse-record {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}
</style>
