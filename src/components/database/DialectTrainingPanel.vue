<template>
  <section class="rounded-[1.4rem] border border-[rgba(47,143,131,0.14)] bg-white p-5 shadow-[0_10px_30px_rgba(18,59,57,0.05)]">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">模型训练 · 按次方言</div>
        <p class="mt-1 max-w-2xl text-xs leading-6 text-[#607a77]">
          已通过治理的语音条会按次方言自动归集，达到训练建议条数后可一键导出语料并启动训练，完成后下载模型权重。
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="rounded-full px-3 py-1 text-[11px] font-medium"
          :class="stats.realTrainingEnabled ? 'bg-[#eef4ff] text-[#275a8a]' : 'bg-[#fff4dd] text-[#8c5b16]'"
        >
          {{ stats.realTrainingEnabled ? '真实训练已开启' : '演示训练模式' }}
        </span>
        <span class="rounded-full bg-[#f3faf8] px-3 py-1 text-[11px] font-medium text-[#1e5752]">
          建议 {{ stats.recommendedClips }} 条 / 起训 {{ stats.minClips }} 条
        </span>
      </div>
    </div>

    <div v-if="!dialects.length" class="mt-4 rounded-2xl bg-[#f5f8f7] px-4 py-6 text-center text-sm text-[#607a77]">
      {{ loading ? '正在统计次方言语料…' : '暂无已入库的次方言语料，先在治理流水线中产出可训练片段。' }}
    </div>

    <div v-else class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="dialect in dialects"
        :key="dialect.key"
        class="flex flex-col rounded-[1.2rem] border border-[rgba(47,143,131,0.12)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fcfb_100%)] p-4"
      >
        <!-- 标题 -->
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-[#173f3c]">{{ dialect.label }}</div>
            <div class="mt-0.5 truncate text-[11px] text-[#6a8380]">
              {{ dialect.group || '未分类大区' }} · {{ dialect.contributionCount }} 位贡献者
            </div>
          </div>
          <span
            v-if="dialect.supportsRealTraining"
            class="shrink-0 rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10px] font-medium text-[#275a8a]"
            :title="`训练流水线：${dialect.pipeline}`"
          >
            {{ dialect.pipeline }}
          </span>
        </div>

        <!-- 收集进度 -->
        <div class="mt-3">
          <div class="flex items-baseline justify-between">
            <span class="text-[11px] text-[#6a8380]">已收集</span>
            <span class="text-sm font-semibold text-[#173f3c]">
              {{ dialect.clipCount }}
              <span class="text-[11px] font-normal text-[#6a8380]"> / 建议 {{ dialect.recommendedClips }} 条</span>
            </span>
          </div>
          <div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#e8f3f1]">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="dialect.meetsRecommended ? 'bg-[#4c9b67]' : dialect.readyToTrain ? 'bg-[#d79b2c]' : 'bg-[#9db4b0]'"
              :style="{ width: `${Math.round((dialect.progressToRecommended || 0) * 100)}%` }"
            />
          </div>
          <div class="mt-1 text-[10px] text-[#6a8380]">
            <template v-if="dialect.meetsRecommended">已达到训练建议条数，推荐开练</template>
            <template v-else-if="dialect.readyToTrain">已达起训门槛，还差 {{ dialect.recommendedClips - dialect.clipCount }} 条到建议值</template>
            <template v-else>距起训门槛还差 {{ Math.max(0, dialect.minClips - dialect.clipCount) }} 条</template>
          </div>
        </div>

        <!-- 训练状态区 -->
        <div class="mt-3 flex-1">
          <!-- 进行中 -->
          <div
            v-if="isActive(dialect.latestJob)"
            class="rounded-xl bg-[#f6faff] px-3 py-2.5 ring-1 ring-[rgba(91,143,214,0.16)]"
          >
            <div class="flex items-center justify-between text-[11px]">
              <span class="flex items-center gap-1.5 font-medium text-[#275a8a]">
                <span class="relative flex h-2 w-2">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4d82c8] opacity-60" />
                  <span class="relative inline-flex h-2 w-2 rounded-full bg-[#4d82c8]" />
                </span>
                {{ dialect.latestJob.stageLabel || '训练中' }}
              </span>
              <span class="font-semibold text-[#214f78]">{{ Math.round((dialect.latestJob.progress || 0) * 100) }}%</span>
            </div>
            <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#dfeaff]">
              <div
                class="h-full rounded-full bg-[linear-gradient(90deg,#9dc8ff_0%,#4d82c8_100%)] transition-all duration-500"
                :style="{ width: `${Math.round((dialect.latestJob.progress || 0) * 100)}%` }"
              />
            </div>
            <div class="mt-1.5 text-[10px] text-[#6a8380]">
              共 {{ dialect.latestJob.clipCount }} 条 · {{ dialect.latestJob.mode === 'real' ? '真实训练' : '演示训练' }}
            </div>
          </div>

          <!-- 完成 -->
          <div
            v-else-if="dialect.latestJob && dialect.latestJob.status === 'completed'"
            class="rounded-xl bg-[#f4fcf6] px-3 py-2.5 ring-1 ring-[rgba(72,155,102,0.18)]"
          >
            <div class="flex items-center gap-1.5 text-[11px] font-medium text-[#1f5d37]">
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12l4 4 9-10" />
              </svg>
              训练完成 · {{ dialect.latestJob.clipCount }} 条
            </div>
            <a
              :href="weightsUrl(dialect.latestJob.id)"
              :download="`dialect_${dialect.key}_llm.pt`"
              class="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#2f8f83] px-3 py-2 text-[12px] font-semibold text-white no-underline transition hover:bg-[#247268]"
            >
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                <path d="M12 4v9" />
                <path d="M8 9l4 4 4-4" />
              </svg>
              下载模型权重
            </a>
          </div>

          <!-- 失败 -->
          <div
            v-else-if="dialect.latestJob && dialect.latestJob.status === 'failed'"
            class="rounded-xl bg-[#fff6f6] px-3 py-2.5 text-[11px] leading-5 text-[#8b2d2d] ring-1 ring-[rgba(194,61,61,0.18)]"
          >
            训练失败：{{ dialect.latestJob.errorMessage || '未知错误' }}
          </div>
        </div>

        <!-- 操作按钮 -->
        <button
          v-if="!isActive(dialect.latestJob)"
          type="button"
          class="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition"
          :class="dialect.readyToTrain
            ? 'bg-[#173f3c] text-white hover:bg-[#0f2c2a]'
            : 'cursor-not-allowed bg-[#eef2f1] text-[#9db4b0]'"
          :disabled="!dialect.readyToTrain || starting === dialect.key"
          @click="onStart(dialect)"
        >
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 3l14 9-14 9z" />
          </svg>
          {{ startLabel(dialect) }}
        </button>
      </article>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { trainingWeightsUrl } from '../../services/dialect-map-api.js'

const props = defineProps({
  stats: {
    type: Object,
    default: () => ({ recommendedClips: 0, minClips: 0, realTrainingEnabled: false, dialects: [] })
  },
  loading: {
    type: Boolean,
    default: false
  },
  startTraining: {
    type: Function,
    default: null
  }
})

const starting = ref('')

const dialects = computed(() => props.stats?.dialects || [])

function isActive(job) {
  return job && (job.status === 'running' || job.status === 'queued')
}

function weightsUrl(jobId) {
  return trainingWeightsUrl(jobId)
}

function startLabel(dialect) {
  if (starting.value === dialect.key) return '正在启动…'
  if (dialect.latestJob && dialect.latestJob.status === 'completed') return '重新训练'
  if (dialect.latestJob && dialect.latestJob.status === 'failed') return '重试训练'
  if (!dialect.readyToTrain) return `还差 ${Math.max(0, dialect.minClips - dialect.clipCount)} 条`
  return '一键训练'
}

async function onStart(dialect) {
  if (!props.startTraining || !dialect.readyToTrain) return
  starting.value = dialect.key
  try {
    await props.startTraining(dialect.key)
  } catch (error) {
    window.alert(error.message || '启动训练失败')
  } finally {
    starting.value = ''
  }
}
</script>
