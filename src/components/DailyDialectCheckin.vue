<template>
  <div class="min-h-screen bg-slate-50 text-slate-800">
    <header class="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div class="mx-auto flex max-w-[1320px] items-center justify-between px-6 py-4">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-[#165DFF] hover:text-[#165DFF]"
            @click="goBack"
          >
            返回
          </button>
          <h1 class="text-xl font-semibold text-slate-900">每日方言闯关</h1>
        </div>
        <div
          class="rounded-full px-4 py-1.5 text-sm font-medium"
          :class="checkedInToday ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'"
        >
          {{ checkedInToday ? '今日已打卡' : '今日待打卡' }}
        </div>
      </div>
    </header>

    <main class="mx-auto grid max-w-[1320px] grid-cols-12 gap-5 px-6 py-6">
      <section class="col-span-12 space-y-5 lg:col-span-9">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm text-slate-500">今日任务进度</p>
              <p class="text-lg font-semibold text-slate-900">{{ solvedCount }} / {{ requiredCount }} 题</p>
            </div>
            <div class="text-right">
              <p class="text-sm text-slate-500">连续打卡</p>
              <p class="text-xl font-semibold text-[#FF7D00]">{{ streakDays }} 天</p>
            </div>
          </div>
          <div class="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full rounded-full bg-gradient-to-r from-[#165DFF] to-[#4A8DFF] transition-all duration-500"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
        </div>

        <transition name="slide-up" mode="out-in">
          <article
            :key="currentQuestion?.id || 'empty'"
            class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <template v-if="currentQuestion">
              <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-sm text-slate-500">关卡 {{ currentIndex + 1 }} / {{ questions.length }}</p>
                  <h2 class="text-2xl font-semibold text-slate-900">{{ typeLabelMap[currentQuestion.type] }}</h2>
                </div>
                <span class="rounded-full bg-[#165DFF]/10 px-3 py-1 text-sm font-medium text-[#165DFF]">
                  +{{ currentQuestion.exp }} EXP
                </span>
              </div>

              <div v-if="currentQuestion.type === 'audioMeaning'" class="space-y-4">
                <p class="text-base text-slate-700">请听方言音频，选择正确含义。</p>
                <button
                  type="button"
                  class="rounded-xl bg-[#165DFF] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0f4dd9]"
                  @click="playQuestionAudio"
                >
                  ▶ 播放方言音频
                </button>
                <div class="grid gap-3 sm:grid-cols-2">
                  <button
                    v-for="(option, index) in currentQuestion.options"
                    :key="option"
                    type="button"
                    class="rounded-xl border px-4 py-3 text-left text-sm transition"
                    :class="optionClass(index)"
                    :disabled="submitted"
                    @click="selectChoice(index)"
                  >
                    {{ index + 1 }}. {{ option }}
                  </button>
                </div>
              </div>

              <div v-else-if="currentQuestion.type === 'repeatScore'" class="space-y-4">
                <p class="rounded-xl bg-slate-50 p-4 text-base text-slate-700">
                  跟读句子：<span class="font-medium text-slate-900">{{ currentQuestion.sentence }}</span>
                </p>
                <div class="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    class="rounded-xl bg-[#165DFF] px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40"
                    :disabled="isRecording"
                    @click="startRecording"
                  >
                    开始录音
                  </button>
                  <button
                    type="button"
                    class="rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition disabled:opacity-40"
                    :disabled="!isRecording"
                    @click="stopRecording"
                  >
                    停止录音
                  </button>
                  <button
                    type="button"
                    class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition disabled:opacity-40"
                    :disabled="!recordedBlob"
                    @click="togglePreview"
                  >
                    {{ previewPlaying ? '停止试听' : '试听录音' }}
                  </button>
                </div>
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div class="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>发音波形</span>
                    <span>{{ isRecording ? '录音中...' : '等待录音' }}</span>
                  </div>
                  <div class="flex h-16 items-end gap-1 overflow-hidden">
                    <span
                      v-for="(bar, idx) in waveformBars"
                      :key="idx"
                      class="w-1.5 rounded-t bg-[#165DFF]/80 transition-all duration-150"
                      :style="{ height: `${bar}%` }"
                    />
                  </div>
                </div>
                <div v-if="similarityScore !== null" class="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
                  发音相似度评分：<strong>{{ similarityScore }}</strong> / 100
                </div>
              </div>

              <div v-else-if="currentQuestion.type === 'reorderSentence'" class="space-y-4">
                <p class="text-base text-slate-700">请点击卡片按顺序组成正确句子。</p>
                <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p class="mb-2 text-xs text-slate-500">当前句子</p>
                  <div class="min-h-9 rounded-lg bg-white px-3 py-2 text-sm text-slate-800">
                    {{ arrangedWords.join(' ') || '请从下方词卡中选择' }}
                  </div>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="(word, idx) in choiceWords"
                    :key="`${word}-${idx}`"
                    type="button"
                    class="rounded-lg border border-[#165DFF]/25 bg-[#165DFF]/5 px-3 py-1.5 text-sm text-[#165DFF] transition hover:bg-[#165DFF]/10 disabled:opacity-40"
                    :disabled="submitted"
                    @click="appendWord(word, idx)"
                  >
                    {{ word }}
                  </button>
                </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
                    :disabled="submitted"
                    @click="resetWords"
                  >
                    重置
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
                    :disabled="submitted || arrangedWords.length === 0"
                    @click="undoWord"
                  >
                    撤销
                  </button>
                </div>
              </div>

              <div v-else-if="currentQuestion.type === 'tongueTwister'" class="space-y-4">
                <p class="text-base text-slate-700">请完整朗读以下绕口令，完成即可通关。</p>
                <p class="rounded-xl bg-slate-50 p-4 text-base leading-7 text-slate-800">
                  {{ currentQuestion.tongueTwister }}
                </p>
                <div class="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    class="rounded-xl bg-[#165DFF] px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40"
                    :disabled="isRecording"
                    @click="startRecording"
                  >
                    开始录音
                  </button>
                  <button
                    type="button"
                    class="rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition disabled:opacity-40"
                    :disabled="!isRecording"
                    @click="stopRecording"
                  >
                    停止录音
                  </button>
                </div>
              </div>

              <div
                v-if="feedbackText"
                class="mt-5 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300"
                :class="feedbackCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"
              >
                {{ feedbackText }}
              </div>
            </template>
            <template v-else>
              <p class="text-center text-slate-600">今日任务已全部完成，快去排行榜看看吧！</p>
            </template>
          </article>
        </transition>

        <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <button
            type="button"
            class="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
            :disabled="!canSubmit"
            @click="submitAnswer"
          >
            提交答案
          </button>
          <button
            type="button"
            class="rounded-xl bg-[#FF7D00] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e76f00] disabled:opacity-40"
            :disabled="!submitted"
            @click="nextQuestion"
          >
            下一题
          </button>
          <div class="text-sm text-slate-500">
            当前经验：<span class="font-semibold text-[#165DFF]">{{ userLevel.exp }}</span>
          </div>
        </div>
      </section>

      <aside class="col-span-12 space-y-4 lg:col-span-3">
        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 class="text-sm font-semibold text-slate-900">方言等级</h3>
          <p class="mt-2 text-2xl font-semibold text-[#165DFF]">Lv.{{ userLevel.level }}</p>
          <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full rounded-full bg-gradient-to-r from-[#165DFF] to-[#76A6FF]"
              :style="{ width: `${levelProgress}%` }"
            />
          </div>
          <p class="mt-2 text-xs text-slate-500">{{ userLevel.exp }} / {{ userLevel.nextLevelExp }} EXP</p>
        </section>

        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 class="text-sm font-semibold text-slate-900">勋章墙</h3>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <div
              v-for="medal in medalList"
              :key="medal.name"
              class="rounded-xl border p-2 text-center text-xs"
              :class="medal.unlocked ? 'border-[#FF7D00]/35 bg-[#FF7D00]/10 text-[#b65d00]' : 'border-slate-200 bg-slate-50 text-slate-400'"
            >
              <p>{{ medal.icon }} {{ medal.name }}</p>
            </div>
          </div>
        </section>

        <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-900">排行榜入口</h3>
            <div class="flex gap-2 text-xs">
              <button
                type="button"
                class="rounded-full px-2 py-1"
                :class="rankType === 'national' ? 'bg-[#165DFF]/10 text-[#165DFF]' : 'bg-slate-100 text-slate-500'"
                @click="switchRankType('national')"
              >
                全国榜
              </button>
              <button
                type="button"
                class="rounded-full px-2 py-1"
                :class="rankType === 'city' ? 'bg-[#165DFF]/10 text-[#165DFF]' : 'bg-slate-100 text-slate-500'"
                @click="switchRankType('city')"
              >
                同城榜
              </button>
            </div>
          </div>
          <ul class="space-y-2 text-sm">
            <li
              v-for="(item, idx) in rankList.slice(0, 6)"
              :key="item.userId"
              class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
            >
              <span class="text-slate-700">{{ idx + 1 }}. {{ item.name }}</span>
              <span class="font-medium text-[#165DFF]">{{ item.score }}</span>
            </li>
          </ul>
        </section>
      </aside>
    </main>

    <audio ref="questionAudioRef" :src="currentQuestion?.audioUrl || ''" />
    <audio ref="previewAudioRef" :src="recordedUrl || ''" @ended="previewPlaying = false" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const DAILY_CACHE_KEY = 'dialect-daily-checkin'
const typeLabelMap = {
  audioMeaning: '听音辨义',
  repeatScore: '跟读打分',
  reorderSentence: '连词成句',
  tongueTwister: '方言绕口令'
}

const requiredCount = 4
const questions = ref([])
const currentIndex = ref(0)
const selectedChoice = ref(null)
const submitted = ref(false)
const feedbackText = ref('')
const feedbackCorrect = ref(false)
const solvedCount = ref(0)
const checkedInToday = ref(false)
const streakDays = ref(1)
const gainedExp = ref(0)
const rankType = ref('national')
const rankList = ref([])
const arrangedWords = ref([])
const choiceWords = ref([])
const similarityScore = ref(null)
const waveformBars = ref(Array.from({ length: 48 }, () => 8))

const userLevel = ref({
  level: 1,
  exp: 0,
  nextLevelExp: 120
})

const medalList = computed(() => [
  { name: '初出茅庐', icon: '🎖', unlocked: userLevel.value.level >= 1 },
  { name: '坚持不懈', icon: '🔥', unlocked: streakDays.value >= 7 },
  { name: '乡音达人', icon: '🏆', unlocked: streakDays.value >= 30 },
  {
    name: '绕口令大师',
    icon: '🎤',
    unlocked: questions.value.some((q, idx) => q.type === 'tongueTwister' && idx < solvedCount.value)
  }
])

const progressPercent = computed(() => Math.min(100, Math.round((solvedCount.value / requiredCount) * 100)))
const levelProgress = computed(() => {
  const { exp, nextLevelExp } = userLevel.value
  return Math.max(4, Math.min(100, Math.round((exp / nextLevelExp) * 100)))
})
const currentQuestion = computed(() => questions.value[currentIndex.value] || null)

const canSubmit = computed(() => {
  const q = currentQuestion.value
  if (!q || submitted.value) return false
  if (q.type === 'audioMeaning') return selectedChoice.value !== null
  if (q.type === 'repeatScore') return recordedBlob.value !== null
  if (q.type === 'reorderSentence') return arrangedWords.value.length === q.correctOrder.length
  if (q.type === 'tongueTwister') return recordedBlob.value !== null
  return false
})

const questionAudioRef = ref(null)
const previewAudioRef = ref(null)
const recordedBlob = ref(null)
const recordedUrl = ref('')
const isRecording = ref(false)
const previewPlaying = ref(false)
let mediaRecorder = null
let mediaStream = null
let audioContext = null
let analyser = null
let waveformTimer = null
let mediaChunks = []

function goBack() {
  if (window.history.length > 1) window.history.back()
}

function optionClass(index) {
  if (!submitted.value) {
    return selectedChoice.value === index
      ? 'border-[#165DFF] bg-[#165DFF]/10 text-[#165DFF]'
      : 'border-slate-200 bg-white text-slate-700 hover:border-[#165DFF]/50'
  }
  if (index === currentQuestion.value.correctIndex) return 'border-emerald-300 bg-emerald-50 text-emerald-700'
  if (selectedChoice.value === index) return 'border-rose-300 bg-rose-50 text-rose-700'
  return 'border-slate-200 bg-white text-slate-500'
}

function selectChoice(index) {
  selectedChoice.value = index
}

function appendWord(word, idx) {
  arrangedWords.value.push(word)
  choiceWords.value.splice(idx, 1)
}

function resetWords() {
  const q = currentQuestion.value
  choiceWords.value = [...q.words]
  arrangedWords.value = []
}

function undoWord() {
  if (!arrangedWords.value.length) return
  const word = arrangedWords.value.pop()
  choiceWords.value.push(word)
}

function playQuestionAudio() {
  const audio = questionAudioRef.value
  if (!audio) return
  audio.currentTime = 0
  const p = audio.play()
  if (p && typeof p.catch === 'function') p.catch(() => {})
}

function cleanupRecordedUrl() {
  if (recordedUrl.value) {
    URL.revokeObjectURL(recordedUrl.value)
    recordedUrl.value = ''
  }
}

function normalizeBars() {
  waveformBars.value = Array.from({ length: 48 }, () => 8)
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return
  cleanupRecordedUrl()
  recordedBlob.value = null
  similarityScore.value = null
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaChunks = []
    mediaRecorder = new MediaRecorder(mediaStream)
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) mediaChunks.push(e.data)
    }
    mediaRecorder.onstop = () => {
      recordedBlob.value = new Blob(mediaChunks, { type: mediaRecorder.mimeType || 'audio/webm' })
      recordedUrl.value = URL.createObjectURL(recordedBlob.value)
      similarityScore.value = mockScore()
      stopWaveform()
    }
    mediaRecorder.start()
    startWaveform(mediaStream)
    isRecording.value = true
  } catch (error) {
    console.error('录音失败', error)
    isRecording.value = false
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return
  mediaRecorder.stop()
  isRecording.value = false
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop())
    mediaStream = null
  }
}

