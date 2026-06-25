<template>
  <section v-if="summary" class="mt-4 rounded-[1.2rem] border border-[rgba(47,143,131,0.12)] bg-[#fcfffe] p-4 ring-1 ring-[rgba(47,143,131,0.06)]">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">普通话过滤 · 识别详情</div>
        <p class="mt-1 max-w-3xl text-xs leading-6 text-[#607a77]">{{ summary.strategy }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <span class="rounded-full bg-[#f3faf8] px-3 py-1 text-[11px] font-medium text-[#1e5752]">
          保留 {{ summary.keptCount ?? 0 }} / 剔除 {{ summary.rejectedCount ?? 0 }}
        </span>
        <span
          class="rounded-full px-3 py-1 text-[11px] font-semibold"
          :class="summary.llmEnabled ? 'bg-[#eef4ff] text-[#275a8a]' : 'bg-[#fff4dd] text-[#8c5b16]'"
        >
          大模型 {{ summary.llmEnabled ? '已启用' : '未启用' }}
        </span>
        <span class="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#56706d] ring-1 ring-black/5">
          ASR：{{ summary.asrBackend || '—' }}
        </span>
      </div>
    </div>

    <div class="mt-3 grid gap-2 sm:grid-cols-3">
      <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">整段高匹配剔除</div>
        <div class="mt-1 font-medium text-[#173f3c]">≥ {{ formatScore(summary.highMatchReject) }}</div>
      </article>
      <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">逐句高匹配剔除</div>
        <div class="mt-1 font-medium text-[#173f3c]">≥ {{ formatScore(summary.segmentHighMatch) }}</div>
      </article>
      <article class="rounded-xl bg-[#f5faf8] px-3 py-2.5 text-xs text-[#456664]">
        <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">比对模式</div>
        <div class="mt-1 font-medium text-[#173f3c]">{{ summary.matchOnlyMode ? '仅 ASR↔字幕相似度' : 'LLM + ASR 混合' }}</div>
      </article>
    </div>

    <details class="mt-3 rounded-xl bg-[#f7fbfa] px-3 py-2.5 text-xs text-[#607a77] ring-1 ring-[rgba(47,143,131,0.08)]">
      <summary class="cursor-pointer font-medium text-[#2a726d]">如何单独测试普通话过滤</summary>
      <ol class="mt-2 list-decimal space-y-1 pl-4 leading-6">
        <li>进入 <code class="rounded bg-white px-1">backend/dialect_data</code>，确保已配置 <code class="rounded bg-white px-1">DASHSCOPE_API_KEY</code>（当前 asr_backend 为 dashscope）。</li>
        <li>若要单独测普通话过滤：<code class="block mt-1 whitespace-pre-wrap rounded bg-white px-2 py-1 text-[11px] text-[#173f3c]">python filter_mandarin.py --profile wenzhou --dry-run --limit 3 -v</code></li>
        <li>当前为 <strong>大模型 + ASR 混合模式</strong>：字幕与音频转写都会经 LLM 判是否标准普通话。</li>
      </ol>
    </details>

    <div v-if="clips.length" class="mt-4 space-y-3">
      <div
        v-for="clip in clips"
        :key="`${clip.id}-${clip.verdict}`"
        class="rounded-xl border px-3 py-3"
        :class="clip.verdict === 'rejected' ? 'border-[rgba(194,61,61,0.2)] bg-[#fff8f8]' : 'border-[rgba(72,155,102,0.18)] bg-[#f8fcf9]'"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-[#173f3c]">{{ clip.id }}</span>
          <span
            class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            :class="clip.verdict === 'rejected' ? 'bg-[#ffeded] text-[#963737]' : 'bg-[#e9f7ee] text-[#22613a]'"
          >
            {{ clip.verdict === 'rejected' ? '已剔除' : '已保留' }}
          </span>
          <span v-if="clip.matchScore != null" class="text-[11px] text-[#607a77]">
            整段相似度 {{ formatScore(clip.matchScore) }}
          </span>
        </div>

        <div v-if="clip.reasons?.length" class="mt-2 flex flex-wrap gap-1.5">
          <span
            v-for="reason in clip.reasons"
            :key="reason"
            class="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-[#8c5b16] ring-1 ring-black/5"
          >
            {{ reasonLabel(reason) }}
          </span>
        </div>

        <div class="mt-3 grid gap-2 lg:grid-cols-2">
          <article class="rounded-lg bg-white/70 px-3 py-2.5">
            <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">字幕 OCR（被比对文本）</div>
            <p class="mt-1 text-sm leading-6 text-[#2b4442]">{{ clip.ocrText || '—' }}</p>
          </article>
          <article class="rounded-lg bg-white/70 px-3 py-2.5">
            <div class="text-[10px] uppercase tracking-[0.12em] text-[#6a8380]">普通话 ASR 识别结果</div>
            <p class="mt-1 text-sm leading-6 text-[#2b4442]">{{ clip.asrText || '（未跑 ASR 或识别失败）' }}</p>
          </article>
        </div>

        <div
          v-if="summary.llmEnabled && (clip.llmSubtitle?.reason || clip.llmAsr?.reason)"
          class="mt-2 rounded-lg bg-[#fff8ea] px-3 py-2 text-[11px] leading-5 text-[#735325]"
        >
          <span class="font-semibold">大模型判断：</span>
          字幕 {{ clip.llmSubtitle?.isMandarin ? '普通话' : '非普通话' }}（{{ formatScore(clip.llmSubtitle?.confidence) }}）；
          ASR {{ clip.llmAsr?.isMandarin ? '普通话' : '非普通话' }}（{{ formatScore(clip.llmAsr?.confidence) }}）
        </div>

        <div v-if="clip.segments?.length" class="mt-3 overflow-x-auto">
          <table class="min-w-full text-left text-[11px]">
            <thead class="text-[#6a8380]">
              <tr>
                <th class="px-2 py-1">逐句 OCR</th>
                <th class="px-2 py-1">逐句 ASR</th>
                <th class="px-2 py-1">相似度</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(seg, idx) in clip.segments" :key="idx" class="border-t border-black/5">
                <td class="px-2 py-1.5 text-[#2b4442]">{{ seg.ocr || '—' }}</td>
                <td class="px-2 py-1.5 text-[#2b4442]">{{ seg.asr || '—' }}</td>
                <td class="px-2 py-1.5 font-medium" :class="Number(seg.match) >= 0.9 ? 'text-[#963737]' : 'text-[#173f3c]'">
                  {{ formatScore(seg.match) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <p v-else class="mt-3 text-xs text-[#607a77]">暂无 clip 级识别明细（可能尚未跑过过滤，或报告为空）。</p>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  stage: {
    type: Object,
    default: null
  }
})

const summary = computed(() => props.stage?.metadata?.mandarinSummary || null)
const clips = computed(() => summary.value?.clips || [])

function formatScore(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return `${Math.round(num * 1000) / 10}%`
}

function reasonLabel(reason) {
  const text = String(reason || '')
  if (text.startsWith('segment_high_match')) return '逐句 ASR 与字幕高度一致 → 判普通话'
  if (text === 'asr_ocr_high_match_likely_mandarin') return '整段 ASR 与字幕高度一致 → 判普通话'
  if (text === 'mandarin_subtitle_llm') return '大模型判定字幕为普通话'
  if (text === 'mandarin_subtitle_high_conf') return '大模型高置信普通话字幕'
  if (text.startsWith('asr_failed')) return 'ASR 失败'
  return text
}
</script>
