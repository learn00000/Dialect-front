<template>
  <teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[80] flex justify-end bg-[#10211f]/36 backdrop-blur-[2px]"
      @click.self="$emit('close')"
    >
      <section class="flex h-full w-full max-w-[30rem] flex-col bg-white shadow-[0_24px_60px_rgba(16,33,31,0.2)]">
        <header class="flex items-start justify-between gap-3 border-b border-[rgba(47,143,131,0.08)] px-5 py-4">
          <div>
            <div class="text-xs font-semibold uppercase tracking-[0.2em] text-[#2a726d]">New Contribution</div>
            <h2 class="mt-1 text-lg font-semibold text-[#123b39]">新建贡献任务</h2>
            <p class="mt-1 text-xs leading-6 text-[#607a77]">提交后会直接进入数据库主表，并展开 Agent 流程。</p>
          </div>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(47,143,131,0.16)] text-[#456664]"
            @click="$emit('close')"
          >
            ×
          </button>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <section class="rounded-[1.2rem] border border-[rgba(47,143,131,0.08)] bg-[#fbfefd] p-4">
            <div class="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">方言选择</div>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="mb-1 block text-[11px] text-[#607a77]">方言大区</span>
                <select v-model="dialectGroup" class="drawer-field" @change="onDialectGroupChange">
                  <option value="">请选择</option>
                  <option v-for="group in dialectGroups" :key="group.key" :value="group.label">{{ group.label }}</option>
                </select>
              </label>
              <label class="block">
                <span class="mb-1 block text-[11px] text-[#607a77]">次方言</span>
                <select v-model="dialectSubgroup" class="drawer-field" :disabled="!dialectGroup">
                  <option value="">请选择</option>
                  <option v-for="subgroup in dialectSubgroups" :key="subgroup" :value="subgroup">{{ subgroup }}</option>
                </select>
              </label>
            </div>
            <p
              class="mt-3 rounded-xl px-3 py-2 text-xs"
              :class="
                transcriptPolicy.requiresManualTranscript
                  ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                  : 'bg-[#f3faf8] text-[#2a726d]'
              "
            >
              {{ transcriptPolicy.note }}
            </p>
          </section>

          <section class="mt-4 rounded-[1.2rem] border border-[rgba(47,143,131,0.08)] bg-[#fbfefd] p-4">
            <div class="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">所在地区</div>
            <div class="grid grid-cols-3 gap-2">
              <label class="block min-w-0">
                <span class="mb-1 block text-[11px] text-[#607a77]">省</span>
                <select v-model="uploadProvince" class="drawer-field" @change="onUploadProvinceChange">
                  <option value="">请选择</option>
                  <option v-for="province in regionTree" :key="province.name" :value="province.name">{{ province.name }}</option>
                </select>
              </label>
              <label class="block min-w-0">
                <span class="mb-1 block text-[11px] text-[#607a77]">市</span>
                <select v-model="uploadCity" class="drawer-field" :disabled="!uploadProvince" @change="onUploadCityChange">
                  <option value="">请选择</option>
                  <option v-for="city in uploadCityOptions" :key="city.name" :value="city.name">{{ city.name }}</option>
                </select>
              </label>
              <label class="block min-w-0">
                <span class="mb-1 block text-[11px] text-[#607a77]">区县</span>
                <select v-model="uploadDistrict" class="drawer-field" :disabled="!uploadCity">
                  <option value="">请选择</option>
                  <option v-for="district in uploadDistrictOptions" :key="district" :value="district">{{ district }}</option>
                </select>
              </label>
            </div>
          </section>

          <p class="mt-3 rounded-xl bg-[#f3faf8] px-3 py-2 text-xs text-[#2a726d]">
            {{ uploadAreaPreview || '完整地区会作为数据库记录与地图定位依据。' }}
          </p>

          <div class="mt-4 grid gap-3">
            <label class="block">
              <span class="mb-1 block text-[11px] text-[#607a77]">具体方言点（可选）</span>
              <input v-model="dialectLocale" class="drawer-field" type="text" placeholder="例如：温州话、泉州话、苏州话" />
            </label>

            <div class="grid gap-3 sm:grid-cols-2">
              <label class="block">
                <span class="mb-1 block text-[11px] text-[#607a77]">内容类型</span>
                <select v-model="contributionType" class="drawer-field">
                  <option v-for="type in contentTypes" :key="type" :value="type">{{ type }}</option>
                </select>
              </label>
              <label class="block">
                <span class="mb-1 block text-[11px] text-[#607a77]">上传者昵称</span>
                <input v-model="nickname" class="drawer-field" type="text" maxlength="20" placeholder="可留空" />
              </label>
            </div>

            <label class="block">
              <span class="mb-1 block text-[11px] text-[#607a77]">录音文字版（中文）</span>
              <textarea
                v-model="content"
                rows="3"
                class="drawer-field resize-none"
                placeholder="请输入这段录音对应的中文内容，例如：今天天气真好，我们去赶集。"
              />
            </label>
            <p v-if="transcriptPolicy.requiresManualTranscript" class="text-xs text-amber-700">当前方言需人工提供文字版。</p>
          </div>

          <section class="mt-4 rounded-[1.45rem] border border-[rgba(47,143,131,0.1)] bg-[linear-gradient(180deg,rgba(239,248,245,0.92)_0%,rgba(255,255,255,0.88)_100%)] p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">语音来源</div>
                <p class="mt-1 text-xs text-[#607a77]">可以直接录音，也可以上传现成的 MP4 文件。</p>
              </div>
              <div class="inline-flex rounded-2xl border border-[rgba(47,143,131,0.16)] bg-white/84 p-1">
                <button
                  type="button"
                  class="rounded-xl px-3 py-2 text-sm font-medium transition"
                  :class="uploadMode === 'record' ? 'bg-white text-[#174a47] shadow-[0_6px_14px_rgba(22,88,85,0.08)]' : 'text-[#5e7471]'"
                  @click="setUploadMode('record')"
                >
                  直接录音
                </button>
                <button
                  type="button"
                  class="rounded-xl px-3 py-2 text-sm font-medium transition"
                  :class="uploadMode === 'file' ? 'bg-white text-[#174a47] shadow-[0_6px_14px_rgba(22,88,85,0.08)]' : 'text-[#5e7471]'"
                  @click="setUploadMode('file')"
                >
                  上传 MP4
                </button>
              </div>
            </div>

            <div v-if="uploadMode === 'record'">
              <div class="mt-4 flex items-center justify-between gap-3">
                <div>
                  <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">原声录制</div>
                  <p class="mt-1 text-xs text-[#607a77]">复用现有录音链路，提交后直接建任务。</p>
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
                <button type="button" class="drawer-ghost-btn" @click="togglePreviewPlayback">
                  {{ previewPlaying ? '停止试听' : '播放试听' }}
                </button>
                <button type="button" class="drawer-ghost-btn" @click="discardRecording">重新录制</button>
              </div>

              <p v-if="recordError" class="mt-3 text-center text-xs text-rose-600">{{ recordError }}</p>
            </div>

            <div v-else class="mt-4">
              <div class="rounded-2xl border border-dashed border-[rgba(47,143,131,0.22)] bg-white/84 px-4 py-4">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">MP4 文件上传</div>
                    <p class="mt-1 text-xs text-[#607a77]">上传 `mp4` 后，后端会自动抽取音轨进入同一条方言处理流水线。</p>
                  </div>
                  <button type="button" class="drawer-ghost-btn" @click="openFilePicker">选择文件</button>
                </div>

                <input
                  ref="fileInputRef"
                  class="hidden"
                  type="file"
                  accept="video/mp4,.mp4"
                  @change="handleFileChange"
                />

                <div v-if="selectedFile" class="mt-4 rounded-xl bg-[#f5faf8] px-3 py-3">
                  <div class="text-sm font-medium text-[#173f3c]">{{ selectedFile.name }}</div>
                  <div class="mt-1 text-xs text-[#607a77]">{{ selectedFileMeta }}</div>
                  <video v-if="filePreviewUrl" class="mt-3 w-full rounded-xl bg-black/80" controls :src="filePreviewUrl" />
                  <div class="mt-3 flex flex-wrap gap-2">
                    <button type="button" class="drawer-ghost-btn" @click="openFilePicker">重新选择</button>
                    <button type="button" class="drawer-ghost-btn" @click="clearSelectedFile">移除文件</button>
                  </div>
                </div>
                <p v-else class="mt-4 text-xs text-[#607a77]">还未选择 MP4 文件。</p>
              </div>
            </div>

            <audio v-show="false" ref="previewAudioRef" :src="previewUrl || undefined" @ended="previewPlaying = false" />
          </section>

          <label class="mt-4 flex items-start gap-3 rounded-[1.3rem] border border-[rgba(47,143,131,0.1)] bg-white/84 px-4 py-3 text-xs leading-6 text-[#466462]">
            <input v-model="consentGranted" type="checkbox" class="mt-1 h-4 w-4 rounded border-[rgba(47,143,131,0.3)] text-[#2f8f83] focus:ring-[#2f8f83]" />
            <span>我确认已获得录音上传与后续研究使用授权，允许系统对音频进行清洗、转写、标注与训练就绪处理。</span>
          </label>
        </div>

        <footer class="flex items-center justify-between gap-3 border-t border-[rgba(47,143,131,0.08)] px-5 py-4">
          <div class="text-xs text-[#607a77]">提交成功后，主表会立即插入该任务并自动展开。</div>
          <button
            type="button"
            class="rounded-2xl bg-[linear-gradient(135deg,#7ed4ce_0%,#3a8f8a_48%,#184f4b_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(22,88,85,0.2)] transition hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-45"
            :disabled="submitting || !selectedUploadFile"
            @click="submitLocalContribution"
          >
            {{ submitting ? '提交中…' : '提交并写入数据库' }}
          </button>
        </footer>
      </section>
    </div>
  </teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { buildAreaString } from '../../data/map-regions.js'
import { buildDialectLabel, getDialectGroupOptions, getDialectSubgroups, getDialectSupportPolicy } from '../../data/dialect-taxonomy.js'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  submitting: {
    type: Boolean,
    default: false
  },
  regionTree: {
    type: Array,
    required: true
  },
  contentTypes: {
    type: Array,
    required: true
  },
  defaultRegion: {
    type: Object,
    required: true
  },
  submitContribution: {
    type: Function,
    required: true
  }
})

