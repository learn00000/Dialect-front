<template>
  <div
    class="flex h-screen flex-col overflow-hidden bg-[#eef8f6] text-slate-800 [background-image:radial-gradient(120%_70%_at_50%_-15%,rgba(255,255,255,0.95)_0%,transparent_58%),radial-gradient(ellipse_55%_42%_at_0%_100%,rgba(105,196,191,0.11)_0%,transparent_55%),linear-gradient(168deg,#fbffff_0%,#e9f5f3_42%,#f4fbfa_100%)]"
  >
    <header class="site-header">
      <a class="brand" href="./index.html#top">
        <span class="brand__mark" aria-hidden="true"></span>
        <span class="brand__text">语韵东方</span>
      </a>
      <nav class="nav" aria-label="主导航">
        <a class="nav__link nav__link--active" href="./index.html#top">首页</a>
        <a class="nav__link" href="./index.html#features">核心功能</a>
        <a class="nav__link" href="./index.html#vision">项目愿景</a>
        <a class="nav__link" href="./index.html#footer">关于</a>
      </nav>
      <button type="button" class="btn btn--ghost" @click="onAuthClick">登录 / 注册</button>
    </header>

    <main class="mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 flex-col px-4 pb-3 pt-3 sm:px-6">
      <section class="mb-4 rounded-2xl border border-[rgba(58,143,138,0.15)] bg-white/80 p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="rounded-xl border border-[rgba(58,143,138,0.2)] bg-white px-3 py-1.5 text-sm text-[#1a5c58] transition hover:border-[#1a5c58] hover:bg-[#1a5c58]/5 hover:text-[#1a5c58]"
              @click="goBack"
            >
              返回
            </button>
            <h1 class="text-lg font-semibold text-[#174a47] sm:text-xl">方言闯关大冒险</h1>
          </div>
          <div class="flex items-center gap-2 text-xs sm:gap-3 sm:text-sm">
            <span class="rounded-full bg-[#3a8f8a]/10 px-3 py-1 font-medium text-[#1a5c58]">Lv.{{ userLevel }}</span>
            <span
              class="rounded-full px-3 py-1 font-medium"
              :class="checkedInToday ? 'bg-[#3a8f8a]/15 text-[#1a5c58]' : 'bg-[#e59f48]/15 text-[#b85d00]'"
            >
              {{ checkedInToday ? '今日已打卡' : '今日待打卡' }}
            </span>
          </div>
        </div>
      </section>

      <section
        class="relative min-h-0 flex-1 overflow-hidden rounded-3xl border border-[#3a8f8a]/20 bg-gradient-to-b from-white/95 to-white/70 p-4 shadow-[0_16px_40px_rgba(22,88,85,0.08)] ring-1 ring-[rgba(58,143,138,0.08)] backdrop-blur-md sm:p-5"
      >
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-slate-700 sm:text-base">关卡地图</h2>
          <div class="text-xs text-slate-500 sm:text-sm">通关后自动解锁下一关，可重复挑战已通关关卡</div>
        </div>

        <div class="relative mx-auto max-w-3xl py-1">
          <div
            v-for="(stage, index) in mapStages"
            :key="stage.id"
            class="relative flex"
            :class="index % 2 === 0 ? 'justify-start' : 'justify-end'"
          >
            <div v-if="index < mapStages.length - 1" class="pointer-events-none absolute left-1/2 top-16 h-16 -translate-x-1/2">
              <div class="h-full border-l-[3px] border-dotted border-[#69c4bf]/60" />
            </div>

            <button
              type="button"
              class="group relative mb-6 w-[220px] rounded-2xl border px-4 py-3 text-left shadow-sm transition active:scale-[0.97]"
              :class="stageCardClass(stage)"
              :disabled="getStageStatus(stage) === 'locked'"
              @click="openStage(stage)"
            >
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold">第 {{ stage.order }} 关</span>
                <span class="text-base">
                  <template v-if="getStageStatus(stage) === 'completed'">✅</template>
                  <template v-else-if="getStageStatus(stage) === 'current'">⭐</template>
                  <template v-else>🔒</template>
                </span>
              </div>
              <p class="mt-1 text-sm font-semibold">{{ stage.name }}</p>
              <p class="mt-1 text-xs opacity-80">{{ stage.theme }}</p>
              <div
                v-if="newUnlockedStageId === stage.id"
                class="unlock-pop absolute -right-2 -top-2 rounded-full bg-gradient-to-r from-[#e59f48] to-[#d68529] px-2 py-0.5 text-[10px] font-semibold text-white shadow-md ring-2 ring-white/50"
              >
                新解锁
              </div>
            </button>
          </div>
        </div>

        <div class="mt-1 rounded-xl border border-dashed border-[rgba(58,143,138,0.25)] bg-white/60 px-3 py-2 text-xs text-[#5d6e6d]">
          当前地图仅展示 3 个关卡窗口，其余
          <span class="font-semibold text-[#1a5c58]">{{ hiddenLockedCount }}</span>
          关保持锁定并随进度自动轮换展示。
        </div>
      </section>

      <footer class="mt-3 rounded-2xl border border-[rgba(58,143,138,0.15)] bg-white/85 px-4 py-2.5 text-sm text-slate-600 shadow-sm backdrop-blur-md">
        当前进度：<span class="font-semibold text-[#1a5c58]">{{ completedStageCount }}</span> / {{ stages.length }} 关
      </footer>
    </main>

    <footer class="site-footer" id="footer">
      <div class="site-footer__row">
        <div class="site-footer__badges">
          <span class="seal">语韵东方</span>
          <span class="seal seal--outline">方言数字化</span>
        </div>
        <div class="site-footer__links">
          <a href="./index.html#top">首页</a>
          <a href="./index.html#features">功能</a>
          <a href="./index.html#vision">愿景</a>
        </div>
      </div>
      <p class="site-footer__copy">© 2026 语韵东方 · 地方方言语音合成与交互体验设计。保留所有权利。</p>
    </footer>

    <teleport to="body">
      <div
        v-if="stageDialogVisible && selectedStage"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
        @click.self="stageDialogVisible = false"
      >
        <div class="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
          <h3 class="text-xl font-semibold text-slate-900">{{ selectedStage.name }}</h3>
          <div class="mt-4 space-y-2 text-sm text-slate-600">
            <p>方言主题：{{ selectedStage.theme }}</p>
            <p>难度：{{ selectedStage.difficulty }}</p>
            <p>状态：{{ statusLabel(getStageStatus(selectedStage)) }}</p>
          </div>
          <div class="mt-6 flex justify-end gap-2">
            <button class="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50" @click="stageDialogVisible = false">取消</button>
            <button class="rounded-xl bg-gradient-to-r from-[#69c4bf] to-[#3a8f8a] px-4 py-2 text-sm font-medium text-white shadow-md transition hover:from-[#5ab5b0] hover:to-[#2b857a]" @click="startChallenge">开始挑战</button>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div
        v-if="challengeVisible && challengeStage"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      >
        <div class="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-slate-900">{{ challengeStage.name }}</h3>
              <p class="text-sm text-slate-500">题目 {{ challengeIndex + 1 }} / {{ challengeQuestions.length }}</p>
            </div>
            <div class="text-sm font-medium text-[#1a5c58]">通关进度 {{ challengeProgress }}%</div>
          </div>

          <div class="mb-5 h-2 overflow-hidden rounded-full bg-slate-100/80 ring-1 ring-inset ring-slate-200/50">
            <div class="h-full rounded-full bg-gradient-to-r from-[#69c4bf] to-[#e59f48] shadow-sm transition-all" :style="{ width: `${challengeProgress}%` }" />
          </div>

          <section v-if="currentQuestion" class="rounded-2xl bg-slate-50 p-4">
            <h4 class="text-base font-semibold text-slate-900">{{ questionTypeLabel(currentQuestion.type) }}</h4>

            <div v-if="currentQuestion.type === 'audioMeaning'" class="mt-3 space-y-3">
              <button class="rounded-xl bg-gradient-to-r from-[#69c4bf] to-[#3a8f8a] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:from-[#5ab5b0] hover:to-[#2b857a]" @click="playAudio(currentQuestion.audioUrl)">播放方言音频</button>
              <div class="grid gap-2 sm:grid-cols-2">
                <button
                  v-for="(option, idx) in currentQuestion.options"
                  :key="option"
                  class="rounded-xl border px-3 py-2.5 text-left text-sm transition"
                  :class="questionAnswer.choice === idx ? 'border-[#3a8f8a] bg-[#3a8f8a]/10 text-[#1a5c58] ring-1 ring-[#3a8f8a]/50' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'"
                  @click="questionAnswer.choice = idx"
                >
                  {{ idx + 1 }}. {{ option }}
                </button>
              </div>
            </div>

            <div v-else-if="currentQuestion.type === 'repeatScore'" class="mt-3 space-y-3">
              <p class="text-sm text-slate-700">请跟读：{{ currentQuestion.sentence }}</p>
              <div class="flex flex-wrap gap-2">
                <button class="rounded-xl bg-gradient-to-r from-[#69c4bf] to-[#3a8f8a] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:from-[#5ab5b0] hover:to-[#2b857a] disabled:opacity-40 disabled:hover:from-[#69c4bf] disabled:hover:to-[#3a8f8a]" :disabled="isRecording" @click="startRecording">开始录音</button>
                <button class="rounded-xl bg-gradient-to-r from-[#e59f48] to-[#d68529] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:from-[#d9943f] hover:to-[#c77a23] disabled:opacity-40 disabled:hover:from-[#e59f48] disabled:hover:to-[#d68529]" :disabled="!isRecording" @click="stopRecording">停止录音</button>
              </div>
              <p v-if="questionAnswer.score !== null" class="text-sm font-medium text-[#1a5c58]">AI 打分：{{ questionAnswer.score }} 分</p>
            </div>

            <div v-else-if="currentQuestion.type === 'fillBlank'" class="mt-3 space-y-3">
              <p class="text-sm text-slate-700">{{ currentQuestion.stem }}</p>
              <div class="grid gap-2 sm:grid-cols-2">
                <button
                  v-for="(option, idx) in currentQuestion.options"
                  :key="option"
                  class="rounded-xl border px-3 py-2.5 text-left text-sm transition"
                  :class="questionAnswer.choice === idx ? 'border-[#3a8f8a] bg-[#3a8f8a]/10 text-[#1a5c58] ring-1 ring-[#3a8f8a]/50' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'"
                  @click="questionAnswer.choice = idx"
                >
                  {{ option }}
                </button>
              </div>
            </div>

            <div v-else-if="currentQuestion.type === 'operaRepeat'" class="mt-3 space-y-3">
              <p class="text-sm text-slate-700">戏曲小片段：{{ currentQuestion.script }}</p>
              <div class="flex flex-wrap gap-2">
                <button class="rounded-xl bg-gradient-to-r from-[#69c4bf] to-[#3a8f8a] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:from-[#5ab5b0] hover:to-[#2b857a] disabled:opacity-40 disabled:hover:from-[#69c4bf] disabled:hover:to-[#3a8f8a]" :disabled="isRecording" @click="startRecording">开始录音</button>
                <button class="rounded-xl bg-gradient-to-r from-[#e59f48] to-[#d68529] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:from-[#d9943f] hover:to-[#c77a23] disabled:opacity-40 disabled:hover:from-[#e59f48] disabled:hover:to-[#d68529]" :disabled="!isRecording" @click="stopRecording">停止录音</button>
              </div>
              <p v-if="questionAnswer.score !== null" class="text-sm font-medium text-[#1a5c58]">跟读完成，评分：{{ questionAnswer.score }}</p>
            </div>
          </section>

          <div class="mt-5 flex flex-wrap justify-end gap-2">
            <button class="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50" @click="closeChallenge">中止挑战</button>
            <button class="rounded-xl bg-gradient-to-r from-[#e59f48] to-[#d68529] px-4 py-2 text-sm font-medium text-white shadow-md transition hover:from-[#d9943f] hover:to-[#c77a23]" @click="submitCurrentQuestion">
              {{ challengeIndex === challengeQuestions.length - 1 ? '提交并结算' : '提交下一题' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <teleport to="body">
      <div
        v-if="resultVisible"
        class="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
        @click.self="resultVisible = false"
      >
        <div class="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl ring-1 ring-black/5">
          <h3 class="text-2xl font-bold" :class="stagePassed ? 'text-[#3a8f8a]' : 'text-[#e59f48]'">
            {{ stagePassed ? '通关成功' : '继续努力' }}
          </h3>
          <p class="mt-3 text-sm font-medium text-slate-600">得分：<span class="text-lg text-slate-800">{{ stageScore }}</span> / 100</p>
          <p class="mt-2 text-sm text-slate-500">{{ stageComment }}</p>
          <p v-if="unlockMessage" class="mt-4 text-sm font-semibold text-[#e59f48] float-text">{{ unlockMessage }}</p>
          <button class="mt-6 w-full rounded-xl bg-gradient-to-r from-[#69c4bf] to-[#3a8f8a] px-4 py-3 text-sm font-medium text-white shadow-md transition hover:from-[#5ab5b0] hover:to-[#2b857a]" @click="resultVisible = false">返回地图</button>
        </div>
      </div>
    </teleport>

    <audio ref="audioRef" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const STORAGE_KEY = 'dialect-stage-adventure-progress'
const stages = ref([])
const completedIds = ref([])
const userLevel = ref(1)
const checkedInToday = ref(false)
const selectedStage = ref(null)
const stageDialogVisible = ref(false)
const challengeVisible = ref(false)
const challengeStage = ref(null)
const challengeQuestions = ref([])
const challengeIndex = ref(0)
const challengeProgress = ref(0)
const resultVisible = ref(false)
const stagePassed = ref(false)
const stageScore = ref(0)
const stageComment = ref('')
const unlockMessage = ref('')
const newUnlockedStageId = ref('')
const questionAnswer = ref({ choice: null, score: null, hasRecording: false })
const audioRef = ref(null)
const isRecording = ref(false)
let mediaRecorder = null
let mediaStream = null
let mediaChunks = []

const currentStageId = computed(() => {
  const next = stages.value.find((stage) => !completedIds.value.includes(stage.id))
  return next ? next.id : stages.value[stages.value.length - 1]?.id
})
const completedStageCount = computed(() => completedIds.value.length)
const currentQuestion = computed(() => challengeQuestions.value[challengeIndex.value] || null)
const mapStages = computed(() => {
  if (!stages.value.length) return []
  const currentIdx = stages.value.findIndex((stage) => stage.id === currentStageId.value)
  const safeCurrentIdx = currentIdx < 0 ? 0 : currentIdx
  let start = Math.max(0, safeCurrentIdx - 1)
  let end = Math.min(stages.value.length, start + 3)
  if (end - start < 3) start = Math.max(0, end - 3)
  return stages.value.slice(start, end)
})
const hiddenLockedCount = computed(() => Math.max(0, stages.value.length - mapStages.value.length))

function goBack() {
  if (window.history.length > 1) window.history.back()
}

function onAuthClick() {
  window.alert('登录 / 注册流程可在此对接统一认证。')
}

function getStageStatus(stage) {
  if (completedIds.value.includes(stage.id)) return 'completed'
  if (stage.id === currentStageId.value) return 'current'
  return 'locked'
}

function stageCardClass(stage) {
  const status = getStageStatus(stage)
  if (status === 'completed') return 'border-[#69c4bf]/40 bg-white/90 text-[#1a5c58] hover:shadow-md hover:border-[#69c4bf]/60 backdrop-blur-sm'
  if (status === 'current') return 'border-[#e59f48]/60 bg-gradient-to-br from-white/95 to-[#fdf8f2]/90 text-[#b85d00] shadow-[0_4px_20px_rgba(229,159,72,0.15)] hover:shadow-[0_6px_24px_rgba(229,159,72,0.25)] ring-2 ring-[#e59f48]/20 backdrop-blur-sm'
  return 'cursor-not-allowed border-slate-200/60 bg-slate-50/50 text-slate-400 backdrop-blur-sm'
}

function statusLabel(status) {
  if (status === 'completed') return '已通关'
  if (status === 'current') return '当前可挑战'
  return '未解锁'
}

function questionTypeLabel(type) {
  return {
    audioMeaning: '听音辨义',
    repeatScore: '跟读发音',
    fillBlank: '方言填空/选择',
    operaRepeat: '方言戏曲小片段跟读'
  }[type]
}

function openStage(stage) {
  if (getStageStatus(stage) === 'locked') return
  selectedStage.value = stage
  stageDialogVisible.value = true
}

async function startChallenge() {
  if (!selectedStage.value) return
  stageDialogVisible.value = false
  challengeStage.value = selectedStage.value
  challengeQuestions.value = await fetchStageQuestions(selectedStage.value.id)
  challengeIndex.value = 0
  challengeProgress.value = 0
  questionAnswer.value = { choice: null, score: null, hasRecording: false }
  challengeVisible.value = true
}

function closeChallenge() {
  challengeVisible.value = false
  resetRecordState()
}

function resetAnswerState() {
  questionAnswer.value = { choice: null, score: null, hasRecording: false }
}

function playAudio(url) {
  const el = audioRef.value
  if (!el || !url) return
  el.src = url
  el.currentTime = 0
  const p = el.play()
  if (p && typeof p.catch === 'function') p.catch(() => {})
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return
  mediaChunks = []
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(mediaStream)
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) mediaChunks.push(e.data)
    }
    mediaRecorder.onstop = () => {
      questionAnswer.value.hasRecording = mediaChunks.length > 0
      questionAnswer.value.score = 62 + Math.floor(Math.random() * 36)
    }
    mediaRecorder.start()
    isRecording.value = true
  } catch (error) {
    console.error('录音失败', error)
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return
  mediaRecorder.stop()
  isRecording.value = false
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop())
    mediaStream = null
  }
}

