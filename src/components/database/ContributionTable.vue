<template>
  <section class="rounded-[1.7rem] border border-[rgba(47,143,131,0.12)] bg-white shadow-[0_18px_40px_rgba(22,88,85,0.08)]">
    <div class="flex items-center justify-between gap-3 border-b border-[rgba(47,143,131,0.08)] px-5 py-4">
      <div>
        <div class="text-xs font-semibold uppercase tracking-[0.2em] text-[#2a726d]">
          {{ viewMode === 'admin' ? 'Contribution Table' : 'Volunteer Review Queue' }}
        </div>
        <h2 class="mt-1 text-lg font-semibold text-[#123b39]">
          {{ viewMode === 'admin' ? '贡献任务数据库' : '志愿者审核队列' }}
        </h2>
      </div>
      <div class="rounded-full bg-[#f3faf8] px-3 py-1 text-xs font-medium text-[#1e5752]">
        当前页 {{ rows.length }} / 总计 {{ total }}
      </div>
    </div>

    <div v-if="loading" class="px-5 py-6 text-sm text-[#607a77]">记录列表加载中…</div>

    <template v-else>
      <div v-if="rows.length" class="hidden overflow-x-auto lg:block">
        <table class="min-w-full text-left">
          <thead class="bg-[#f8fcfb] text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">
            <tr>
              <th class="px-3 py-3"></th>
              <th class="px-3 py-3">任务 ID</th>
              <th class="px-3 py-3">创建时间</th>
              <th class="px-3 py-3">地区</th>
              <th class="px-3 py-3">方言标签</th>
              <th v-if="viewMode === 'admin'" class="px-3 py-3">来源类型</th>
              <th class="px-3 py-3">内容类型</th>
              <th class="px-3 py-3">{{ viewMode === 'admin' ? '当前状态' : '审核状态' }}</th>
              <th class="px-3 py-3">当前阶段</th>
              <th v-if="viewMode === 'admin'" class="px-3 py-3">训练片段数</th>
              <th v-if="viewMode === 'admin'" class="px-3 py-3">复核标记</th>
              <th class="px-3 py-3">{{ viewMode === 'admin' ? '上传者' : '提交者' }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in rows" :key="row.id">
              <tr
                class="cursor-pointer border-t border-[rgba(47,143,131,0.08)] transition hover:bg-[#f8fcfb]"
                :class="String(selectedRowId) === String(row.id) ? 'bg-[#f3faf8]' : ''"
                @click="$emit('select-row', row.id)"
              >
                <td class="px-3 py-3">
                  <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(47,143,131,0.16)] text-[#456664]"
                    @click.stop="$emit('toggle-row', row.id)"
                  >
                    {{ isExpanded(row.id) ? '−' : '+' }}
                  </button>
                </td>
                <td class="px-3 py-3 text-sm font-semibold text-[#173f3c]">{{ row.id }}</td>
                <td class="px-3 py-3 text-sm text-[#3c5b58]">{{ formatDateTime(row.createdAt) }}</td>
                <td class="px-3 py-3 text-sm text-[#3c5b58]">{{ describeArea(row.area) }}</td>
                <td class="px-3 py-3 text-sm text-[#173f3c]">{{ row.dialectLabel }}</td>
                <td v-if="viewMode === 'admin'" class="px-3 py-3 text-sm text-[#3c5b58]">{{ row.sourceType }}</td>
                <td class="px-3 py-3 text-sm text-[#3c5b58]">{{ row.type }}</td>
                <td class="px-3 py-3">
                  <span
                    class="rounded-full px-3 py-1 text-xs font-semibold"
                    :class="rowStatusMeta(row).chip"
                  >
                    {{ rowStatusMeta(row).label }}
                  </span>
                </td>
                <td class="px-3 py-3 text-sm text-[#3c5b58]">{{ row.currentStage }}</td>
                <td v-if="viewMode === 'admin'" class="px-3 py-3 text-sm text-[#3c5b58]">{{ row.readySegmentCount }}</td>
                <td v-if="viewMode === 'admin'" class="px-3 py-3">
                  <span
                    class="rounded-full px-3 py-1 text-xs font-medium"
                    :class="row.hasReview ? 'bg-[#fff8ea] text-[#8c5b16]' : 'bg-[#f3faf8] text-[#1e5752]'"
                  >
                    {{ row.hasReview ? '有复核' : '正常' }}
                  </span>
                </td>
                <td class="px-3 py-3 text-sm text-[#3c5b58]">{{ row.nickname }}</td>
              </tr>
              <tr v-if="isExpanded(row.id)" class="border-t border-[rgba(47,143,131,0.08)] bg-[#fcfffe]">
                <td :colspan="viewMode === 'admin' ? 12 : 9" class="px-3 py-4">
                  <ContributionExpandedRow
                    :view-mode="viewMode"
                    :row="row"
                    :state="expandedStateById[String(row.id)] || emptyState"
                    :volunteer-profile="volunteerProfile"
                    :submit-volunteer-review="submitVolunteerReview"
                  />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="rows.length" class="grid gap-3 p-4 lg:hidden">
        <article
          v-for="row in rows"
          :key="row.id"
          class="rounded-[1.35rem] border border-[rgba(47,143,131,0.12)] bg-white p-4 shadow-[0_10px_24px_rgba(22,88,85,0.05)]"
          :class="String(selectedRowId) === String(row.id) ? 'ring-2 ring-[rgba(47,143,131,0.16)]' : ''"
          @click="$emit('select-row', row.id)"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-sm font-semibold text-[#173f3c]">{{ row.id }}</div>
              <p class="mt-1 text-xs text-[#607a77]">{{ formatDateTime(row.createdAt) }}</p>
            </div>
            <button
              type="button"
              class="rounded-full border border-[rgba(47,143,131,0.16)] px-3 py-1 text-xs text-[#456664]"
              @click.stop="$emit('toggle-row', row.id)"
            >
              {{ isExpanded(row.id) ? '收起' : '展开' }}
            </button>
          </div>
          <div class="mt-3 grid gap-2 text-sm text-[#3c5b58]">
            <div>地区：{{ describeArea(row.area) }}</div>
            <div>方言：{{ row.dialectLabel }}</div>
            <div v-if="viewMode === 'admin'">来源：{{ row.sourceType }}</div>
            <div>阶段：{{ row.currentStage }}</div>
            <div class="flex flex-wrap gap-2">
              <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="rowStatusMeta(row).chip">
                {{ rowStatusMeta(row).label }}
              </span>
              <span v-if="viewMode === 'admin' && row.hasReview" class="rounded-full bg-[#fff8ea] px-3 py-1 text-xs font-medium text-[#8c5b16]">有复核</span>
            </div>
          </div>
          <div v-if="isExpanded(row.id)" class="mt-4 border-t border-[rgba(47,143,131,0.08)] pt-4">
            <ContributionExpandedRow
              :view-mode="viewMode"
              :row="row"
              :state="expandedStateById[String(row.id)] || emptyState"
              :volunteer-profile="volunteerProfile"
              :submit-volunteer-review="submitVolunteerReview"
            />
          </div>
        </article>
      </div>

      <div v-else class="px-5 py-8 text-sm text-[#607a77]">当前筛选条件下没有记录。</div>
    </template>

    <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(47,143,131,0.08)] px-5 py-4">
      <div class="text-sm text-[#607a77]">第 {{ page }} / {{ totalPages }} 页</div>
      <div class="flex items-center gap-2">
        <select
          :value="pageSize"
          class="rounded-xl border border-[rgba(47,143,131,0.16)] bg-white px-3 py-2 text-sm text-[#173f3c]"
          @change="$emit('set-page-size', Number($event.target.value))"
        >
          <option :value="12">12 / 页</option>
          <option :value="20">20 / 页</option>
          <option :value="50">50 / 页</option>
        </select>
        <button
          type="button"
          class="rounded-xl border border-[rgba(47,143,131,0.16)] bg-white px-3 py-2 text-sm text-[#173f3c] disabled:opacity-40"
          :disabled="page <= 1"
          @click="$emit('set-page', page - 1)"
        >
          上一页
        </button>
        <button
          type="button"
          class="rounded-xl border border-[rgba(47,143,131,0.16)] bg-white px-3 py-2 text-sm text-[#173f3c] disabled:opacity-40"
          :disabled="page >= totalPages"
          @click="$emit('set-page', page + 1)"
        >
          下一页
        </button>
      </div>
    </footer>
  </section>
</template>

<script setup>
import { describeArea, formatDateTime, getStatusMeta, getVolunteerRowStatusMeta } from '../../data/dialect-map-config.js'
import ContributionExpandedRow from './ContributionExpandedRow.vue'

const props = defineProps({
  viewMode: {
    type: String,
    default: 'admin'
  },
  rows: {
    type: Array,
    default: () => []
  },
  total: {
    type: Number,
    default: 0
  },
  page: {
    type: Number,
    default: 1
  },
  pageSize: {
    type: Number,
    default: 12
  },
  totalPages: {
    type: Number,
    default: 1
  },
  selectedRowId: {
    type: [String, Number],
    default: ''
  },
  expandedRowIds: {
    type: Array,
    default: () => []
  },
  expandedStateById: {
    type: Object,
    default: () => ({})
  },
  loading: {
    type: Boolean,
    default: false
  },
  volunteerProfile: {
    type: Object,
    default: () => ({})
  },
  submitVolunteerReview: {
    type: Function,
    default: null
  },
  hasVolunteerReviewed: {
    type: Function,
    default: null
  }
})

defineEmits(['select-row', 'toggle-row', 'set-page', 'set-page-size'])

const emptyState = {
  loading: false,
  error: '',
  detail: null,
  pipeline: null,
  segments: []
}

function isExpanded(id) {
  return props.expandedRowIds.includes(String(id))
}

function rowStatusMeta(row) {
  if (row.status === 'failed') return getStatusMeta('failed')
  if (props.viewMode === 'volunteer') {
    const reviewerName = props.volunteerProfile?.reviewerName || ''
    const reviewedByMe = props.hasVolunteerReviewed
      ? props.hasVolunteerReviewed(reviewerName, row.id)
      : false
    return getVolunteerRowStatusMeta(row, reviewerName, reviewedByMe)
  }
  return getStatusMeta(row.status)
}
</script>
