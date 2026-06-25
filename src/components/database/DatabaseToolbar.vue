<template>
  <section class="rounded-[1.7rem] border border-[rgba(47,143,131,0.12)] bg-white px-5 py-5 shadow-[0_18px_40px_rgba(22,88,85,0.08)]">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <div class="text-xs font-semibold uppercase tracking-[0.22em] text-[#2a726d]">
          {{ viewMode === 'admin' ? 'Research Console' : 'Volunteer Workspace' }}
        </div>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight text-[#123b39]">活体数据库</h1>
        <p class="mt-2 max-w-3xl text-sm leading-7 text-[#5e7471]">
          {{
            viewMode === 'admin'
              ? '这里直接承接地图页上传且内容类型为方言的样本，只负责治理、审核与追踪，不再承担上传入口。'
              : '这里直接承接地图页上传且内容类型为方言的样本，按负责片区处理志愿者审核。'
          }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <div class="inline-flex rounded-2xl border border-[rgba(47,143,131,0.16)] bg-[#f7fbfa] p-1">
          <button
            type="button"
            class="rounded-xl px-3 py-2 text-sm font-medium transition"
            :class="viewMode === 'admin' ? 'bg-white text-[#174a47] shadow-[0_6px_14px_rgba(22,88,85,0.08)]' : 'text-[#5e7471]'"
            @click="$emit('switch-view', 'admin')"
          >
            管理员视图
          </button>
          <button
            type="button"
            class="rounded-xl px-3 py-2 text-sm font-medium transition"
            :class="viewMode === 'volunteer' ? 'bg-white text-[#174a47] shadow-[0_6px_14px_rgba(22,88,85,0.08)]' : 'text-[#5e7471]'"
            @click="$emit('switch-view', 'volunteer')"
          >
            志愿者视图
          </button>
        </div>
        <button
          type="button"
          class="rounded-2xl border border-[rgba(47,143,131,0.16)] bg-white px-4 py-2.5 text-sm font-medium text-[#174a47]"
          @click="$emit('toggle-map')"
        >
          {{ mapPanelOpen ? '收起空间视图' : '打开空间视图' }}
        </button>
      </div>
    </div>

    <div
      v-if="viewMode === 'volunteer'"
      class="mt-5 grid gap-3 rounded-2xl border border-[rgba(47,143,131,0.12)] bg-[#f7fbfa] px-4 py-4"
    >
      <div class="grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-end">
        <label class="block">
          <span class="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#607a77]">志愿者 ID</span>
          <input
            :value="volunteerProfile.reviewerName"
            class="toolbar-field"
            type="text"
            placeholder="输入志愿者 ID"
            @input="$emit('update-volunteer-name', $event.target.value)"
          />
        </label>
        <div class="rounded-2xl bg-white px-4 py-3 ring-1 ring-[rgba(47,143,131,0.08)]">
          <div class="text-[11px] uppercase tracking-[0.14em] text-[#6a8380]">当前负责片区</div>
          <div class="mt-2 text-sm font-medium text-[#173f3c]">{{ volunteerScopeText }}</div>
          <p v-if="!volunteerProfile.reviewerName" class="mt-1 text-xs text-[#607a77]">输入志愿者 ID 后自动分配温州片区。</p>
        </div>
      </div>
    </div>

    <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <article class="rounded-2xl bg-[#f5faf8] px-4 py-3">
        <div class="text-[11px] uppercase tracking-[0.16em] text-[#6a8380]">总贡献</div>
        <div class="mt-2 text-2xl font-semibold text-[#173f3c]">{{ overview.totalContributions }}</div>
      </article>
      <article class="rounded-2xl bg-[#f5faf8] px-4 py-3">
        <div class="text-[11px] uppercase tracking-[0.16em] text-[#6a8380]">治理中</div>
        <div class="mt-2 text-2xl font-semibold text-[#173f3c]">{{ overview.processingCount }}</div>
      </article>
      <article class="rounded-2xl bg-[#f5faf8] px-4 py-3">
        <div class="text-[11px] uppercase tracking-[0.16em] text-[#6a8380]">可训练</div>
        <div class="mt-2 text-2xl font-semibold text-[#173f3c]">{{ overview.readyCount }}</div>
      </article>
      <article v-if="viewMode === 'admin'" class="rounded-2xl bg-[#f5faf8] px-4 py-3">
        <div class="text-[11px] uppercase tracking-[0.16em] text-[#6a8380]">待复核</div>
        <div class="mt-2 text-2xl font-semibold text-[#173f3c]">{{ pipelineMetrics.reviewQueueCount || 0 }}</div>
      </article>
      <article v-else class="rounded-2xl bg-[#f5faf8] px-4 py-3">
        <div class="text-[11px] uppercase tracking-[0.16em] text-[#6a8380]">我的审核范围</div>
        <div class="mt-2 text-sm font-semibold text-[#173f3c]">{{ volunteerScopeText }}</div>
      </article>
    </div>

    <div
      class="mt-5 grid gap-3"
      :class="
        viewMode === 'admin'
          ? 'xl:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,0.7fr))_repeat(3,minmax(0,0.65fr))]'
          : 'xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.75fr))]'
      "
    >
      <label class="block">
        <span class="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#607a77]">搜索</span>
        <input
          :value="filters.search"
          class="toolbar-field"
          type="text"
          placeholder="任务 ID / 地区 / 方言 / 上传者"
          @input="$emit('update-search', $event.target.value)"
        />
      </label>

      <label class="block">
        <span class="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#607a77]">省</span>
        <select :value="filters.province" class="toolbar-field" @change="$emit('update-province', $event.target.value)">
          <option value="">全国</option>
          <option v-for="province in regionTree" :key="province.name" :value="province.name">{{ province.name }}</option>
        </select>
      </label>

      <label class="block">
        <span class="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#607a77]">市</span>
        <select :value="filters.city" class="toolbar-field" :disabled="!filters.province" @change="$emit('update-city', $event.target.value)">
          <option value="">全部城市</option>
          <option v-for="city in cityOptions" :key="city.name" :value="city.name">{{ city.name }}</option>
        </select>
      </label>

      <label class="block">
        <span class="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#607a77]">区县</span>
        <select :value="filters.district" class="toolbar-field" :disabled="!filters.city" @change="$emit('update-district', $event.target.value)">
          <option value="">全部区县</option>
          <option v-for="district in districtOptions" :key="district" :value="district">{{ district }}</option>
        </select>
      </label>

      <div class="block">
        <span class="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#607a77]">内容类型</span>
        <div class="toolbar-field bg-[#f5faf8] text-[#173f3c]">方言（固定）</div>
      </div>

      <label class="block">
        <span class="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#607a77]">状态</span>
        <select :value="filters.status" class="toolbar-field" @change="$emit('update-status', $event.target.value)">
          <option value="">全部状态</option>
          <option value="new">新贡献</option>
          <option value="processing">治理中</option>
          <option value="review">待复核</option>
          <option value="failed">失败</option>
          <option value="ready">可训练</option>
        </select>
      </label>

      <div v-if="viewMode === 'admin'" class="block">
        <span class="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#607a77]">数据来源</span>
        <div class="toolbar-field bg-[#f5faf8] text-[#173f3c]">地图上传</div>
      </div>

      <label v-if="viewMode === 'admin'" class="block">
        <span class="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-[#607a77]">复核</span>
        <select :value="filters.hasReview" class="toolbar-field" @change="$emit('update-has-review', $event.target.value)">
          <option value="">全部</option>
          <option value="true">有复核</option>
          <option value="false">无复核</option>
        </select>
      </label>
    </div>

    <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
      <div class="text-sm text-[#607a77]">当前列表结果 {{ total }} 条</div>
      <div v-if="viewMode === 'admin'" class="flex flex-wrap gap-2">
        <select :value="filters.sort" class="toolbar-field toolbar-field--compact" @change="$emit('update-sort', $event.target.value)">
          <option value="createdAt">按创建时间</option>
          <option value="updatedAt">按更新时间</option>
          <option value="readySegmentCount">按训练片段数</option>
        </select>
        <select :value="filters.order" class="toolbar-field toolbar-field--compact" @change="$emit('update-order', $event.target.value)">
          <option value="desc">降序</option>
          <option value="asc">升序</option>
        </select>
        <button
          type="button"
          class="rounded-xl border border-[rgba(47,143,131,0.16)] bg-white px-3 py-2 text-sm text-[#173f3c]"
          @click="$emit('clear-filters')"
        >
          清空筛选
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  overview: {
    type: Object,
    required: true
  },
  pipelineMetrics: {
    type: Object,
    required: true
  },
  viewMode: {
    type: String,
    default: 'admin'
  },
  filters: {
    type: Object,
    required: true
  },
  regionTree: {
    type: Array,
    required: true
  },
  cityOptions: {
    type: Array,
    required: true
  },
  districtOptions: {
    type: Array,
    required: true
  },
  contentTypes: {
    type: Array,
    required: true
  },
  total: {
    type: Number,
    default: 0
  },
  mapPanelOpen: {
    type: Boolean,
    default: false
  },
  volunteerProfile: {
    type: Object,
    default: () => ({ reviewerName: '', province: '', city: '', district: '', areaScope: '', status: '' })
  },
  volunteerApplying: {
    type: Boolean,
    default: false
  }
})

defineEmits([
  'switch-view',
  'toggle-map',
  'apply-volunteer',
  'update-volunteer-name',
  'update-search',
  'update-province',
  'update-city',
  'update-district',
  'update-type',
  'update-status',
  'update-source-type',
  'update-has-review',
  'update-sort',
  'update-order',
  'clear-filters'
])

const volunteerScopeText = computed(() => {
  const parts = [
    props.volunteerProfile?.province,
    props.volunteerProfile?.city,
    props.volunteerProfile?.district
  ].filter(Boolean)
  return parts.length ? parts.join(' / ') : '请输入志愿者 ID'
})
</script>

<style scoped>
.toolbar-field {
  width: 100%;
  border-radius: 1rem;
  border: 1px solid rgba(47, 143, 131, 0.16);
  background: white;
  padding: 0.72rem 0.9rem;
  color: #173f3c;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.toolbar-field:focus {
  border-color: #2f8f83;
  box-shadow: 0 0 0 3px rgba(47, 143, 131, 0.12);
}

.toolbar-field:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.toolbar-field--compact {
  width: auto;
  min-width: 9rem;
}
</style>
