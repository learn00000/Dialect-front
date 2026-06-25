<template>
  <section
    class="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[1.85rem] border border-[rgba(47,143,131,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(244,251,250,0.92)_100%)] shadow-[0_18px_40px_rgba(22,88,85,0.1)]"
  >
    <header class="flex items-start justify-between gap-3 border-b border-[rgba(47,143,131,0.1)] px-5 py-4">
      <div>
        <div class="text-xs font-semibold uppercase tracking-[0.22em] text-[#2a726d]">样本档案卡</div>
        <h2 class="mt-1 text-lg font-semibold text-[#123b39]">
          {{ point ? '贡献详情与治理追踪' : '等待选中样本' }}
        </h2>
        <p class="mt-1 text-xs leading-5 text-[#5f7774]">
          {{ point ? '右侧追踪卡展示该样本从收录到入库的整个过程。' : '点击地图点位或上传一段新乡音后，这里会显示完整处理链路。' }}
        </p>
      </div>
      <button
        v-if="point"
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(47,143,131,0.18)] bg-white text-[#5f7774]"
        aria-label="关闭详情"
        @click="$emit('close')"
      >
        ×
      </button>
    </header>

    <div v-if="point" class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <div class="flex flex-wrap items-center gap-2">
        <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="statusMeta.chip">
          {{ statusMeta.label }}
        </span>
        <span class="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-[#2b5653] ring-1 ring-[rgba(47,143,131,0.1)]">
          {{ point.dialectLabel }}
        </span>
        <span class="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-[#2b5653] ring-1 ring-[rgba(47,143,131,0.1)]">
          {{ point.type }}
        </span>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <article class="rounded-[1.35rem] border border-[rgba(47,143,131,0.1)] bg-white/82 p-4">
          <div class="text-[11px] uppercase tracking-[0.18em] text-[#66807d]">所在地区</div>
          <div class="mt-2 text-sm font-medium text-[#173f3c]">{{ describeArea(point.area) }}</div>
        </article>
        <article class="rounded-[1.35rem] border border-[rgba(47,143,131,0.1)] bg-white/82 p-4">
          <div class="text-[11px] uppercase tracking-[0.18em] text-[#66807d]">贡献者</div>
          <div class="mt-2 text-sm font-medium text-[#173f3c]">{{ point.nickname || '匿名贡献者' }}</div>
        </article>
        <article class="rounded-[1.35rem] border border-[rgba(47,143,131,0.1)] bg-white/82 p-4">
          <div class="text-[11px] uppercase tracking-[0.18em] text-[#66807d]">训练就绪度</div>
          <div class="mt-2 flex items-center gap-3">
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-[#dcece9]">
              <div
                class="h-full rounded-full bg-[linear-gradient(90deg,#7ed4ce_0%,#3a8f8a_65%,#1f5d37_100%)]"
                :style="{ width: `${Math.round(progress * 100)}%` }"
              />
            </div>
            <span class="text-sm font-semibold text-[#173f3c]">{{ formatPercent(progress) }}</span>
          </div>
        </article>
        <article class="rounded-[1.35rem] border border-[rgba(47,143,131,0.1)] bg-white/82 p-4">
          <div class="text-[11px] uppercase tracking-[0.18em] text-[#66807d]">训练片段数</div>
          <div class="mt-2 text-sm font-medium text-[#173f3c]">{{ point.readySegmentCount ?? 0 }}</div>
        </article>
      </div>

      <section class="mt-4 rounded-[1.45rem] border border-[rgba(47,143,131,0.1)] bg-white/84 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">原声与文本</div>
            <p class="mt-1 text-xs text-[#607a77]">原始上传内容与当前系统可见文本摘要。</p>
          </div>
          <div class="text-xs text-[#607a77]">{{ formatDateTime(point.createdAt) }}</div>
        </div>

        <audio class="mt-4 w-full rounded-xl" controls :src="point.audioUrl" />

        <div class="mt-4 grid gap-3">
          <article class="rounded-2xl bg-[#f4faf8] px-4 py-3">
            <div class="text-[11px] uppercase tracking-[0.16em] text-[#66807d]">文本片段</div>
            <p class="mt-2 text-sm leading-7 text-[#274340]">{{ point.transcriptSnippet || '系统尚未生成转写摘要。' }}</p>
          </article>
          <article class="rounded-2xl bg-[#f7fafc] px-4 py-3">
            <div class="text-[11px] uppercase tracking-[0.16em] text-[#66807d]">上传说明</div>
            <p class="mt-2 text-sm leading-7 text-[#274340]">{{ point.content || '贡献者未填写额外说明。' }}</p>
          </article>
        </div>
      </section>

      <section class="mt-4 rounded-[1.45rem] border border-[rgba(47,143,131,0.1)] bg-white/84 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">公开治理阶段</div>
            <p class="mt-1 text-xs text-[#607a77]">六个主阶段对公众可见，保证每段乡音的去向透明。</p>
          </div>
          <div v-if="point.nextAction" class="rounded-full bg-[#eef7ff] px-3 py-1 text-[11px] font-medium text-[#21537d]">
            下一动作：{{ point.nextAction }}
          </div>
        </div>

        <div class="mt-4 space-y-3">
          <article
            v-for="stage in publicStages"
            :key="stage.key"
            class="rounded-[1.3rem] border px-4 py-3"
            :class="stageTone(stage.state)"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-sm font-semibold">{{ stage.label }}</div>
                <div class="mt-1 text-xs">{{ stage.agentName }}</div>
              </div>
              <div class="text-right text-xs">
                <div class="font-semibold">{{ stageStateText(stage.state) }}</div>
                <div v-if="stage.confidence != null" class="mt-1 opacity-80">置信度 {{ Math.round(stage.confidence * 100) }}%</div>
              </div>
            </div>
            <p v-if="stage.note" class="mt-3 text-xs leading-6">{{ stage.note }}</p>
          </article>
        </div>
      </section>

      <section class="mt-4 rounded-[1.45rem] border border-[rgba(47,143,131,0.1)] bg-white/84 p-4">
        <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">内部节点</div>
        <p class="mt-1 text-xs text-[#607a77]">当低置信度或风险命中时，会被明确分流到人工复核。</p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <article
            v-for="stage in internalStages"
            :key="stage.key"
            class="rounded-[1.2rem] border px-4 py-3"
            :class="stageTone(stage.state)"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="text-sm font-semibold">{{ stage.label }}</div>
              <div class="text-[11px] font-semibold">{{ stageStateText(stage.state) }}</div>
            </div>
            <p v-if="stage.note" class="mt-2 text-xs leading-6">{{ stage.note }}</p>
          </article>
        </div>
      </section>

      <section v-if="riskFlags.length || point.reviewReason" class="mt-4 rounded-[1.45rem] border border-[rgba(214,150,41,0.26)] bg-[#fff8ea] p-4">
        <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#8c5b16]">风险与复核</div>
        <p v-if="point.reviewReason" class="mt-2 text-sm leading-7 text-[#735325]">{{ point.reviewReason }}</p>
        <div v-if="riskFlags.length" class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="flag in riskFlags"
            :key="flag"
            class="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-[#8c5b16] ring-1 ring-[rgba(214,150,41,0.24)]"
          >
            {{ flag }}
          </span>
        </div>
      </section>
    </div>

    <div v-else class="flex flex-1 items-center justify-center px-8 text-center text-sm leading-7 text-[#607a77]">
      先在地图上选中一个点位，或者上传一段新乡音。系统会在这里展示完整档案、治理进度和训练就绪度。
    </div>

    <div
      v-if="loading"
      class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[1.85rem] bg-white/38 backdrop-blur-[2px]"
    >
      <div class="rounded-2xl border border-[rgba(47,143,131,0.14)] bg-white/92 px-4 py-3 text-sm text-[#33514e] shadow-[0_12px_24px_rgba(22,88,85,0.08)]">
        追踪链路刷新中…
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import {
  INTERNAL_PIPELINE_STAGES,
  PUBLIC_PIPELINE_STAGES,
  describeArea,
  formatDateTime,
  formatPercent,
  getPipelineProgress,
  getStatusMeta,
  stageStateText
} from '../../data/dialect-map-config.js'

const props = defineProps({
  point: {
    type: Object,
    default: null
  },
  pipeline: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['close'])

const statusMeta = computed(() => getStatusMeta(props.point?.status))

const publicStages = computed(() => {
  const stageMap = new Map((props.pipeline?.stages || []).map((stage) => [stage.key, stage]))
  return PUBLIC_PIPELINE_STAGES.map((stage) => ({
    ...stage,
    ...(stageMap.get(stage.key) || { state: 'waiting' })
  }))
})

const internalStages = computed(() => {
  const stageMap = new Map((props.pipeline?.internalStages || []).map((stage) => [stage.key, stage]))
  return INTERNAL_PIPELINE_STAGES.map((stage) => ({
    ...stage,
    ...(stageMap.get(stage.key) || { state: 'waiting' })
  }))
})

const progress = computed(() => getPipelineProgress(publicStages.value))
const riskFlags = computed(() => props.point?.riskFlags || [])

function stageTone(state) {
  if (state === 'complete') {
    return 'border-[rgba(72,155,102,0.22)] bg-[#edf8f1] text-[#1f5d37]'
  }
  if (state === 'running') {
    return 'border-[rgba(91,143,214,0.22)] bg-[#eef5ff] text-[#214f78]'
  }
  if (state === 'review' || state === 'failed') {
    return 'border-[rgba(214,150,41,0.24)] bg-[#fff8ea] text-[#8c5b16]'
  }
  return 'border-[rgba(47,143,131,0.1)] bg-white text-[#486260]'
}
</script>