function startWaveform(stream) {
  stopWaveform()
  audioContext = new window.AudioContext()
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 128
  const source = audioContext.createMediaStreamSource(stream)
  source.connect(analyser)
  const dataArray = new Uint8Array(analyser.frequencyBinCount)
  waveformTimer = window.setInterval(() => {
    if (!analyser) return
    analyser.getByteFrequencyData(dataArray)
    const bars = Array.from({ length: 48 }, (_, idx) => {
      const value = dataArray[idx] || 0
      return Math.max(8, Math.round((value / 255) * 100))
    })
    waveformBars.value = bars
  }, 120)
}

function stopWaveform() {
  if (waveformTimer) {
    window.clearInterval(waveformTimer)
    waveformTimer = null
  }
  if (audioContext) {
    void audioContext.close()
    audioContext = null
  }
  analyser = null
  normalizeBars()
}

function togglePreview() {
  const el = previewAudioRef.value
  if (!el || !recordedUrl.value) return
  if (previewPlaying.value) {
    el.pause()
    previewPlaying.value = false
  } else {
    el.currentTime = 0
    const p = el.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
    previewPlaying.value = true
  }
}

function mockScore() {
  return Math.floor(72 + Math.random() * 27)
}

async function submitAnswer() {
  const q = currentQuestion.value
  if (!q) return

  let correct = false
  if (q.type === 'audioMeaning') {
    correct = selectedChoice.value === q.correctIndex
  } else if (q.type === 'repeatScore') {
    correct = (similarityScore.value || 0) >= 60
  } else if (q.type === 'reorderSentence') {
    correct = arrangedWords.value.join(' ') === q.correctOrder.join(' ')
  } else if (q.type === 'tongueTwister') {
    correct = !!recordedBlob.value
  }

  submitted.value = true
  feedbackCorrect.value = correct
  feedbackText.value = correct
    ? `回答正确，获得 ${q.exp} 经验值！`
    : q.type === 'tongueTwister'
      ? `完成朗读，获得 ${q.exp} 经验值！`
      : '回答错误，再接再厉。'

  if (correct || q.type === 'tongueTwister') {
    solvedCount.value += 1
    gainedExp.value += q.exp
    userLevel.value.exp += q.exp
    if (userLevel.value.exp >= userLevel.value.nextLevelExp && userLevel.value.level < 10) {
      userLevel.value.level += 1
      userLevel.value.exp -= userLevel.value.nextLevelExp
      userLevel.value.nextLevelExp += 80
    }
  }

  await postSubmit(q, correct)
  if (solvedCount.value >= 3 && !checkedInToday.value) {
    await doCheckIn()
  }
}

