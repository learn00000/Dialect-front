<template>
  <div class="grid gap-2 sm:grid-cols-2">
    <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
      <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">字幕来源</div>
      <div class="mt-1 font-medium text-[#173f3c]">{{ sourceLabel }}</div>
    </article>
    <article v-if="srtPath" class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
      <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">字幕文件</div>
      <p class="mt-1 break-all font-mono text-[11px] leading-5 text-[#173f3c]">{{ srtPath }}</p>
    </article>
    <article v-if="ocrVideoPath" class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
      <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">OCR 视频片段</div>
      <p class="mt-1 break-all font-mono text-[11px] leading-5 text-[#173f3c]">{{ ocrVideoPath }}</p>
    </article>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ stage: { type: Object, required: true } })

const artifacts = computed(() => props.stage.artifacts || {})

const srtPath = computed(() => artifacts.value.srt || artifacts.value.subtitleFile || null)
const ocrVideoPath = computed(() => artifacts.value.ocrVideo || null)

const sourceLabel = computed(() => {
  const note = String(props.stage.note || '').toLowerCase()
  if (note.includes('内嵌') || note.includes('embedded')) return '内嵌字幕（直接抽取）'
  if (note.includes('ocr')) return 'OCR 字幕识别'
  if (note.includes('音频上传') || note.includes('audio_upload')) return '音频上传（无字幕，跳过）'
  if (srtPath.value) return '字幕文件'
  return props.stage.note || '—'
})
</script>
