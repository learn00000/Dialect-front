<template>
  <div class="stage-adventure flex h-screen flex-col overflow-hidden font-serif text-[#3d3530]">
    <header class="site-header shrink-0">
      <a class="brand" href="./index.html#top">
        <span class="brand__mark" aria-hidden="true"></span>
        <span class="brand__text">语韵东方</span>
      </a>
      <nav class="nav" aria-label="主导航">
        <a class="nav__link" href="./index.html#top">首页</a>
        <a class="nav__link nav__link--active" href="./study.html">方音拾级</a>
        <a class="nav__link" href="./map.html">声绘山河</a>
        <a class="nav__link" href="./index.html#opera">方音戏韵</a>
      </nav>
    </header>

    <main class="relative mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 flex-col overflow-hidden pb-2">
      <!-- 关卡地图：铺满进度条以上区域，控件叠在地图之上 -->
      <section
        class="map-stage relative min-h-0 flex-1 overflow-hidden"
        :style="{ backgroundImage: `url(${mapBackground})` }"
        aria-label="方言闯关地图"
      >
        <div class="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-start justify-between sm:inset-x-5 sm:top-4">
          <button
            type="button"
            class="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#8D6E63]/35 bg-paper/90 text-sm text-[#8D6E63] shadow-[0_2px_12px_rgba(141,110,99,0.12)] backdrop-blur-sm transition hover:border-brand-green/50 hover:text-brand-green"
            aria-label="返回"
            @click="goBack"
          >
            ←
          </button>
          <div class="pointer-events-auto flex items-center gap-2 sm:gap-3">
            <span
              class="inline-flex items-center rounded-sm border border-brand-green/25 bg-paper/90 px-2.5 py-1 font-sans text-xs font-medium text-brand-green shadow-sm backdrop-blur-sm sm:text-sm"
            >
              Lv.{{ userLevel }}
            </span>
            <button
              type="button"
              class="checkin-seal inline-flex items-center gap-1 rounded-sm border-2 border-[#c0392b]/70 bg-[#fdf5f3] px-3 py-1 font-sans text-xs font-medium text-[#c0392b] shadow-[inset_0_0_0_1px_rgba(192,57,43,0.15)] transition hover:scale-[1.03] active:scale-95 sm:text-sm"
              :class="checkedInToday ? 'opacity-70' : 'animate-pulse-subtle'"
              :disabled="checkedInToday"
              @click="onCheckIn"
            >
              {{ checkedInToday ? '已打卡' : '今日待打卡' }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-sm border border-[#8D6E63]/35 bg-paper/90 px-2.5 py-1 font-sans text-xs font-medium text-[#8D6E63] shadow-sm backdrop-blur-sm transition hover:border-brand-green/45 hover:text-brand-green active:scale-95 sm:px-3 sm:text-sm"
              aria-label="清空闯关记录"
              title="清空闯关进度与打卡记录"
              @click="onResetProgress"
            >
              ↻ 重置
            </button>
          </div>
        </div>

        <div class="map-canvas__frame absolute inset-0 flex items-center justify-center">
          <div class="map-canvas__art relative leading-[0]">
            <img
              :src="mapBackground"
              class="map-canvas__bg pointer-events-none block h-full w-full select-none"
              alt=""
              draggable="false"
            />

            <div class="map-canvas__overlay absolute inset-0">
            <!-- 连接路径（叠在底图河道之上，略透明） -->
            <svg class="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <template v-for="(seg, idx) in pathSegments" :key="`path-${idx}`">
                <path
                  :d="seg.d"
                  fill="none"
                  :stroke="seg.completed ? 'rgba(212,175,55,0.45)' : 'rgba(105,196,191,0.22)'"
                  :stroke-width="seg.completed ? 0.42 : 0.28"
                  stroke-linecap="round"
                  :stroke-dasharray="seg.completed ? 'none' : '1.2 1.8'"
                />
                <path
                  v-if="seg.completed"
                  :d="seg.d"
                  fill="none"
                  stroke="url(#gold-flow-inline)"
                  stroke-width="0.34"
                  stroke-linecap="round"
                  class="path-flow"
                />
              </template>
              <defs>
                <linearGradient id="gold-flow-inline" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="rgba(212,175,55,0)" />
                  <stop offset="40%" stop-color="rgba(212,175,55,0.7)" />
                  <stop offset="60%" stop-color="rgba(255,215,120,0.9)" />
                  <stop offset="100%" stop-color="rgba(212,175,55,0)" />
                </linearGradient>
              </defs>
            </svg>
            </div>

            <!-- 关卡矩形节点（中心对齐底图地标） -->
            <div
              v-for="stage in stages"
              :key="stage.id"
              class="stage-node-wrap absolute"
              :class="{ 'stage-node-wrap--hover': hoverStageId === stage.id }"
              :style="nodeStyle(stage.id)"
            >
              <button
                type="button"
                class="stage-node group relative block"
                :class="stageNodeClass(stage)"
                :aria-label="`第 ${stage.order} 关 ${stage.name}`"
                @click="onStageClick(stage)"
                @mouseenter="hoverStageId = stage.id"
                @mouseleave="hoverStageId = ''"
                @focus="hoverStageId = stage.id"
                @blur="hoverStageId = ''"
              >
                <div class="stage-node__card relative flex w-[clamp(5.25rem,13vw,6.75rem)] min-w-[5.25rem] flex-col rounded-md border-2 px-2 py-1.5 transition-transform duration-300 group-hover:scale-105">
                  <div class="flex items-center justify-between gap-1">
                    <span class="font-sans text-[9px] leading-none tracking-wider opacity-75 sm:text-[10px]">第 {{ stage.order }} 关</span>
                    <span class="stage-node__badge flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-[9px] sm:h-[18px] sm:w-[18px] sm:text-[10px]">
                      <template v-if="getStageStatus(stage) === 'completed'">★</template>
                      <template v-else-if="getStageStatus(stage) === 'current'">◆</template>
                      <template v-else>
                        <svg class="h-2.5 w-2.5 opacity-60 sm:h-3 sm:w-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M17 10h-1V7c0-2.76-2.24-5-5-5S6 4.24 6 7v3H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H9.9V7c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v3z" />
                        </svg>
                      </template>
                    </span>
                  </div>
                  <span class="stage-node__name mt-1 text-center text-[10px] font-medium leading-tight sm:text-[11px]">{{ stage.name }}</span>
                  <div
                    v-if="newUnlockedStageId === stage.id"
                    class="unlock-pop absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-[#c0392b] px-2 py-0.5 font-sans text-[10px] text-white shadow-md"
                  >
                    新解锁
                  </div>
                </div>
              </button>

              <div
                v-if="checkInStampIds.includes(stage.id)"
                class="checkin-stamp pointer-events-none absolute z-20"
                aria-hidden="true"
              >
                打卡
              </div>

              <div
                v-if="hoverStageId === stage.id"
                class="stage-tooltip pointer-events-none absolute bottom-full left-1/2 mb-2 w-[min(14rem,42vw)] -translate-x-1/2"
                role="tooltip"
              >
                <p class="text-xs font-medium text-brand-green">{{ stageMeta(stage.id).region }}</p>
                <p class="mt-1 text-[11px] leading-relaxed text-[#3d3530]">{{ stageMeta(stage.id).desc }}</p>
                <p class="mt-1 font-sans text-[10px] text-[#5d534d]">难度 · {{ stage.difficulty }}</p>
              </div>
            </div>
          </div>
        </div>

        <h1 class="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-paper/75 px-3 py-0.5 font-serif text-sm font-medium tracking-[0.2em] text-[#8D6E63]/80 shadow-sm backdrop-blur-sm sm:bottom-4 sm:text-base">
          方言闯关大冒险
        </h1>
      </section>

      <!-- 卷轴进度条 -->
      <div class="scroll-progress relative mx-3 mt-2 shrink-0 rounded-xl border border-[#8D6E63]/15 bg-paper/90 px-4 py-3 shadow-sm backdrop-blur-sm sm:mx-5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="font-sans text-sm text-[#5d534d]">
            当前进度：<span class="font-medium text-brand-green">{{ completedStageCount }}</span> / {{ stages.length }} 关
          </p>
          <p class="font-sans text-[11px] text-[#8D6E63]/75 sm:text-xs">
            通关后自动解锁下一关，可重复挑战已通关关卡
          </p>
        </div>
        <div class="scroll-progress__track relative mt-2.5 h-3 overflow-hidden rounded-full border border-[#8D6E63]/20 bg-[#f0ebe3]">
          <div
            class="scroll-progress__fill h-full rounded-full bg-gradient-to-r from-brand-green/80 to-[#69c4bf] transition-all duration-700"
            :style="{ width: `${progressPercent}%` }"
          />
          <div class="scroll-progress__knob absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-[#8D6E63]/30 bg-paper shadow-sm transition-all duration-700" :style="{ left: `calc(${progressPercent}% - 8px)` }" />
        </div>
      </div>
    </main>

    <!-- 提示 toast -->
    <teleport to="body">
      <div
        v-if="toastMessage"
        class="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-lg border border-[#8D6E63]/25 bg-paper/95 px-4 py-2.5 font-sans text-sm text-[#5d534d] shadow-lg backdrop-blur-sm"
        role="status"
      >
        {{ toastMessage }}
      </div>
    </teleport>

    <!-- 水墨过渡 -->
    <teleport to="body">
      <div v-if="inkTransitionVisible" class="ink-overlay fixed inset-0 z-[55] pointer-events-none" aria-hidden="true">
        <div class="ink-overlay__blot" />
      </div>
    </teleport>

    <!-- 关卡详情弹窗 -->
    <teleport to="body">
      <div
        v-if="stageDialogVisible && selectedStage"
        class="stage-dialog-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="stageDialogVisible = false"
      >
        <div class="stage-dialog-panel w-full max-w-md rounded-xl border border-[#8D6E63]/30 p-6 shadow-2xl">
          <h3 class="text-xl font-medium text-brand-green">{{ selectedStage.name }}</h3>
          <div class="mt-4 space-y-2 text-sm text-[#3d3530]">
            <p>方言主题：{{ selectedStage.theme }}</p>
            <p>地域：{{ stageMeta(selectedStage.id).region }}</p>
            <p>难度：{{ selectedStage.difficulty }}</p>
            <p>状态：{{ statusLabel(getStageStatus(selectedStage)) }}</p>
            <p class="text-xs leading-relaxed text-[#5d534d]">{{ stageMeta(selectedStage.id).desc }}</p>
          </div>
          <div class="mt-6 flex justify-end gap-2">
            <button class="rounded-lg border border-[#8D6E63]/30 bg-white px-4 py-2 font-sans text-sm text-[#5d534d] transition hover:bg-[#f5f0e8]" @click="stageDialogVisible = false">取消</button>
            <button class="stage-dialog-btn stage-dialog-btn--primary rounded-lg px-4 py-2 font-sans text-sm font-medium shadow-md" @click="startChallenge">开始挑战</button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- 闯关答题（保留原有逻辑） -->
    <teleport to="body">
      <div
        v-if="challengeVisible && challengeStage"
        class="stage-dialog-overlay fixed inset-0 z-[60] flex items-center justify-center p-4"
      >
        <div class="stage-dialog-panel w-full max-w-3xl rounded-xl border border-[#8D6E63]/30 p-5 shadow-2xl sm:p-6">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-medium text-brand-green">{{ challengeStage.name }}</h3>
              <p class="font-sans text-sm text-[#8D6E63]">题目 {{ challengeIndex + 1 }} / {{ challengeQuestions.length }}</p>
            </div>
            <div class="font-sans text-sm font-medium text-brand-green">通关进度 {{ challengeProgress }}%</div>
          </div>

          <div class="mb-5 h-2 overflow-hidden rounded-full bg-[#f0ebe3] ring-1 ring-inset ring-[#8D6E63]/10">
            <div class="h-full rounded-full bg-gradient-to-r from-brand-green to-[#d4af37] transition-all" :style="{ width: `${challengeProgress}%` }" />
          </div>

          <section v-if="currentQuestion" class="rounded-xl border border-[#8D6E63]/15 bg-white p-4">
            <h4 class="text-base font-medium text-[#3d3530]">{{ questionTypeLabel(currentQuestion.type) }}</h4>

            <div v-if="currentQuestion.type === 'audioMeaning'" class="mt-3 space-y-3">
              <button class="stage-dialog-btn stage-dialog-btn--primary rounded-lg px-4 py-2.5 font-sans text-sm font-medium shadow-sm disabled:opacity-40" @click="playAudio(currentQuestion.audioUrl)">播放方言音频</button>
              <div class="grid gap-2 sm:grid-cols-2">
                <button
                  v-for="(option, idx) in currentQuestion.options"
                  :key="option"
                  class="rounded-lg border px-3 py-2.5 text-left font-sans text-sm transition"
                  :class="questionAnswer.choice === idx ? 'border-brand-green bg-brand-green/10 text-brand-green ring-1 ring-brand-green/40' : 'border-[#8D6E63]/20 bg-white text-[#5d534d] hover:border-[#8D6E63]/40'"
                  @click="questionAnswer.choice = idx"
                >
                  {{ option }}
                </button>
              </div>
            </div>

            <div v-else-if="currentQuestion.type === 'repeatScore'" class="mt-3 space-y-3">
              <p class="text-sm text-[#5d534d]">请跟读：{{ currentQuestion.sentence }}</p>
              <button
                v-if="currentQuestion.referenceAudioUrl"
                type="button"
                class="stage-dialog-btn stage-dialog-btn--secondary rounded-lg px-4 py-2 font-sans text-sm font-medium shadow-sm"
                @click="playAudio(currentQuestion.referenceAudioUrl)"
              >
                播放示范读音
              </button>
              <div class="flex flex-wrap gap-2">
                <button class="stage-dialog-btn stage-dialog-btn--primary rounded-lg px-4 py-2.5 font-sans text-sm font-medium disabled:opacity-40" :disabled="isRecording || isScoring" @click="startRecording">开始录音</button>
                <button class="stage-dialog-btn stage-dialog-btn--secondary rounded-lg px-4 py-2.5 font-sans text-sm font-medium disabled:opacity-40" :disabled="!isRecording" @click="stopRecording">停止录音</button>
              </div>
              <p v-if="isScoring" class="font-sans text-sm text-[#8D6E63]">正在分析跟读相似度…</p>
              <p v-else-if="questionAnswer.score !== null" class="font-sans text-sm font-medium text-brand-green">
                发音相似度：{{ questionAnswer.score }} 分（{{ (currentQuestion.passScore || 60) }} 分及以上通过）
              </p>
            </div>

            <div v-else-if="currentQuestion.type === 'idiomMeaning'" class="mt-3 space-y-3">
              <p class="text-sm text-[#5d534d]">{{ currentQuestion.stem }}</p>
              <div class="grid gap-2 sm:grid-cols-2">
                <button
                  v-for="(option, idx) in currentQuestion.options"
                  :key="option"
                  class="rounded-lg border px-3 py-2.5 text-left font-sans text-sm transition"
                  :class="questionAnswer.choice === idx ? 'border-brand-green bg-brand-green/10 text-brand-green ring-1 ring-brand-green/40' : 'border-[#8D6E63]/20 bg-white text-[#5d534d] hover:border-[#8D6E63]/40'"
                  @click="questionAnswer.choice = idx"
                >
                  {{ option }}
                </button>
              </div>
            </div>

            <div v-else-if="currentQuestion.type === 'fillBlank'" class="mt-3 space-y-3">
              <p class="text-sm text-[#5d534d]">{{ currentQuestion.stem }}</p>
              <div class="grid gap-2 sm:grid-cols-2">
                <button
                  v-for="(option, idx) in currentQuestion.options"
                  :key="option"
                  class="rounded-lg border px-3 py-2.5 text-left font-sans text-sm transition"
                  :class="questionAnswer.choice === idx ? 'border-brand-green bg-brand-green/10 text-brand-green ring-1 ring-brand-green/40' : 'border-[#8D6E63]/20 bg-white text-[#5d534d] hover:border-[#8D6E63]/40'"
                  @click="questionAnswer.choice = idx"
                >
                  {{ option }}
                </button>
              </div>
            </div>

            <div v-else-if="currentQuestion.type === 'operaRepeat'" class="mt-3 space-y-3">
              <p class="text-sm text-[#5d534d]">戏曲小片段：{{ currentQuestion.script }}</p>
              <div class="flex flex-wrap gap-2">
                <button class="stage-dialog-btn stage-dialog-btn--primary rounded-lg px-4 py-2.5 font-sans text-sm font-medium disabled:opacity-40" :disabled="isRecording" @click="startRecording">开始录音</button>
                <button class="stage-dialog-btn stage-dialog-btn--secondary rounded-lg px-4 py-2.5 font-sans text-sm font-medium disabled:opacity-40" :disabled="!isRecording" @click="stopRecording">停止录音</button>
              </div>
              <p v-if="questionAnswer.score !== null" class="font-sans text-sm font-medium text-brand-green">跟读完成，评分：{{ questionAnswer.score }}</p>
            </div>
          </section>

          <div class="mt-5 flex flex-wrap justify-end gap-2">
            <button class="rounded-lg border border-[#8D6E63]/30 bg-white px-4 py-2 font-sans text-sm text-[#5d534d] transition hover:bg-[#f5f0e8]" @click="closeChallenge">中止挑战</button>
            <button class="stage-dialog-btn stage-dialog-btn--secondary rounded-lg px-4 py-2 font-sans text-sm font-medium shadow-md" @click="submitCurrentQuestion">
              {{ challengeIndex === challengeQuestions.length - 1 ? '提交并结算' : '提交下一题' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- 结算弹窗 -->
    <teleport to="body">
      <div
        v-if="resultVisible"
        class="stage-dialog-overlay fixed inset-0 z-[70] flex items-center justify-center p-4"
        @click.self="resultVisible = false"
      >
        <div class="stage-dialog-panel w-full max-w-md rounded-xl border border-[#8D6E63]/30 p-6 text-center shadow-2xl">
          <h3 class="text-2xl font-medium" :class="stagePassed ? 'text-brand-green' : 'text-ochre'">
            {{ stagePassed ? '通关成功' : '继续努力' }}
          </h3>
          <p class="mt-3 font-sans text-sm font-medium text-[#5d534d]">得分：<span class="text-lg text-[#3d3530]">{{ stageScore }}</span> / 100</p>
          <p class="mt-2 font-sans text-sm text-[#8D6E63]">{{ stageComment }}</p>
          <p v-if="unlockMessage" class="float-text mt-4 font-sans text-sm font-medium text-[#c0392b]">{{ unlockMessage }}</p>
          <button class="stage-dialog-btn stage-dialog-btn--primary mt-6 w-full rounded-lg px-4 py-3 font-sans text-sm font-medium shadow-md" @click="resultVisible = false">返回地图</button>
        </div>
      </div>
    </teleport>

    <audio ref="audioRef" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import mapBackground from '../../assets/study-map/background.png'
import { getStageQuestions } from '../../js/stage-questions-data.mjs'
import { scoreRepeatSimilarity } from '../utils/repeatScore.js'

const STORAGE_KEY = 'dialect-stage-adventure-progress'

/** 7 关坐标对齐 background.png 建筑地标（2560×1440，百分比） */
const STAGE_LAYOUT = {
  s1: { x: 17.6, y: 80.4, region: '江南水乡', desc: '左下水乡启程，乌篷船畔学习吴侬软语的日常问候。' },
  s2: { x: 50.5, y: 75.8, region: '岭南骑楼', desc: '中下骑楼街，彩色满洲窗下感受粤语广府片的市井晨曲。' },
  s3: { x: 18.4, y: 52.3, region: '山城吊脚', desc: '左中木构吊脚聚落，在江畔茶馆听懂川渝快问快答。' },
  s4: { x: 74.4, y: 54.4, region: '钱塘越地', desc: '右中湖心六角亭，跟读越剧之乡的经典戏腔片段。' },
  s5: { x: 49.4, y: 27.6, region: '中原交汇', desc: '上中大树院落，多方言交汇，辨音解意、融会贯通。' },
  s6: { x: 17.6, y: 25.6, region: '燕赵大地', desc: '左上关城隘口，在城楼之下辨听燕赵乡音。' },
  s7: { x: 81.5, y: 74.5, region: '岭海埠头', desc: '右下棕榈埠头，综合挑战你的乡音感知力。' }
}

/** 沿河道顺序：左下 → 中下 → 左中 → 右中 → 上中 → 左上 → 右下终关 */
const PATH_CURVES = {
  's1-s2': 'M 17.6 80.4 Q 34 79 50.5 75.8',
  's2-s3': 'M 50.5 75.8 Q 28 66 18.4 52.3',
  's3-s4': 'M 18.4 52.3 Q 46 53.5 74.4 54.4',
  's4-s5': 'M 74.4 54.4 Q 62 38 49.4 27.6',
  's5-s6': 'M 49.4 27.6 Q 33 26.5 17.6 25.6',
  's6-s7': 'M 17.6 25.6 Q 48 58 81.5 74.5'
}

const stages = ref([])
const completedIds = ref([])
const userLevel = ref(1)
const checkedInToday = ref(false)
const checkInStampIds = ref([])
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
const isScoring = ref(false)
const hoverStageId = ref('')
const toastMessage = ref('')
const inkTransitionVisible = ref(false)
let toastTimer = null
let mediaRecorder = null
let mediaStream = null
let mediaChunks = []
let recordedBlob = null

const currentStageId = computed(() => {
  const next = stages.value.find((stage) => !completedIds.value.includes(stage.id))
  return next ? next.id : stages.value[stages.value.length - 1]?.id
})
const completedStageCount = computed(() => completedIds.value.length)
const progressPercent = computed(() => {
  if (!stages.value.length) return 0
  return Math.round((completedStageCount.value / stages.value.length) * 100)
})
const currentQuestion = computed(() => challengeQuestions.value[challengeIndex.value] || null)

const pathSegments = computed(() => {
  const list = stages.value
  if (list.length < 2) return []
  return list.slice(0, -1).map((stage, idx) => {
    const next = list[idx + 1]
    const key = `${stage.id}-${next.id}`
    const curved = PATH_CURVES[key]
    if (curved) {
      return { d: curved, completed: completedIds.value.includes(stage.id) }
    }
    const from = STAGE_LAYOUT[stage.id] || { x: 50, y: 50 }
    const to = STAGE_LAYOUT[next.id] || { x: 50, y: 50 }
    const cpx = (from.x + to.x) / 2
    const cpy = (from.y + to.y) / 2 - 3
    return {
      d: `M ${from.x} ${from.y} Q ${cpx} ${cpy} ${to.x} ${to.y}`,
      completed: completedIds.value.includes(stage.id)
    }
  })
})

function stageMeta(id) {
  return STAGE_LAYOUT[id] || { region: '', desc: '', x: 50, y: 50 }
}

function nodeStyle(id) {
  const { x, y } = stageMeta(id)
  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: 'translate(-50%, -50%)'
  }
}

function goBack() {
  if (window.history.length > 1) window.history.back()
  else window.location.href = './index.html'
}

function showToast(msg) {
  toastMessage.value = msg
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastMessage.value = ''
  }, 2400)
}

function getStageStatus(stage) {
  if (completedIds.value.includes(stage.id)) return 'completed'
  if (stage.id === currentStageId.value) return 'current'
  return 'locked'
}

function stageNodeClass(stage) {
  const status = getStageStatus(stage)
  if (status === 'completed') return 'stage-node--completed'
  if (status === 'current') return 'stage-node--current'
  return 'stage-node--locked'
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
    idiomMeaning: '俗语解析',
    fillBlank: '方言填空/选择',
    operaRepeat: '方言戏曲小片段跟读'
  }[type]
}

function onStageClick(stage) {
  if (getStageStatus(stage) === 'locked') {
    showToast('通关前一关解锁')
    return
  }
  openStage(stage)
}

function openStage(stage) {
  selectedStage.value = stage
  stageDialogVisible.value = true
}

function onCheckIn() {
  if (checkedInToday.value) return
  checkedInToday.value = true
  addCheckInStamp(currentStageId.value)
  saveProgress()
  showToast('今日打卡成功，印章已盖！')
}

function onResetProgress() {
  const ok = window.confirm('确定清空闯关进度？通关记录、等级与打卡印章将被清除，且无法恢复。')
  if (!ok) return
  localStorage.removeItem(STORAGE_KEY)
  completedIds.value = []
  userLevel.value = 1
  checkedInToday.value = false
  checkInStampIds.value = []
  newUnlockedStageId.value = ''
  stageDialogVisible.value = false
  challengeVisible.value = false
  resultVisible.value = false
  showToast('闯关记录已清零')
}

function addCheckInStamp(stageId) {
  if (!stageId || checkInStampIds.value.includes(stageId)) return
  checkInStampIds.value = [...checkInStampIds.value, stageId]
}

function markCheckInToday(stageId) {
  checkedInToday.value = true
  addCheckInStamp(stageId)
}

async function startChallenge() {
  if (!selectedStage.value) return
  stageDialogVisible.value = false
  inkTransitionVisible.value = true
  await new Promise((r) => window.setTimeout(r, 680))
  challengeStage.value = selectedStage.value
  challengeQuestions.value = await fetchStageQuestions(selectedStage.value.id)
  challengeIndex.value = 0
  challengeProgress.value = 0
  questionAnswer.value = { choice: null, score: null, hasRecording: false }
  challengeVisible.value = true
  inkTransitionVisible.value = false
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
  recordedBlob = null
  questionAnswer.value.score = null
  questionAnswer.value.hasRecording = false
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(mediaStream)
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) mediaChunks.push(e.data)
    }
    mediaRecorder.onstop = async () => {
      recordedBlob = new Blob(mediaChunks, { type: mediaRecorder.mimeType || 'audio/webm' })
      questionAnswer.value.hasRecording = recordedBlob.size > 0
      const question = currentQuestion.value
      if (!questionAnswer.value.hasRecording) {
        questionAnswer.value.score = 0
        isScoring.value = false
        return
      }
      isScoring.value = true
      try {
        const refUrl = question?.referenceAudioUrl || question?.audioUrl || ''
        questionAnswer.value.score = refUrl
          ? await scoreRepeatSimilarity(refUrl, recordedBlob)
          : 55
      } finally {
        isScoring.value = false
      }
    }
    mediaRecorder.start()
    isRecording.value = true
  } catch (error) {
    console.error('录音失败', error)
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return
  isScoring.value = true
  mediaRecorder.stop()
  isRecording.value = false
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop())
    mediaStream = null
  }
}