function evaluateQuestion(question) {
  if (!question) return false
  if (question.type === 'audioMeaning') return questionAnswer.value.choice === question.correctIndex
  if (question.type === 'fillBlank') return questionAnswer.value.choice === question.correctIndex
  if (question.type === 'repeatScore' || question.type === 'operaRepeat') {
    return questionAnswer.value.hasRecording && (questionAnswer.value.score || 0) >= 60
  }
  return false
}

async function submitCurrentQuestion() {
  const question = currentQuestion.value
  if (!question) return

  const correct = evaluateQuestion(question)
  if (correct) challengeProgress.value = Math.min(100, challengeProgress.value + 25)

  await submitStageAnswer(challengeStage.value.id, { questionId: question.id, correct, score: questionAnswer.value.score })

  if (challengeIndex.value < challengeQuestions.value.length - 1) {
    challengeIndex.value += 1
    resetAnswerState()
    return
  }

  finishStage()
}

function finishStage() {
  const score = challengeProgress.value
  stageScore.value = score
  stagePassed.value = score >= 100
  stageComment.value = score >= 100 ? '太棒了！你的乡音感知越来越强。' : '再试一次，争取拿到 100% 完整通关。'
  unlockMessage.value = ''

  if (stagePassed.value && challengeStage.value) {
    if (!completedIds.value.includes(challengeStage.value.id)) {
      completedIds.value.push(challengeStage.value.id)
      userLevel.value = Math.min(10, 1 + completedIds.value.length)
      markCheckInToday()
      const nextStage = stages.value.find((s) => !completedIds.value.includes(s.id))
      if (nextStage) {
        newUnlockedStageId.value = nextStage.id
        unlockMessage.value = `已解锁：第 ${nextStage.order} 关`
        window.setTimeout(() => {
          newUnlockedStageId.value = ''
        }, 1800)
      }
      saveProgress()
    }
  }

  challengeVisible.value = false
  resultVisible.value = true
  resetRecordState()
}

