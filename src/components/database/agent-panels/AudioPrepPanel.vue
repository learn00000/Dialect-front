<template>
  <div class="space-y-2">
    <div class="grid gap-2 sm:grid-cols-3">
      <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">时长</div>
        <div class="mt-1 font-medium text-[#173f3c]">{{ durationLabel }}</div>
      </article>
      <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">采样率</div>
        <div class="mt-1 font-medium text-[#173f3c]">16 kHz（归一化）</div>
      </article>
      <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">声道</div>
        <div class="mt-1 font-medium text-[#173f3c]">单声道</div>
      </article>
    </div>
    <div class="flex flex-wrap gap-2">
      <span
        v-for="step in processingSteps"
        :key="step"
        class="rounded-full bg-[#e8f5f2] px-2.5 py-1 text-[11px] font-medium text-[#1e5752]"
      >
        ✓ {{ step }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ stage: { type: Object, required: true } })

const artifacts = computed(() => props.stage.artifacts || {})

const durationSec = computed(() => {
  const v = artifacts.value.durationSec
  return v != null && Number.isFinite(Number(v)) ? Number(v) : null
})

const durationLabel = computed(() => {
  const s = durationSec.value
  if (s == null) return '—'
  if (s < 60) return `${s.toFixed(1)} 秒`
  const m = Math.floor(s / 60)
  return `${m} 分 ${(s % 60).toFixed(0)} 秒`
})

const processingSteps = computed(() => {
  const note = props.stage.note || ''
  if (note.includes('降噪') || note.includes('归一')) {
    return ['格式转换', '单声道', '静音裁切', '响度归一', '轻量降噪']
  }
  return ['格式转换', '采样率标准化']
})
</script>