function evaluateQuestion(question) {
  if (!question) return false
  if (question.type === 'audioMeaning' || question.type === 'idiomMeaning' || question.type === 'fillBlank') {
    return questionAnswer.value.choice === question.correctIndex
  }
  if (question.type === 'repeatScore' || question.type === 'operaRepeat') {
    const passScore = question.passScore ?? 60
    return questionAnswer.value.hasRecording && (questionAnswer.value.score ?? 0) >= passScore
  }
  return false
}

function progressStep() {
  const total = challengeQuestions.value.length || 3
  return Math.ceil(100 / total)
}

async function submitCurrentQuestion() {
  const question = currentQuestion.value
  if (!question) return

  if (question.type === 'audioMeaning' || question.type === 'idiomMeaning' || question.type === 'fillBlank') {
    if (questionAnswer.value.choice === null) {
      showToast('请先选择一个选项')
      return
    }
  }
  if (question.type === 'repeatScore' || question.type === 'operaRepeat') {
    if (isScoring.value) {
      showToast('正在评分，请稍候')
      return
    }
    if (!questionAnswer.value.hasRecording || questionAnswer.value.score === null) {
      showToast('请先完成跟读录音')
      return
    }
  }

  const correct = evaluateQuestion(question)
  if (correct) challengeProgress.value = Math.min(100, challengeProgress.value + progressStep())

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
      markCheckInToday(challengeStage.value.id)
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

function resetRecordState() {
  isRecording.value = false
  isScoring.value = false
  recordedBlob = null
  mediaChunks = []
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
    checkInStampIds.value = Array.isArray(data.checkInStampIds) ? data.checkInStampIds : []
  } catch {
    // ignore
  }
}