function nextQuestion() {
  if (!submitted.value) return
  currentIndex.value += 1
  submitted.value = false
  selectedChoice.value = null
  feedbackText.value = ''
  feedbackCorrect.value = false
  similarityScore.value = null
  arrangedWords.value = []
  choiceWords.value = []
  cleanupRecordedUrl()
  recordedBlob.value = null
}

function setupQuestionState(question) {
  if (!question) return
  if (question.type === 'reorderSentence') {
    choiceWords.value = [...question.words]
    arrangedWords.value = []
  }
}

watch(currentQuestion, (q) => {
  setupQuestionState(q)
})

function switchRankType(type) {
  rankType.value = type
  void fetchRank(type)
}

async function fetchDailyTask() {
  try {
    const res = await fetch('/api/study/daily-task')
    if (!res.ok) throw new Error('failed')
    const json = await res.json()
    questions.value = Array.isArray(json.data) ? json.data : json
  } catch {
    questions.value = localMockQuestions()
  }
}

async function fetchRank(type) {
  try {
    const res = await fetch(`/api/study/rank?type=${type}`)
    if (!res.ok) throw new Error('failed')
    const json = await res.json()
    rankList.value = Array.isArray(json.data) ? json.data : json
  } catch {
    rankList.value = localMockRank(type)
  }
}

