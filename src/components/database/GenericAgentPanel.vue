<template>
  <section class="rounded-[1.2rem] border border-[rgba(47,143,131,0.13)] bg-[#fcfffe] p-4 ring-1 ring-[rgba(47,143,131,0.06)]">
    <!-- 标题行 -->
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">
          {{ stage.label }} · 处理详情
        </div>
        <p v-if="stage.note" class="mt-1 max-w-3xl text-xs leading-6 text-[#607a77]">{{ stage.note }}</p>
      </div>
      <span
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ring-black/5"
        :class="badgeClass"
      >
        <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path v-for="(d, i) in stateIconPaths" :key="i" :d="d" />
        </svg>
        {{ stateLabel }}
      </span>
    </div>

    <!-- 时间线 -->
    <div class="mt-3 grid gap-2 sm:grid-cols-3">
      <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">开始时间</div>
        <div class="mt-1 font-medium text-[#173f3c]">{{ formatTs(stage.startedAt) || '—' }}</div>
      </article>
      <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">结束时间</div>
        <div class="mt-1 font-medium text-[#173f3c]">{{ formatTs(stage.endedAt) || '—' }}</div>
      </article>
      <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">耗时</div>
        <div class="mt-1 font-medium text-[#173f3c]">{{ duration || '—' }}</div>
      </article>
    </div>

    <!-- agent 专属内容 -->
    <component :is="specificPanel" v-if="specificPanel" :stage="stage" class="mt-3" />

    <!-- 产物文件 -->
    <div v-if="artifactList.length" class="mt-3">
      <div class="mb-2 text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">产物文件</div>
      <div class="flex flex-wrap gap-2">
        <template v-for="item in artifactList" :key="item.key">
          <!-- 可下载链接 -->
          <a
            v-if="item.url"
            :href="item.url"
            :download="item.filename"
            target="_blank"
            rel="noreferrer"
            class="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[#1e5752] ring-1 ring-[rgba(47,143,131,0.22)] transition hover:bg-[#ebf7f3] hover:text-[#155048] no-underline"
          >
            <svg viewBox="0 0 24 24" class="h-3 w-3 shrink-0 opacity-60" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
              <path d="M12 4v9" />
              <path d="M8 9l4 4 4-4" />
            </svg>
            {{ item.key }}
            <span class="text-[10px] text-[#6a8380]">{{ item.ext }}</span>
          </a>
          <!-- 纯文本（数值或无法链接的值） -->
          <span
            v-else
            class="inline-flex items-center gap-1 rounded-full bg-white/72 px-2.5 py-1 text-[11px] font-medium ring-1 ring-black/5"
          >
            <span class="opacity-50">#</span>{{ item.key }}
            <span v-if="item.value" class="ml-0.5 text-[#6a8380]">{{ item.value }}</span>
          </span>
        </template>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { stageStateText } from '../../data/dialect-map-config.js'

const props = defineProps({
  stage: {
    type: Object,
    required: true
  }
})

/* ---- 状态 ---- */
const stateLabel = computed(() => stageStateText(props.stage.state))

const badgeClass = computed(() => {
  const s = props.stage.state
  if (s === 'complete') return 'bg-[#e9f7ee] text-[#22613a]'
  if (s === 'running') return 'bg-[#edf4ff] text-[#275a8a]'
  if (s === 'review') return 'bg-[#fff3dc] text-[#8d5b18]'
  if (s === 'failed') return 'bg-[#fff0f0] text-[#963737]'
  return 'bg-[#f1f6f5] text-[#57716e]'
})

const stateIconPaths = computed(() => {
  const s = props.stage.state
  if (s === 'complete') return ['M5 12l4 4 9-10']
  if (s === 'running') return ['M12 3a9 9 0 1 0 9 9']
  if (s === 'review') return ['M12 7v5l3 2', 'M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z']
  if (s === 'failed') return ['M6 6l12 12', 'M18 6L6 18']
  return ['M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0']
})

/* ---- 时间 ---- */
function formatTs(iso) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return iso
  }
}

const duration = computed(() => {
  const start = props.stage.startedAt
  const end = props.stage.endedAt
  if (!start || !end) return null
  try {
    const ms = new Date(end) - new Date(start)
    if (!Number.isFinite(ms) || ms < 0) return null
    if (ms < 1000) return `${ms} ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)} 秒`
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${m} 分 ${s} 秒`
  } catch {
    return null
  }
})

/* ---- 产物 ---- */
function isStorageUrl(v) {
  return typeof v === 'string' && (v.startsWith('/storage/') || v.startsWith('http://') || v.startsWith('https://'))
}

function fileExt(url) {
  try {
    const name = url.split('/').pop().split('?')[0]
    const dot = name.lastIndexOf('.')
    return dot >= 0 ? name.slice(dot) : ''
  } catch {
    return ''
  }
}

const artifactList = computed(() =>
  Object.entries(props.stage.artifacts || {}).map(([key, value]) => ({
    key,
    url: isStorageUrl(value) ? value : null,
    filename: isStorageUrl(value) ? (value.split('/').pop() || key) : null,
    ext: isStorageUrl(value) ? fileExt(value) : null,
    value: typeof value === 'number' ? String(value) : (!isStorageUrl(value) && typeof value === 'string' ? value : null),
  }))
)

/* ---- 各 agent 专属子面板 (懒加载，缺少时不渲染) ---- */
const SPECIFIC_PANELS = {
  intake_agent: defineAsyncComponent(() => import('./agent-panels/IntakePanel.vue').catch(() => null)),
  subtitle_source_agent: defineAsyncComponent(() => import('./agent-panels/SubtitleSourcePanel.vue').catch(() => null)),
  audio_prep_agent: defineAsyncComponent(() => import('./agent-panels/AudioPrepPanel.vue').catch(() => null)),
  transcription_agent: defineAsyncComponent(() => import('./agent-panels/TranscriptionPanel.vue').catch(() => null)),
  llm_proofread_agent: defineAsyncComponent(() => import('./agent-panels/LlmProofreadPanel.vue').catch(() => null)),
  segmentation_agent: defineAsyncComponent(() => import('./agent-panels/SegmentationPanel.vue').catch(() => null)),
  metadata_writer_agent: defineAsyncComponent(() => import('./agent-panels/MetadataWriterPanel.vue').catch(() => null)),
}

const specificPanel = computed(() => SPECIFIC_PANELS[props.stage?.key] || null)
</script>