function saveProgress() {
  const payload = {
    completedIds: completedIds.value,
    userLevel: userLevel.value,
    checkInDate: checkedInToday.value ? new Date().toDateString() : '',
    checkInStampIds: checkInStampIds.value
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
    { id: 's6', order: 6, name: '关城辨音', theme: '燕赵方音', difficulty: '困难' },
    { id: 's7', order: 7, name: '方音大师', theme: '综合挑战', difficulty: '大师' }
  ]
}

function mockQuestions(stageId) {
  return getStageQuestions(stageId)
}

onMounted(async () => {
  loadProgress()
  await fetchStageList()
})

onBeforeUnmount(() => {
  resetRecordState()
  if (toastTimer) window.clearTimeout(toastTimer)
})
</script>

<style scoped>
.stage-adventure {
  background-color: #faf7f0;
  background-image:
    radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255, 255, 255, 0.9) 0%, transparent 55%),
    radial-gradient(ellipse 40% 30% at 0% 100%, rgba(46, 125, 50, 0.06) 0%, transparent 50%),
    linear-gradient(175deg, #faf7f0 0%, #f3efe6 45%, #faf7f0 100%);
}

.stage-dialog-overlay {
  background-color: rgba(28, 24, 20, 0.58);
}

.stage-dialog-panel {
  background-color: #fbf8f2;
  color: #3d3530;
}