defineEmits(['close'])

const uploadProvince = ref('')
const uploadCity = ref('')
const uploadDistrict = ref('')
const dialectGroup = ref('')
const dialectSubgroup = ref('')
const dialectLocale = ref('')
const contributionType = ref('方言')
const nickname = ref('')
const content = ref('')
const consentGranted = ref(false)
const uploadMode = ref('record')
const selectedFile = ref(null)
const fileInputRef = ref(null)
const filePreviewUrl = ref('')

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

const dialectGroups = getDialectGroupOptions()

const uploadCityOptions = computed(() => {
  const province = props.regionTree.find((item) => item.name === uploadProvince.value)
  return province?.cities || []
})

const uploadDistrictOptions = computed(() => {
  const city = uploadCityOptions.value.find((item) => item.name === uploadCity.value)
  return city?.districts || []
})

const dialectSubgroups = computed(() => getDialectSubgroups(dialectGroup.value))
const transcriptPolicy = computed(() => getDialectSupportPolicy(dialectGroup.value, dialectSubgroup.value))
const selectedFileMeta = computed(() => {
  if (!selectedFile.value) return ''
  const sizeMb = selectedFile.value.size / (1024 * 1024)
  return `${selectedFile.value.type || 'audio/*'} · ${sizeMb.toFixed(sizeMb >= 10 ? 0 : 2)} MB`
})
const selectedUploadFile = computed(() => {
  if (uploadMode.value === 'file') return selectedFile.value
  if (!recordBlob.value) return null
  const extension = recordBlob.value.type.includes('mp4')
    ? 'm4a'
    : recordBlob.value.type.includes('ogg')
      ? 'ogg'
      : 'webm'
  return new File([recordBlob.value], `dialect-${Date.now()}.${extension}`, {
    type: recordBlob.value.type || 'audio/webm'
  })
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

watch(
  () => props.open,
  (open) => {
    if (open) {
      uploadProvince.value = props.defaultRegion.province || ''
      uploadCity.value = props.defaultRegion.city || ''
      uploadDistrict.value = props.defaultRegion.district || ''
      return
    }
    discardRecording()
    clearSelectedFile()
  }
)

function onUploadProvinceChange() {
  uploadCity.value = ''
  uploadDistrict.value = ''
}

function onUploadCityChange() {
  uploadDistrict.value = ''
}

function onDialectGroupChange() {
  dialectSubgroup.value = ''
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

function revokeFilePreview() {
  if (!filePreviewUrl.value) return
  URL.revokeObjectURL(filePreviewUrl.value)
  filePreviewUrl.value = ''
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

function clearSelectedFile() {
  selectedFile.value = null
  revokeFilePreview()
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function setUploadMode(mode) {
  uploadMode.value = mode === 'file' ? 'file' : 'record'
}

function openFilePicker() {
  fileInputRef.value?.click()
}

function handleFileChange(event) {
  const file = event.target?.files?.[0]
  if (!file) {
    clearSelectedFile()
    return
  }
  selectedFile.value = file
  revokeFilePreview()
  filePreviewUrl.value = URL.createObjectURL(file)
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
  if (!selectedUploadFile.value) {
    window.alert(uploadMode.value === 'file' ? '请先选择音频文件。' : '请先完成录音。')
    return
  }
  if (!uploadProvince.value || !uploadCity.value || !uploadDistrict.value) {
    window.alert('请完整选择省、市、区县。')
    return
  }
  if (!dialectGroup.value || !dialectSubgroup.value) {
    window.alert('请先选择方言大区和次方言。')
    return
  }
  if (transcriptPolicy.value.requiresManualTranscript && !content.value.trim()) {
    window.alert('当前所选次方言不在 Fun-ASR 官方明确支持名单中，请先填写录音文字版。')
    return
  }
  if (!consentGranted.value) {
    window.alert('请先确认授权同意。')
    return
  }

  await props.submitContribution({
    file: selectedUploadFile.value,
    area: buildAreaString(uploadProvince.value, uploadCity.value, uploadDistrict.value),
    dialectSelfReport: buildDialectLabel(dialectGroup.value, dialectSubgroup.value, dialectLocale.value),
    type: contributionType.value,
    content: content.value.trim(),
    nickname: nickname.value.trim(),
    consentGranted: consentGranted.value
  })

  dialectGroup.value = ''
  dialectSubgroup.value = ''
  dialectLocale.value = ''
  content.value = ''
  nickname.value = ''
  consentGranted.value = false
  contributionType.value = '方言'
  discardRecording()
  clearSelectedFile()
  uploadMode.value = 'record'
}

onBeforeUnmount(() => {
  if (recordStream) {
    recordStream.getTracks().forEach((track) => track.stop())
    recordStream = null
  }
  revokePreview()
  revokeFilePreview()
  clearRecordTimer()
})
</script>

<style scoped>
.drawer-field {
  width: 100%;
  border-radius: 1rem;
  border: 1px solid rgba(47, 143, 131, 0.16);
  background: white;
  padding: 0.72rem 0.9rem;
  color: #173f3c;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.drawer-field:focus {
  border-color: #2f8f83;
  box-shadow: 0 0 0 3px rgba(47, 143, 131, 0.12);
}

.drawer-field:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.drawer-ghost-btn {
  border-radius: 999px;
  border: 1px solid rgba(47, 143, 131, 0.16);
  background: white;
  padding: 0.55rem 0.95rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #174a47;
}

.record-button--idle {
  background: linear-gradient(135deg, #7ed4ce 0%, #3a8f8a 48%, #184f4b 100%);
  box-shadow: 0 16px 34px rgba(22, 88, 85, 0.24);
}

.record-button--done {
  background: linear-gradient(135deg, #6ac4a7 0%, #2f8f83 58%, #1b6244 100%);
  box-shadow: 0 16px 34px rgba(32, 107, 85, 0.22);
}

.record-button--active {
  background: linear-gradient(135deg, #f16c7c 0%, #cf3f63 52%, #8e2447 100%);
  box-shadow: 0 16px 34px rgba(177, 45, 86, 0.26);
}
</style>
