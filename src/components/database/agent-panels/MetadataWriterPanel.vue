<template>
  <div class="space-y-2">
    <div class="grid gap-2 sm:grid-cols-3">
      <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">入库片段数</div>
        <div class="mt-1 text-xl font-bold text-[#173f3c]">{{ segmentCount ?? '—' }}</div>
      </article>
      <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">方言标签</div>
        <div class="mt-1 font-medium text-[#173f3c]">{{ dialectLabel || '—' }}</div>
      </article>
      <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">元数据格式</div>
        <div class="mt-1 font-medium text-[#173f3c]">JSON + SQLite</div>
      </article>
    </div>
    <div class="flex flex-wrap gap-2">
      <span class="rounded-full bg-[#e8f5f2] px-2.5 py-1 text-[11px] font-medium text-[#1e5752]">✓ 方言标签写入</span>
      <span class="rounded-full bg-[#e8f5f2] px-2.5 py-1 text-[11px] font-medium text-[#1e5752]">✓ 地理元数据</span>
      <span class="rounded-full bg-[#e8f5f2] px-2.5 py-1 text-[11px] font-medium text-[#1e5752]">✓ 转写文本</span>
      <span v-if="qualityScore != null" class="rounded-full bg-[#eef4ff] px-2.5 py-1 text-[11px] font-medium text-[#275a8a]">
        质量分 {{ formatPercent(qualityScore) }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ stage: { type: Object, required: true } })

const artifacts = computed(() => props.stage.artifacts || {})
const metadata = computed(() => props.stage.metadata || {})

const segmentCount = computed(() =>
  artifacts.value.segmentCount ?? metadata.value.segmentCount ?? null
)
const dialectLabel = computed(() =>
  metadata.value.dialectLabel || artifacts.value.dialectLabel || null
)
const qualityScore = computed(() => {
  const v = metadata.value.qualityScore ?? artifacts.value.qualityScore
  return v != null && Number.isFinite(Number(v)) ? Number(v) : null
})

function formatPercent(v) {
  return `${Math.round(Number(v) * 100)}%`
}
</script>
