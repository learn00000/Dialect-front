<template>
  <div class="space-y-2">
    <div class="grid gap-2 sm:grid-cols-3">
      <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">切分片段数</div>
        <div class="mt-1 text-xl font-bold text-[#173f3c]">{{ clipCount ?? '—' }}</div>
      </article>
      <article v-if="minDuration != null" class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">最短时长限制</div>
        <div class="mt-1 font-medium text-[#173f3c]">{{ minDuration }} 秒</div>
      </article>
      <article v-if="maxDuration != null" class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">最长时长限制</div>
        <div class="mt-1 font-medium text-[#173f3c]">{{ maxDuration > 0 ? `${maxDuration} 秒` : '不限' }}</div>
      </article>
    </div>
    <!-- clip 列表简览 -->
    <div v-if="clips.length" class="overflow-x-auto rounded-xl bg-[#f5faf8] px-3 py-2.5">
      <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380] mb-2">片段列表</div>
      <table class="min-w-full text-left text-[11px]">
        <thead class="text-[#6a8380]">
          <tr>
            <th class="px-2 py-1">ID</th>
            <th class="px-2 py-1">起止</th>
            <th class="px-2 py-1">时长</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="clip in clips" :key="clip.id" class="border-t border-black/5">
            <td class="px-2 py-1.5 font-medium text-[#2b4442]">{{ clip.id }}</td>
            <td class="px-2 py-1.5 text-[#6a8380]">{{ clip.start }}s – {{ clip.end }}s</td>
            <td class="px-2 py-1.5 text-[#173f3c]">{{ (Number(clip.end) - Number(clip.start)).toFixed(1) }}s</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ stage: { type: Object, required: true } })

const artifacts = computed(() => props.stage.artifacts || {})
const metadata = computed(() => props.stage.metadata || {})

const clipCount = computed(() =>
  artifacts.value.clipCount ?? metadata.value.clipCount ?? null
)

const minDuration = computed(() => metadata.value.minDurationSec ?? null)
const maxDuration = computed(() => metadata.value.maxDurationSec ?? null)

const clips = computed(() => {
  const list = metadata.value.clips || artifacts.value.clips || []
  return Array.isArray(list) ? list.slice(0, 20) : []
})
</script>