async function fetchLevel() {
  try {
    const res = await fetch('/api/user/level')
    if (!res.ok) throw new Error('failed')
    const json = await res.json()
    const data = json.data || json
    userLevel.value = {
      level: data.level ?? 1,
      exp: data.exp ?? 0,
      nextLevelExp: data.nextLevelExp ?? 120
    }
  } catch {
    // 保持默认等级
  }
}

async function postSubmit(question, correct) {
  const payload = {
    questionId: question.id,
    type: question.type,
    correct,
    score: question.type === 'repeatScore' ? similarityScore.value || 0 : undefined,
    exp: correct || question.type === 'tongueTwister' ? question.exp : 0
  }
  try {
    await fetch('/api/study/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch {
    // 离线场景静默降级
  }
}

async function doCheckIn() {
  checkedInToday.value = true
  streakDays.value += 1
  saveLocalState()
  try {
    await fetch('/api/study/check-in', { method: 'POST' })
  } catch {
    // 本地缓存优先
  }
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(DAILY_CACHE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    const today = new Date().toDateString()
    if (data.date === today) {
      checkedInToday.value = !!data.checkedInToday
      streakDays.value = data.streakDays || 1
      solvedCount.value = data.solvedCount || 0
      currentIndex.value = data.currentIndex || 0
      gainedExp.value = data.gainedExp || 0
    }
  } catch {
    // ignore
  }
}

function saveLocalState() {
  const payload = {
    date: new Date().toDateString(),
    checkedInToday: checkedInToday.value,
    streakDays: streakDays.value,
    solvedCount: solvedCount.value,
    currentIndex: currentIndex.value,
    gainedExp: gainedExp.value
  }
  localStorage.setItem(DAILY_CACHE_KEY, JSON.stringify(payload))
}

watch([solvedCount, currentIndex, checkedInToday, streakDays], saveLocalState)

function localMockQuestions() {
  return [
    {
      id: 'q1',
      type: 'audioMeaning',
      exp: 20,
      audioUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
      options: ['快点过来', '今天下雨了', '我饿了', '门没锁'],
      correctIndex: 0
    },
    {
      id: 'q2',
      type: 'repeatScore',
      exp: 25,
      sentence: '侬今朝吃过饭伐？'
    },
    {
      id: 'q3',
      type: 'reorderSentence',
      exp: 25,
      words: ['今日', '去', '街口', '买菜'],
      correctOrder: ['今日', '去', '街口', '买菜']
    },
    {
      id: 'q4',
      type: 'tongueTwister',
      exp: 30,
      tongueTwister: '黑化肥发灰，灰化肥发黑，黑化肥挥发发灰会花飞。'
    }
  ]
}

function localMockRank(type) {
  const citySuffix = type === 'city' ? '（同城）' : ''
  return [
    { userId: 'u1', name: `语韵学霸${citySuffix}`, score: 1280 },
    { userId: 'u2', name: `岭南小调${citySuffix}`, score: 1220 },
    { userId: 'u3', name: `江南侬语${citySuffix}`, score: 1188 },
    { userId: 'u4', name: `川话玩家${citySuffix}`, score: 1120 },
    { userId: 'u5', name: `闽南语友${citySuffix}`, score: 1060 },
    { userId: 'u6', name: `吴越口音${citySuffix}`, score: 990 }
  ]
}

onMounted(async () => {
  loadLocalState()
  await Promise.all([fetchDailyTask(), fetchRank(rankType.value), fetchLevel()])
  setupQuestionState(currentQuestion.value)
})

onBeforeUnmount(() => {
  stopWaveform()
  if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop())
  cleanupRecordedUrl()
})
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.25s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
.slide-up-enter-to,
.slide-up-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
