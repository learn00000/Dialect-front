<template>
  <div class="space-y-2">
    <div class="grid gap-2 sm:grid-cols-2">
      <article class="rounded-xl px-3 py-2.5 text-xs" :class="llmEnabled ? 'bg-[#eef4ff] text-[#275a8a]' : 'bg-[#f5faf8] text-[#456664]'">
        <div class="text-[10px] uppercase tracking-[0.12em] opacity-70">大模型校对</div>
        <div class="mt-1 font-semibold">{{ llmEnabled ? '已启用（百炼 Qwen）' : '未启用（跳过）' }}</div>
      </article>
      <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">校对结果</div>
        <div class="mt-1 font-medium text-[#173f3c]">{{ resultLabel }}</div>
      </article>
    </div>
    <div v-if="proofreadChanges" class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
      <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">修改摘要</div>
      <p class="mt-1 text-sm leading-6 text-[#2b4442]">{{ proofreadChanges }}</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <span
        v-for="step in steps"
        :key="step"
        class="rounded-full bg-[#eef4ff] px-2.5 py-1 text-[11px] font-medium text-[#275a8a]"
      >
        {{ step }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ stage: { type: Object, required: true } })

const metadata = computed(() => props.stage.metadata || {})
const artifacts = computed(() => props.stage.artifacts || {})

const llmEnabled = computed(() => {
  const note = String(props.stage.note || '').toLowerCase()
  return note.includes('llm') || note.includes('大模型') || metadata.value.llmEnabled === true
})

const resultLabel = computed(() => {
  const note = String(props.stage.note || '')
  if (note.includes('fail-open') || note.includes('失败')) return 'LLM 失败，原文保留'
  if (note.includes('unchanged') || note.includes('无变化')) return '文本未做修改'
  if (props.stage.state === 'complete') return '校对完成'
  return '—'
})

const proofreadChanges = computed(() =>
  metadata.value.proofreadSummary || artifacts.value.proofreadSummary || null
)

const steps = computed(() => {
  const note = String(props.stage.note || '').toLowerCase()
  const list = []
  if (llmEnabled.value) {
    list.push('LLM 语义校对')
  }
  list.push('标点规范化')
  list.push('空白符清理')
  if (note.includes('去重') || note.includes('dedup')) list.push('文本去重')
  return list
})
</script>
