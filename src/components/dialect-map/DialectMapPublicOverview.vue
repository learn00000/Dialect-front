<template>
  <section
    class="relative overflow-hidden rounded-[2rem] border border-[rgba(47,143,131,0.14)] bg-[linear-gradient(140deg,rgba(255,255,255,0.96)_0%,rgba(232,247,244,0.9)_48%,rgba(216,236,232,0.84)_100%)] px-5 py-5 shadow-[0_22px_60px_rgba(22,88,85,0.12)] ring-1 ring-[rgba(255,255,255,0.65)] sm:px-7 sm:py-7"
  >
    <div
      class="pointer-events-none absolute inset-y-0 right-[-8%] w-[42%] bg-[radial-gradient(circle_at_center,rgba(58,143,138,0.18)_0%,rgba(58,143,138,0.04)_42%,transparent_72%)]"
    />
    <div
      class="pointer-events-none absolute left-[-12%] top-[-38%] h-56 w-56 rounded-full border border-white/60 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.18)_48%,transparent_72%)] blur-sm"
    />

    <div class="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="max-w-3xl">
        <div class="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-[#2a726d] shadow-sm">
          <span class="inline-flex h-2 w-2 rounded-full bg-[#2f8f83] shadow-[0_0_12px_rgba(47,143,131,0.6)]" />
          活体方言数据库
        </div>
        <h1 class="mt-4 font-serif text-[2rem] font-semibold leading-tight tracking-[0.02em] text-[#123b39] sm:text-[2.7rem]">
          每一段乡音，
          <br class="hidden sm:block" />
          都有坐标、状态与去向。
        </h1>
        <p class="mt-4 max-w-2xl text-sm leading-7 text-[#365553] sm:text-base">
          声绘山河 2.0 不再只收集录音，而是把乡音从上传、治理到进入训练语料库的全过程公开可见。
          地图上的每个点位都是一条活的数据生命线。
        </p>
        <div class="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            class="rounded-2xl bg-[linear-gradient(135deg,#7ed4ce_0%,#3a8f8a_48%,#184f4b_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(22,88,85,0.24)] transition hover:brightness-[1.04]"
            @click="$emit('enter-workbench')"
          >
            进入数据工作台
          </button>
          <button
            type="button"
            class="rounded-2xl border border-[rgba(47,143,131,0.22)] bg-white/75 px-5 py-3 text-sm font-semibold text-[#174a47] transition hover:border-[#2f8f83] hover:bg-white"
            @click="$emit('jump-to-map')"
          >
            查看活体地图
          </button>
        </div>
      </div>

      <div class="grid w-full max-w-xl grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[28rem]">
        <article
          v-for="card in cards"
          :key="card.label"
          class="rounded-[1.45rem] border border-white/75 bg-white/80 px-4 py-4 shadow-[0_10px_28px_rgba(22,88,85,0.07)] backdrop-blur-md"
        >
          <div class="text-[11px] font-medium uppercase tracking-[0.18em] text-[#65807d]">{{ card.label }}</div>
          <div class="mt-2 text-2xl font-semibold text-[#123b39]">{{ card.value }}</div>
          <p class="mt-1 text-xs leading-5 text-[#5c7471]">{{ card.note }}</p>
        </article>
      </div>
    </div>

    <div class="relative mt-6 grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
      <div class="rounded-[1.7rem] border border-white/75 bg-white/72 p-4 shadow-[0_14px_34px_rgba(22,88,85,0.08)]">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-[0.22em] text-[#2a726d]">治理总览</div>
            <p class="mt-1 text-sm text-[#446260]">前端轮询实时刷新，让地图、流水线与语料库保持同频。</p>
          </div>
          <div class="rounded-full bg-[#eff8f5] px-3 py-1 text-xs font-medium text-[#21534e]">
            近 24h 处理吞吐 {{ pipelineMetrics.throughput24h || 0 }} 条
          </div>
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl bg-[#eff8f5] px-4 py-3">
            <div class="text-[11px] uppercase tracking-[0.18em] text-[#65807d]">近 24 小时新增</div>
            <div class="mt-2 text-xl font-semibold text-[#123b39]">{{ overview.newLast24h || 0 }}</div>
          </div>
          <div class="rounded-2xl bg-[#eef4ff] px-4 py-3">
            <div class="text-[11px] uppercase tracking-[0.18em] text-[#65807d]">待人工复核</div>
            <div class="mt-2 text-xl font-semibold text-[#214f78]">{{ pipelineMetrics.reviewQueueCount || 0 }}</div>
          </div>
          <div class="rounded-2xl bg-[#fff5e6] px-4 py-3">
            <div class="text-[11px] uppercase tracking-[0.18em] text-[#65807d]">失败 / 风险命中</div>
            <div class="mt-2 text-xl font-semibold text-[#8c5b16]">{{ pipelineMetrics.failedCount || 0 }}</div>
          </div>
        </div>
      </div>

      <div class="rounded-[1.7rem] border border-white/75 bg-[linear-gradient(180deg,rgba(244,251,250,0.92)_0%,rgba(255,255,255,0.84)_100%)] p-4 shadow-[0_14px_34px_rgba(22,88,85,0.08)]">
        <div class="text-xs font-semibold uppercase tracking-[0.22em] text-[#2a726d]">立意</div>
        <p class="mt-2 text-sm leading-7 text-[#395654]">
          这不是一个静态方言馆，而是一张持续生长的语料地图。贡献者上传原声，智能体负责治理，研究者与模型从中获得可追踪、可回溯、可扩充的训练样本。
        </p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { formatPercent } from '../../data/dialect-map-config.js'

const props = defineProps({
  overview: {
    type: Object,
    required: true
  },
  pipelineMetrics: {
    type: Object,
    required: true
  }
})

defineEmits(['enter-workbench', 'jump-to-map'])

const cards = computed(() => [
  {
    label: '总贡献数',
    value: props.overview.totalContributions || 0,
    note: '汇入系统的声音样本总量'
  },
  {
    label: '治理中',
    value: props.overview.processingCount || 0,
    note: '正在被清洗、转写、标注与过滤'
  },
  {
    label: '可训练',
    value: props.overview.readyCount || 0,
    note: `整体就绪率 ${formatPercent(props.overview.readyRate || 0)}`
  },
  {
    label: '覆盖地区',
    value: props.overview.regionCoverage || 0,
    note: '已被乡音点亮的地区数量'
  }
])
</script>
