<template>
  <div class="grid gap-2 sm:grid-cols-2">
    <article v-if="inputPath" class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
      <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">源文件路径</div>
      <p class="mt-1 break-all font-mono text-[11px] leading-5 text-[#173f3c]">{{ inputPath }}</p>
    </article>
    <article v-if="durationSec != null" class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
      <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">音频时长</div>
      <div class="mt-1 text-lg font-semibold text-[#173f3c]">{{ durationLabel }}</div>
    </article>
    <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664] sm:col-span-2">
      <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">授权状态</div>
      <div class="mt-1 flex items-center gap-2">
        <span class="inline-block h-2 w-2 rounded-full bg-[#4c9b67]" />
        <span class="font-medium text-[#173f3c]">已获授权同意，样本纳入任务链路</span>
      </div>
    </article>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ stage: { type: Object, required: true } })

const artifacts = computed(() => props.stage.artifacts || {})
const inputPath = computed(() => artifacts.value.input || null)
const durationSec = computed(() => {
  const v = artifacts.value.durationSec
  return v != null && Number.isFinite(Number(v)) ? Number(v) : null
})
const durationLabel = computed(() => {
  const s = durationSec.value
  if (s == null) return '—'
  if (s < 60) return `${s.toFixed(1)} 秒`
  const m = Math.floor(s / 60)
  const r = (s % 60).toFixed(0)
  return `${m} 分 ${r} 秒`
})
</script>