.stage-dialog-btn {
  transition: background-color 0.2s ease, color 0.2s ease;
}

.stage-dialog-btn--primary {
  background-color: #96e9a6;
  color: #1f1f1f;
}

.stage-dialog-btn--primary:hover:not(:disabled) {
  background-color: #7ed992;
  color: #1f1f1f;
}

.stage-dialog-btn--secondary {
  background-color: #96e9a6;
  color: #1f1f1f;
}

.stage-dialog-btn--secondary:hover:not(:disabled) {
  background-color: #7ed992;
  color: #1f1f1f;
}

.map-stage {
  container-type: size;
  background-color: #f5f0e8;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.map-canvas__frame {
  padding: 0;
}

.map-canvas__art {
  position: relative;
  aspect-ratio: 16 / 9;
  width: min(100cqw, calc(100cqh * 16 / 9));
  height: min(100cqh, calc(100cqw * 9 / 16));
  max-width: 100%;
  max-height: 100%;
}

.map-canvas__overlay {
  z-index: 1;
  pointer-events: none;
}

.stage-node-wrap {
  pointer-events: auto;
  z-index: 10;
}

.stage-node-wrap--hover {
  z-index: 100;
}

.stage-tooltip {
  z-index: 110;
  border-radius: 0.5rem;
  border: 1px solid rgba(141, 110, 99, 0.25);
  background-color: #ffffff;
  padding: 0.625rem 0.75rem;
  text-align: center;
  box-shadow: 0 8px 24px rgba(61, 53, 48, 0.16);
}

