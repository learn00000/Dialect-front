<template>
  <div class="rounded-[1.35rem] border border-[rgba(47,143,131,0.12)] bg-[#f9fcfb] p-4 sm:p-5">
    <div v-if="state.loading" class="rounded-2xl bg-white px-4 py-4 text-sm text-[#456664] ring-1 ring-[rgba(47,143,131,0.1)]">
      记录详情加载中…
    </div>

    <div v-else-if="state.error" class="rounded-2xl bg-[#fff2f2] px-4 py-4 text-sm text-[#8b2d2d] ring-1 ring-[rgba(194,61,61,0.16)]">
      {{ state.error }}
    </div>

    <div v-else class="grid gap-4">
      <section class="rounded-[1.2rem] border border-[rgba(47,143,131,0.1)] bg-white p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="statusMeta.chip">
            {{ statusMeta.label }}
          </span>
          <span class="rounded-full bg-[#eef7ff] px-3 py-1 text-xs font-medium text-[#21537d]">
            {{ detail.sourceType || row.sourceType }}
          </span>
          <span class="rounded-full bg-[#f3faf8] px-3 py-1 text-xs font-medium text-[#1e5752]">
            当前阶段：{{ detail.currentStageLabel || row.currentStage || '待处理' }}
          </span>
        </div>

        <div class="mt-4 grid gap-3 lg:grid-cols-4">
          <article class="rounded-2xl bg-[#f5faf8] px-4 py-3">
            <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">地区</div>
            <div class="mt-2 text-sm font-medium text-[#173f3c]">{{ describeArea(detail.area || row.area) }}</div>
          </article>
          <article class="rounded-2xl bg-[#f5faf8] px-4 py-3">
            <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">方言标签</div>
            <div class="mt-2 text-sm font-medium text-[#173f3c]">{{ detail.dialectLabel || row.dialectLabel }}</div>
          </article>
          <article class="rounded-2xl bg-[#f5faf8] px-4 py-3">
            <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">上传者</div>
            <div class="mt-2 text-sm font-medium text-[#173f3c]">{{ detail.nickname || row.nickname }}</div>
          </article>
          <article class="rounded-2xl bg-[#f5faf8] px-4 py-3">
            <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">创建时间</div>
            <div class="mt-2 text-sm font-medium text-[#173f3c]">{{ formatDateTime(detail.createdAt || row.createdAt) }}</div>
          </article>
        </div>

        <div class="mt-4 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
          <article class="rounded-2xl bg-[#fcfffe] px-4 py-3 ring-1 ring-[rgba(47,143,131,0.08)]">
            <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">说明与转写摘要</div>
            <p class="mt-2 text-sm leading-7 text-[#2b4442]">{{ detail.content || row.content || '暂无说明。' }}</p>
            <p class="mt-3 rounded-xl bg-[#f3faf8] px-3 py-2 text-sm leading-7 text-[#2b4442]">
              {{ detail.transcriptSnippet || row.transcriptSnippet || '系统尚未生成转写摘要。' }}
            </p>
            <div v-if="detail.riskFlags?.length" class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="flag in detail.riskFlags"
                :key="flag"
                class="rounded-full bg-[#fff8ea] px-3 py-1 text-xs font-medium text-[#8c5b16] ring-1 ring-[rgba(214,150,41,0.22)]"
              >
                {{ flag }}
              </span>
            </div>
          </article>

          <article class="rounded-2xl bg-[#fcfffe] px-4 py-3 ring-1 ring-[rgba(47,143,131,0.08)]">
            <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">音频与片段</div>
            <audio v-if="detail.audioUrl" class="mt-3 w-full" controls :src="detail.audioUrl" />
            <div v-else class="mt-3 rounded-xl bg-[#f5f8f7] px-3 py-3 text-xs text-[#607a77]">当前没有可用音频预览。</div>
          </article>
        </div>
      </section>

      <section class="overflow-hidden rounded-[1.2rem] border border-[rgba(47,143,131,0.1)] bg-white p-4">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">Agent 流程</div>
            <p class="mt-1 text-xs text-[#607a77]">
              {{
                viewMode === 'admin'
                  ? '9 个智能体节点直接展示在记录展开区内，方便逐条审阅。'
                  : '可以直观看到样本正在经过哪些智能体处理，还差哪些步骤进入训练库。'
              }}
            </p>
          </div>
          <div v-if="detail.nextAction" class="rounded-full bg-[#eef4ff] px-3 py-1 text-[11px] font-medium text-[#21537d]">
            下一动作：{{ detail.nextAction }}
          </div>
        </div>
        <AgentFlowStrip :stages="pipeline.agentStages || []" />
      </section>

      <section class="rounded-[1.2rem] border border-[rgba(47,143,131,0.1)] bg-white p-4">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">训练片段</div>
            <p class="mt-1 text-xs text-[#607a77]">该任务当前写入数据库的 clip 明细。</p>
          </div>
          <div class="rounded-full bg-[#f3faf8] px-3 py-1 text-[11px] font-medium text-[#1e5752]">
            共 {{ state.segments?.length || 0 }} 条
          </div>
        </div>

        <div v-if="state.segments?.length" class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">
              <tr>
                <th class="px-3 py-2">Clip</th>
                <th class="px-3 py-2">文本</th>
                <th class="px-3 py-2">起止</th>
                <th class="px-3 py-2">状态</th>
                <th class="px-3 py-2">试听</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="segment in state.segments"
                :key="segment.id"
                class="border-t border-[rgba(47,143,131,0.08)]"
              >
                <td class="px-3 py-3 font-medium text-[#173f3c]">{{ segment.clipId }}</td>
                <td class="px-3 py-3 text-[#3c5b58]">{{ segment.text || '—' }}</td>
                <td class="px-3 py-3 text-[#3c5b58]">{{ formatSegmentRange(segment.startSec, segment.endSec) }}</td>
                <td class="px-3 py-3 text-[#3c5b58]">{{ segment.status }}</td>
                <td class="px-3 py-3">
                  <audio v-if="segment.wavUrl" class="h-8 w-[12rem]" controls :src="segment.wavUrl" />
                  <span v-else class="text-xs text-[#7a8a89]">无</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="rounded-xl bg-[#f5f8f7] px-3 py-3 text-xs text-[#607a77]">当前还没有生成训练片段。</div>
      </section>

      <section v-if="viewMode === 'volunteer'" class="rounded-[1.2rem] border border-[rgba(47,143,131,0.1)] bg-white p-4">
        <div class="mb-3">
          <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">志愿者审核</div>
          <p class="mt-1 text-xs text-[#607a77]">请判断方言准确度、校对文本，并标记是否存在内容风险。</p>
        </div>

        <div
          v-if="volunteerSummary"
          class="mb-4 rounded-2xl bg-[#f7fbfa] px-4 py-4 ring-1 ring-[rgba(47,143,131,0.08)]"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full bg-[#eef8f6] px-3 py-1 text-xs font-semibold text-[#1d5f59]">
              {{ volunteerSummary.label }}
            </span>
            <span class="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#56706d]">
              已审核 {{ volunteerSummary.totalReviews }} 人
            </span>
            <span
              v-if="volunteerSummary.nextReviewerNumber"
              class="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#56706d]"
            >
              下一位：第 {{ volunteerSummary.nextReviewerNumber }} 位
            </span>
          </div>
          <div class="mt-3 grid gap-3 lg:grid-cols-2">
            <div class="rounded-xl bg-white px-3 py-3">
              <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">方言投票</div>
              <div class="mt-2 text-sm text-[#2b4442]">
                不准确 {{ volunteerSummary.dialectDecision?.counts?.['1'] || 0 }} /
                基本准确 {{ volunteerSummary.dialectDecision?.counts?.['2'] || 0 }} /
                准确 {{ volunteerSummary.dialectDecision?.counts?.['3'] || 0 }}
              </div>
            </div>
            <div class="rounded-xl bg-white px-3 py-3">
              <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">内容风险投票</div>
              <div class="mt-2 text-sm text-[#2b4442]">
                无风险 {{ volunteerSummary.riskDecision?.noCount || 0 }} / 有风险 {{ volunteerSummary.riskDecision?.yesCount || 0 }}
              </div>
            </div>
          </div>
          <p v-if="currentVolunteerReviewState" class="mt-3 text-xs text-[#607a77]">
            {{ currentVolunteerReviewState }}
          </p>
        </div>

        <div class="grid gap-4">
          <article class="rounded-2xl bg-[#fcfffe] px-4 py-3 ring-1 ring-[rgba(47,143,131,0.08)]">
            <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">1. 方言准不准确</div>
            <div class="mt-3 grid gap-2 sm:grid-cols-3">
              <button
                v-for="option in dialectOptions"
                :key="option.value"
                type="button"
                class="rounded-xl border px-3 py-3 text-sm font-medium transition"
                :class="dialectAccuracy === option.value ? 'border-[#2f8f83] bg-[#eef8f6] text-[#174a47]' : 'border-[rgba(47,143,131,0.12)] bg-white text-[#456664]'"
                @click="dialectAccuracy = option.value"
              >
                {{ option.label }}
              </button>
            </div>
            <textarea
              v-model="dialectNote"
              rows="2"
              class="mt-3 w-full rounded-xl border border-[rgba(47,143,131,0.14)] bg-white px-3 py-2.5 text-sm text-[#173f3c] outline-none focus:border-[#2f8f83]"
              placeholder="可补充说明，例如更像某个县市或点位。"
            />
          </article>

          <article class="rounded-2xl bg-[#fcfffe] px-4 py-3 ring-1 ring-[rgba(47,143,131,0.08)]">
            <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">2. 文本审核</div>
            <div class="mt-3 grid gap-3 lg:grid-cols-2">
              <div class="rounded-xl bg-[#f5faf8] px-3 py-3">
                <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">人的文本</div>
                <p class="mt-2 text-sm leading-7 text-[#2b4442]">{{ detail.userTranscript || '用户未填写。' }}</p>
              </div>
              <div class="rounded-xl bg-[#f5faf8] px-3 py-3">
                <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">ASR 文本</div>
                <p class="mt-2 text-sm leading-7 text-[#2b4442]">{{ detail.asrTranscript || '系统尚未生成 ASR。' }}</p>
              </div>
            </div>
            <div class="mt-3 grid gap-2 sm:grid-cols-3">
              <button
                v-for="option in transcriptOptions"
                :key="option.value"
                type="button"
                class="rounded-xl border px-3 py-3 text-sm font-medium transition"
                :class="transcriptChoice === option.value ? 'border-[#2f8f83] bg-[#eef8f6] text-[#174a47]' : 'border-[rgba(47,143,131,0.12)] bg-white text-[#456664]'"
                @click="transcriptChoice = option.value"
              >
                {{ option.label }}
              </button>
            </div>
            <div v-if="transcriptChoice !== 'custom'" class="mt-3 rounded-xl bg-[#f5faf8] px-3 py-3 text-sm leading-7 text-[#2b4442]">
              {{ selectedTranscriptPreview || '当前所选文本为空，请改为“自己改”。' }}
            </div>
            <label v-else class="mt-3 block">
              <span class="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">志愿者最终文本</span>
              <textarea
                v-model="transcriptFinal"
                rows="4"
                class="w-full rounded-xl border border-[rgba(47,143,131,0.14)] bg-white px-3 py-2.5 text-sm text-[#173f3c] outline-none focus:border-[#2f8f83]"
                placeholder="请输入你修订后的最终文本。"
              />
            </label>
          </article>

          <article class="rounded-2xl bg-[#fcfffe] px-4 py-3 ring-1 ring-[rgba(47,143,131,0.08)]">
            <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">3. 内容风险</div>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-xl border px-3 py-2 text-sm font-medium transition"
                :class="!riskFlag ? 'border-[#2f8f83] bg-[#eef8f6] text-[#174a47]' : 'border-[rgba(47,143,131,0.12)] bg-white text-[#456664]'"
                @click="riskFlag = false"
              >
                没有风险
              </button>
              <button
                type="button"
                class="rounded-xl border px-3 py-2 text-sm font-medium transition"
                :class="riskFlag ? 'border-[#c66b4b] bg-[#fff4ef] text-[#8b4a33]' : 'border-[rgba(47,143,131,0.12)] bg-white text-[#456664]'"
                @click="riskFlag = true"
              >
                有风险
              </button>
            </div>
            <textarea
              v-model="riskNote"
              rows="2"
              class="mt-3 w-full rounded-xl border border-[rgba(47,143,131,0.14)] bg-white px-3 py-2.5 text-sm text-[#173f3c] outline-none focus:border-[#2f8f83]"
              placeholder="若有风险，可补充原因。"
            />
          </article>

          <div class="flex flex-wrap items-center justify-between gap-3">
            <p v-if="reviewMessage" class="text-sm text-[#2a726d]">{{ reviewMessage }}</p>
            <button
              type="button"
              class="rounded-2xl bg-[linear-gradient(135deg,#7ed4ce_0%,#3a8f8a_48%,#184f4b_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(22,88,85,0.2)] disabled:opacity-45"
              :disabled="reviewSubmitting || !canSubmitVolunteerReview"
              @click="handleVolunteerReviewSubmit"
            >
              {{ reviewSubmitting ? '提交中…' : '提交志愿者审核' }}
            </button>
          </div>
        </div>
      </section>

      <section v-if="viewMode === 'admin'" class="rounded-[1.2rem] border border-[rgba(47,143,131,0.1)] bg-white p-4">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-[0.18em] text-[#2a726d]">产物与复核</div>
            <p class="mt-1 text-xs text-[#607a77]">查看资产文件、失败原因和志愿者复核状态。</p>
          </div>
        </div>

        <div class="grid gap-3 lg:grid-cols-2">
          <article class="rounded-2xl bg-[#fcfffe] px-4 py-3 ring-1 ring-[rgba(47,143,131,0.08)]">
            <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">资产文件</div>
            <div v-if="detail.assets?.length" class="mt-3 grid gap-2">
              <a
                v-for="asset in detail.assets"
                :key="asset.id"
                class="rounded-xl bg-[#f5faf8] px-3 py-2 text-sm text-[#1e5752] no-underline transition hover:bg-[#ebf7f3]"
                :href="asset.url"
                target="_blank"
                rel="noreferrer"
              >
                {{ asset.role }} · {{ asset.mime_type || asset.mimeType || 'file' }}
              </a>
            </div>
            <div v-else class="mt-3 rounded-xl bg-[#f5f8f7] px-3 py-3 text-xs text-[#607a77]">当前没有资产文件。</div>
          </article>

          <article class="rounded-2xl bg-[#fcfffe] px-4 py-3 ring-1 ring-[rgba(47,143,131,0.08)]">
            <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">复核与失败原因</div>
            <p v-if="detail.errorMessage" class="mt-3 rounded-xl bg-[#fff2f2] px-3 py-3 text-sm leading-6 text-[#8b2d2d]">
              {{ detail.errorMessage }}
            </p>
            <p v-else-if="detail.reviewReason" class="mt-3 rounded-xl bg-[#fff8ea] px-3 py-3 text-sm leading-6 text-[#8c5b16]">
              {{ detail.reviewReason }}
            </p>
            <div v-if="detail.reviewTasks?.length" class="mt-3 grid gap-2">
              <div
                v-for="task in detail.reviewTasks"
                :key="task.id"
                class="rounded-xl bg-[#f5faf8] px-3 py-3 text-sm text-[#2d4f4c]"
              >
                <div class="font-semibold">{{ task.stage_key }}</div>
                <div class="mt-1 text-xs leading-6">{{ task.reason }}</div>
              </div>
            </div>
            <div v-else-if="!detail.errorMessage && !detail.reviewReason" class="mt-3 rounded-xl bg-[#f5f8f7] px-3 py-3 text-xs text-[#607a77]">
              当前没有待复核或失败信息。
            </div>
          </article>
        </div>
        <article v-if="detail.volunteerReviews?.length" class="mt-4 rounded-2xl bg-[#fcfffe] px-4 py-3 ring-1 ring-[rgba(47,143,131,0.08)]">
          <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">志愿者审核记录</div>
          <div class="mt-3 grid gap-2">
            <div
              v-for="review in detail.volunteerReviews"
              :key="review.id"
              class="rounded-xl bg-[#f5faf8] px-3 py-3 text-sm text-[#2d4f4c]"
            >
              <div class="font-semibold">第 {{ review.review_order || '—' }} 位 · {{ review.reviewer_name }} · {{ review.area_scope }}</div>
              <div class="mt-1 text-xs leading-6">
                方言评分：{{ dialectLabel(review.dialect_accuracy) }} ｜ 风险：{{ review.risk_flag ? '有风险' : '无风险' }} ｜ 文本来源：{{ transcriptChoiceLabel(review.transcript_choice) }}
              </div>
              <div v-if="review.transcript_final" class="mt-1 text-xs leading-6">最终文本：{{ review.transcript_final }}</div>
            </div>
          </div>
        </article>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { describeArea, formatDateTime, getStatusMeta } from '../../data/dialect-map-config.js'
import AgentFlowStrip from './AgentFlowStrip.vue'

const props = defineProps({
  viewMode: {
    type: String,
    default: 'admin'
  },
  row: {
    type: Object,
    required: true
  },
  state: {
    type: Object,
    required: true
  },
  volunteerProfile: {
    type: Object,
    default: () => ({ reviewerName: '', province: '', city: '', district: '', areaScope: '', status: '' })
  },
  submitVolunteerReview: {
    type: Function,
    default: null
  }
})

const detail = computed(() => props.state.detail || props.row)
const pipeline = computed(() => props.state.pipeline || { agentStages: [] })
const statusMeta = computed(() => getStatusMeta(detail.value?.status || props.row.status))
const dialectOptions = [
  { value: 1, label: '不准确' },
  { value: 2, label: '基本准确' },
  { value: 3, label: '准确' }
]
const transcriptOptions = [
  { value: 'user', label: '选人的文本' },
  { value: 'asr', label: '选 ASR' },
  { value: 'custom', label: '自己改' }
]
const dialectAccuracy = ref(3)
const dialectNote = ref('')
const transcriptChoice = ref('user')
const transcriptFinal = ref('')
const riskFlag = ref(false)
const riskNote = ref('')
const reviewSubmitting = ref(false)
const reviewMessage = ref('')
const volunteerSummary = computed(() => detail.value?.volunteerReviewSummary || null)
const currentReviewerName = computed(() => String(props.volunteerProfile?.reviewerName || '').trim())
const currentVolunteerExistingReview = computed(() =>
  (detail.value?.volunteerReviews || []).find(
    (review) => String(review.reviewer_name || '').trim() === currentReviewerName.value
  ) || null
)
const currentVolunteerReviewState = computed(() => {
  if (detail.value?.status === 'failed' || props.row.status === 'failed') {
    return '该样本治理失败，不再接受志愿者审核。'
  }
  if (currentVolunteerExistingReview.value) {
    return `你已作为第 ${currentVolunteerExistingReview.value.review_order || '—'} 位志愿者提交过审核，不能重复投票。`
  }
  if (volunteerSummary.value?.isRejected) {
    return '该样本已被多数票判定为不准确，不再接受新的志愿者审核。'
  }
  if (volunteerSummary.value?.status === 'risk_flagged') {
    return '该样本已完成志愿者投票，但被多数票标记为有风险，等待管理员处理。'
  }
  if (volunteerSummary.value?.isPassed) {
    return '该样本已完成志愿者投票并通过。'
  }
  return ''
})
const selectedTranscriptPreview = computed(() => {
  if (transcriptChoice.value === 'asr') {
    return detail.value?.asrTranscript || ''
  }
  if (transcriptChoice.value === 'custom') {
    return transcriptFinal.value
  }
  return detail.value?.userTranscript || ''
})
const canSubmitVolunteerReview = computed(
  () =>
    Boolean(
      props.submitVolunteerReview &&
      props.volunteerProfile?.reviewerName?.trim() &&
      detail.value?.status !== 'failed' &&
      props.row.status !== 'failed' &&
      volunteerSummary.value?.canAcceptMoreReviews !== false &&
      !currentVolunteerExistingReview.value
    )
)

watch(
  detail,
  (value) => {
    dialectAccuracy.value = 3
    dialectNote.value = ''
    transcriptChoice.value = value?.userTranscript ? 'user' : (value?.asrTranscript ? 'asr' : 'custom')
    transcriptFinal.value = value?.volunteerReviewSummary?.finalTranscript || value?.userTranscript || value?.asrTranscript || ''
    riskFlag.value = false
    riskNote.value = ''
    reviewMessage.value = ''
  },
  { immediate: true }
)

function formatSegmentRange(start, end) {
  const s = Number(start || 0).toFixed(2)
  const e = Number(end || 0).toFixed(2)
  return `${s}s - ${e}s`
}

function dialectLabel(value) {
  return dialectOptions.find((item) => item.value === Number(value))?.label || '未评分'
}

function transcriptChoiceLabel(value) {
  return transcriptOptions.find((item) => item.value === String(value || 'user'))?.label || '选人的文本'
}

async function handleVolunteerReviewSubmit() {
  if (!props.submitVolunteerReview) return
  if (!props.volunteerProfile?.reviewerName?.trim()) {
    window.alert('请先在顶部输入志愿者 ID。')
    return
  }
  if (currentVolunteerExistingReview.value) {
    window.alert('你已经审核过这条样本，不能重复提交。')
    return
  }
  if (volunteerSummary.value && !volunteerSummary.value.canAcceptMoreReviews) {
    window.alert('该样本的志愿者投票已经完成。')
    return
  }
  if (transcriptChoice.value !== 'custom' && !selectedTranscriptPreview.value) {
    window.alert('当前所选文本为空，请改为“自己改”。')
    return
  }
  if (transcriptChoice.value === 'custom' && !transcriptFinal.value.trim()) {
    window.alert('选择“自己改”时必须填写最终文本。')
    return
  }
  reviewSubmitting.value = true
  reviewMessage.value = ''
  try {
    await props.submitVolunteerReview(detail.value.id, {
      reviewerName: props.volunteerProfile.reviewerName,
      province: props.volunteerProfile.province || '',
      city: props.volunteerProfile.city || '',
      district: props.volunteerProfile.district || '',
      dialectAccuracy: dialectAccuracy.value,
      dialectNote: dialectNote.value.trim(),
      transcriptChoice: transcriptChoice.value,
      transcriptFinal: transcriptChoice.value === 'custom' ? transcriptFinal.value.trim() : '',
      riskFlag: riskFlag.value,
      riskNote: riskNote.value.trim()
    })
    reviewMessage.value = '志愿者审核已提交。'
  } catch (error) {
    console.error(error)
    window.alert(error.message || '提交志愿者审核失败')
  } finally {
    reviewSubmitting.value = false
  }
}
</script>
