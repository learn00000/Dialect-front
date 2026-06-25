<template>
  <div class="space-y-2">
    <div class="grid gap-2 sm:grid-cols-2">
      <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">转写引擎</div>
        <div class="mt-1 font-medium text-[#173f3c]">{{ engineLabel }}</div>
      </article>
      <article v-if="transcriptSource" class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">转写来源</div>
        <div class="mt-1 font-medium text-[#173f3c]">{{ transcriptSource }}</div>
      </article>
    </div>
    <article v-if="transcriptText" class="rounded-xl bg-[#f5faf8] px-3 py-3 text-xs text-[#456664]">
      <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">转写文本摘要</div>
      <p class="mt-2 text-sm leading-7 text-[#2b4442]">{{ transcriptText }}</p>
    </article>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ stage: { type: Object, required: true } })

const artifacts = computed(() => props.stage.artifacts || {})
const metadata = computed(() => props.stage.metadata || {})

const engineLabel = computed(() => {
  const note = String(props.stage.note || '').toLowerCase()
  if (note.includes('dashscope') || note.includes('百炼')) return '百炼 ASR（DashScope）'
  if (note.includes('funasr') || note.includes('local')) return 'FunASR 本地'
  if (note.includes('字幕') || note.includes('subtitle')) return '字幕直接复用'
  return metadata.value.asrBackend || '—'
})

const transcriptSource = computed(() => {
  const src = metadata.value.transcriptSource || artifacts.value.transcriptSource
  if (!src) return null
  const map = { asr: 'ASR 转写', subtitle: '字幕抽取', user: '用户提交', ocr: 'OCR 识别' }
  return map[String(src).toLowerCase()] || src
})

const transcriptText = computed(() =>
  metadata.value.transcriptSnippet || artifacts.value.transcriptSnippet || null
)
</script>