.stage-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #ffffff;
  filter: drop-shadow(0 2px 1px rgba(141, 110, 99, 0.12));
}

.map-canvas__bg {
  filter: saturate(0.96);
  object-fit: cover;
}

/* 矩形关卡牌：水墨卷轴标签风格 */
.stage-node__name {
  white-space: nowrap;
}

.stage-node__card {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.65),
    inset 0 0 0 1px rgba(141, 110, 99, 0.08),
    0 4px 14px rgba(61, 53, 48, 0.14);
}

.stage-node__card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 3px 0 0 3px;
  background: rgba(141, 110, 99, 0.25);
}

.stage-node--locked .stage-node__card {
  border-color: rgba(141, 110, 99, 0.28);
  background: rgba(245, 240, 232, 0.94);
  color: rgba(93, 83, 77, 0.55);
}

.stage-node--locked .stage-node__card::before {
  background: rgba(141, 110, 99, 0.18);
}

.stage-node--current .stage-node__card {
  border-color: rgba(212, 175, 55, 0.85);
  background: linear-gradient(145deg, rgba(255, 252, 245, 0.98) 0%, rgba(255, 246, 224, 0.95) 100%);
  color: #6d4c1a;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    inset 0 0 0 1px rgba(212, 175, 55, 0.2),
    0 0 16px rgba(212, 175, 55, 0.24),
    0 4px 14px rgba(61, 53, 48, 0.1);
}

