<template>
  <div>
    <!-- 8 个 agent 卡片 grid -->
    <div class="grid grid-cols-2 gap-2 pt-1 md:grid-cols-4">
      <template v-for="(stage, idx) in stages" :key="stage.key">
        <article
          class="group relative cursor-pointer overflow-hidden rounded-[1.2rem] border p-0 shadow-[0_8px_20px_rgba(18,59,57,0.05)] transition hover:-translate-y-[2px] hover:shadow-[0_14px_28px_rgba(18,59,57,0.1)] select-none"
          :class="[
            toneClass(stage.state),
            selectedKey === stage.key ? 'ring-2 ring-[#2f8f83] ring-offset-1 shadow-[0_0_0_3px_rgba(47,143,131,0.12)]' : ''
          ]"
          @click="toggleSelect(stage.key)"
        >
          <div class="absolute left-2 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/5 text-[9px] font-bold text-current opacity-40">
            {{ idx + 1 }}
          </div>
          <div class="absolute inset-x-0 top-0 h-1.5" :class="accentClass(stage.state)" />
          <!-- 选中指示箭头 -->
          <div
            v-if="selectedKey === stage.key"
            class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0"
            style="border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 7px solid rgba(47,143,131,0.35); z-index:10;"
          />
          <div class="p-3.5">
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 items-start gap-3">
                <div
                  class="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-black/5"
                  :class="iconToneClass(stage.state)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    class="h-[22px] w-[22px]"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path v-for="(d, i) in stageIcon(stage.key)" :key="i" :d="d" />
                  </svg>
                  <span
                    v-if="stage.state === 'running'"
                    class="absolute -right-1 -top-1 flex h-3 w-3"
                  >
                    <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4d82c8] opacity-60" />
                    <span class="relative inline-flex h-3 w-3 rounded-full bg-[#4d82c8] ring-2 ring-white" />
                  </span>
                </div>
                <div class="min-w-0">
                  <div class="truncate text-sm font-semibold">{{ stage.label }}</div>
                  <div class="mt-1 truncate text-[11px] uppercase tracking-[0.14em] opacity-70">{{ stage.agentName || stage.key }}</div>
                </div>
              </div>
              <div class="shrink-0 text-right">
                <div
                  class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-black/5"
                  :class="badgeClass(stage.state)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    class="h-3 w-3"
                    :class="{ 'animate-spin': stage.state === 'running' }"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path v-for="(d, i) in stateIcon(stage.state)" :key="i" :d="d" />
                  </svg>
                  {{ stageStateText(stage.state) }}
                </div>
              </div>
            </div>

            <p v-if="stage.note" class="mt-3 truncate rounded-xl bg-white/55 px-3 py-2 text-xs leading-5 ring-1 ring-black/5">
              {{ stage.note }}
            </p>

            <!-- 点击提示 -->
            <div class="mt-2 text-[10px] opacity-0 group-hover:opacity-50 transition-opacity tracking-wide text-current">
              点击查看详情 ›
            </div>
          </div>
        </article>
      </template>
    </div>

    <!-- 详情面板 -->
    <transition name="detail-panel">
      <div v-if="selectedStage" class="mt-3">
        <!-- 普通话过滤：特化面板 -->
        <MandarinFilterPanel v-if="selectedStage.key === 'mandarin_filter_agent'" :stage="selectedStage" />
        <!-- 其余 agent：通用可视化面板 -->
        <GenericAgentPanel v-else :stage="selectedStage" />
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { stageStateText } from '../../data/dialect-map-config.js'
import MandarinFilterPanel from './MandarinFilterPanel.vue'
import GenericAgentPanel from './GenericAgentPanel.vue'

const props = defineProps({
  stages: {
    type: Array,
    default: () => []
  }
})

const selectedKey = ref(null)

const selectedStage = computed(
  () => (props.stages || []).find((s) => s.key === selectedKey.value) || null
)

function toggleSelect(key) {
  selectedKey.value = selectedKey.value === key ? null : key
}