function markCheckInToday() {
  checkedInToday.value = true
}

function resetRecordState() {
  isRecording.value = false
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop())
    mediaStream = null
  }
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    completedIds.value = Array.isArray(data.completedIds) ? data.completedIds : []
    userLevel.value = data.userLevel || 1
    checkedInToday.value = data.checkInDate === new Date().toDateString()
  } catch {
    // ignore
  }
}

function saveProgress() {
  const payload = {
    completedIds: completedIds.value,
    userLevel: userLevel.value,
    checkInDate: checkedInToday.value ? new Date().toDateString() : ''
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

async function fetchStageList() {
  try {
    const res = await fetch('/api/stages/list')
    if (!res.ok) throw new Error('failed')
    const json = await res.json()
    stages.value = Array.isArray(json.data) ? json.data : json
  } catch {
    stages.value = mockStages()
  }
}

async function fetchStageQuestions(stageId) {
  try {
    const res = await fetch(`/api/stages/${stageId}`)
    if (!res.ok) throw new Error('failed')
    const json = await res.json()
    return Array.isArray(json.data?.questions) ? json.data.questions : json.questions
  } catch {
    return mockQuestions(stageId)
  }
}

async function submitStageAnswer(stageId, payload) {
  try {
    await fetch(`/api/stages/${stageId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch {
    // mock mode no-op
  }
}

function mockStages() {
  return [
    { id: 's1', order: 1, name: '乡音启程', theme: '吴语入门', difficulty: '简单' },
    { id: 's2', order: 2, name: '市井晨曲', theme: '粤语日常', difficulty: '简单' },
    { id: 's3', order: 3, name: '茶馆快问', theme: '川渝方言', difficulty: '中等' },
    { id: 's4', order: 4, name: '戏台试音', theme: '越剧片段', difficulty: '中等' },
    { id: 's5', order: 5, name: '乡韵进阶', theme: '多方言混合', difficulty: '困难' },
    { id: 's6', order: 6, name: '方音大师', theme: '综合挑战', difficulty: '困难' }
  ]
}

function mockQuestions(stageId) {
  return [
    {
      id: `${stageId}-q1`,
      type: 'audioMeaning',
      audioUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
      options: ['快点回家', '今天真热闹', '你吃饭了吗', '小雨下不停'],
      correctIndex: 2
    },
    {
      id: `${stageId}-q2`,
      type: 'repeatScore',
      sentence: '侬今朝开心伐？'
    },
    {
      id: `${stageId}-q3`,
      type: 'fillBlank',
      stem: '方言填空：阿拉___去茶馆白相。',
      options: ['今朝', '昨日', '明朝', '晚点'],
      correctIndex: 0
    },
    {
      id: `${stageId}-q4`,
      type: 'operaRepeat',
      script: '越音轻转，水袖拂风，侬且听我唱一段。'
    }
  ]
}

onMounted(async () => {
  loadProgress()
  await fetchStageList()
})

onBeforeUnmount(() => {
  resetRecordState()
})
</script>

<style scoped>
.unlock-pop {
  animation: pop 0.6s ease;
}
.float-text {
  animation: float-up 1.1s ease;
}
@keyframes pop {
  0% {
    transform: scale(0.7);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
@keyframes float-up {
  0% {
    transform: translateY(8px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