.stage-node--current .stage-node__card::before {
  background: linear-gradient(180deg, #d4af37, #b8942a);
}

.stage-node--completed .stage-node__card {
  border-color: rgba(212, 175, 55, 0.62);
  background: linear-gradient(145deg, rgba(255, 253, 248, 0.97) 0%, rgba(252, 245, 228, 0.94) 100%);
  color: #3d3530;
}

.stage-node--completed .stage-node__card::before {
  background: linear-gradient(180deg, rgba(212, 175, 55, 0.75), rgba(184, 148, 42, 0.65));
}

.stage-node--completed .stage-node__badge {
  background: linear-gradient(135deg, #d4af37, #f5d76e);
  color: #5c4a12;
  box-shadow: 0 1px 4px rgba(212, 175, 55, 0.4);
}

.stage-node--current .stage-node__badge {
  background: #2e7d32;
  color: #fff;
}

.stage-node--locked .stage-node__badge {
  background: rgba(141, 110, 99, 0.15);
  color: rgba(93, 83, 77, 0.5);
}

.stage-node--locked {
  cursor: not-allowed;
}

/* 路径金色流动 */
.path-flow {
  stroke-dasharray: 4 8;
  animation: path-flow 3s linear infinite;
}

@keyframes path-flow {
  to {
    stroke-dashoffset: -24;
  }
}

/* 打卡印章 */
.checkin-seal:not(:disabled) {
  transform-origin: center;
}

.checkin-stamp {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 3.2rem;
  height: 3.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid rgba(192, 57, 43, 0.75);
  border-radius: 50%;
  color: rgba(192, 57, 43, 0.85);
  font-family: 'Noto Serif SC', serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  transform: translate(-50%, -50%) rotate(-18deg);
  animation: stamp-in 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
  opacity: 0.82;
  mix-blend-mode: multiply;
}

@keyframes stamp-in {
  0% {
    transform: translate(-50%, -50%) rotate(-18deg) scale(2.2);
    opacity: 0;
  }
  60% {
    transform: translate(-50%, -50%) rotate(-18deg) scale(0.92);
    opacity: 0.95;
  }
  100% {
    transform: translate(-50%, -50%) rotate(-18deg) scale(1);
    opacity: 0.82;
  }
}

/* 水墨过渡 */
.ink-overlay {
  background: rgba(250, 247, 240, 0);
  animation: ink-bg 0.7s ease forwards;
}

.ink-overlay__blot {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 50%, rgba(30, 30, 30, 0.55) 0%, rgba(30, 30, 30, 0.2) 35%, transparent 65%);
  transform: scale(0);
  animation: ink-blot 0.68s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes ink-bg {
  0% {
    background: rgba(250, 247, 240, 0);
  }
  40% {
    background: rgba(250, 247, 240, 0.3);
  }
  100% {
    background: rgba(250, 247, 240, 0);
  }
}

@keyframes ink-blot {
  0% {
    transform: scale(0);
    opacity: 0.9;
  }
  100% {
    transform: scale(3.5);
    opacity: 0;
  }
}

/* 卷轴进度条装饰 */
.scroll-progress__track::before,
.scroll-progress__track::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 6px;
  height: 14px;
  transform: translateY(-50%);
  background: linear-gradient(180deg, #d4c4b0, #8d6e63);
  border-radius: 2px;
  opacity: 0.5;
}

.scroll-progress__track::before {
  left: -2px;
}

.scroll-progress__track::after {
  right: -2px;
}

.unlock-pop {
  animation: pop 0.6s ease;
}

.float-text {
  animation: float-up 1.1s ease;
}

.animate-pulse-subtle {
  animation: pulse-subtle 2.4s ease-in-out infinite;
}

@keyframes pulse-subtle {
  0%,
  100% {
    box-shadow: inset 0 0 0 1px rgba(192, 57, 43, 0.15);
  }
  50% {
    box-shadow: inset 0 0 0 1px rgba(192, 57, 43, 0.35), 0 0 8px rgba(192, 57, 43, 0.12);
  }
}

@keyframes pop {
  0% {
    transform: translateX(-50%) scale(0.7);
    opacity: 0;
  }
  100% {
    transform: translateX(-50%) scale(1);
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

@media (max-width: 640px) {
  .stage-node-wrap:nth-child(odd) .stage-tooltip {
    left: 0;
    transform: translateX(0);
  }
  .stage-node-wrap:nth-child(even) .stage-tooltip {
    left: auto;
    right: 0;
    transform: translateX(0);
  }
}
</style>