function toneClass(state) {
  if (state === 'complete') return 'border-[rgba(72,155,102,0.22)] bg-[linear-gradient(180deg,#f4fcf6_0%,#edf8f1_100%)] text-[#1f5d37]'
  if (state === 'running') return 'border-[rgba(91,143,214,0.22)] bg-[linear-gradient(180deg,#f6faff_0%,#eef5ff_100%)] text-[#214f78]'
  if (state === 'review') return 'border-[rgba(214,150,41,0.24)] bg-[linear-gradient(180deg,#fffbf1_0%,#fff8ea_100%)] text-[#8c5b16]'
  if (state === 'failed') return 'border-[rgba(194,61,61,0.24)] bg-[linear-gradient(180deg,#fff6f6_0%,#fff0f0_100%)] text-[#8b2d2d]'
  return 'border-[rgba(47,143,131,0.12)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fcfb_100%)] text-[#486260]'
}

function accentClass(state) {
  if (state === 'complete') return 'bg-[linear-gradient(90deg,#8fd9a4_0%,#4c9b67_100%)]'
  if (state === 'running') return 'bg-[linear-gradient(90deg,#9dc8ff_0%,#4d82c8_100%)]'
  if (state === 'review') return 'bg-[linear-gradient(90deg,#ffe1a3_0%,#d79b2c_100%)]'
  if (state === 'failed') return 'bg-[linear-gradient(90deg,#ffb7b7_0%,#d75959_100%)]'
  return 'bg-[linear-gradient(90deg,#cbe7e2_0%,#7fb7af_100%)]'
}

function badgeClass(state) {
  if (state === 'complete') return 'bg-[#e9f7ee] text-[#22613a]'
  if (state === 'running') return 'bg-[#edf4ff] text-[#275a8a]'
  if (state === 'review') return 'bg-[#fff3dc] text-[#8d5b18]'
  if (state === 'failed') return 'bg-[#fff0f0] text-[#963737]'
  return 'bg-[#f1f6f5] text-[#57716e]'
}

function iconToneClass(state) {
  if (state === 'complete') return 'bg-[#e5f5ea] text-[#22613a]'
  if (state === 'running') return 'bg-[#eaf2ff] text-[#275a8a]'
  if (state === 'review') return 'bg-[#fff0d8] text-[#8d5b18]'
  if (state === 'failed') return 'bg-[#ffeded] text-[#963737]'
  return 'bg-[#eef5f3] text-[#57716e]'
}

const STAGE_ICONS = {
  intake_agent: ['M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3', 'M12 4v9', 'M8 9l4 4 4-4'],
  subtitle_source_agent: ['M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M7 10h10', 'M7 14h6'],
  audio_prep_agent: ['M5 11v2', 'M8.5 8v8', 'M12 5v14', 'M15.5 9v6', 'M19 11v2'],
  transcription_agent: ['M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z', 'M6 11a6 6 0 0 0 12 0', 'M12 17v4', 'M9 21h6'],
  llm_proofread_agent: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5', 'M9 14l2 2 4-4'],
  segmentation_agent: ['M4 7a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M4 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M8 8.5L20 16', 'M8 15.5L20 8'],
  mandarin_filter_agent: ['M4 5h16l-6 7v6l-4 2v-8z'],
  metadata_writer_agent: ['M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3z', 'M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6', 'M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6'],
}

const DEFAULT_ICON = ['M4 12a8 8 0 0 1 13.5-5.8L20 8', 'M20 4v4h-4', 'M20 12a8 8 0 0 1-13.5 5.8L4 16', 'M4 20v-4h4']

function stageIcon(key) {
  return STAGE_ICONS[key] || DEFAULT_ICON
}

function stateIcon(state) {
  if (state === 'complete') return ['M5 12l4 4 9-10']
  if (state === 'running') return ['M12 3a9 9 0 1 0 9 9']
  if (state === 'review') return ['M12 7v5l3 2', 'M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z']
  if (state === 'failed') return ['M6 6l12 12', 'M18 6L6 18']
  return ['M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0']
}
</script>

<style scoped>
.detail-panel-enter-active,
.detail-panel-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.detail-panel-enter-from,
.detail-panel-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
