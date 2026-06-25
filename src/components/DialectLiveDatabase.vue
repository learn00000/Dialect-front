<template>
  <div
    class="map-shell flex min-h-screen flex-col bg-[#f4f9f7] font-sans text-ink [background-image:radial-gradient(120%_70%_at_50%_-15%,rgba(255,255,255,0.94)_0%,transparent_58%),linear-gradient(180deg,#fbffff_0%,#f4f9f7_100%)]"
  >
    <header class="site-header">
      <a class="brand" href="./index.html#top">
        <span class="brand__mark" aria-hidden="true"></span>
        <span class="brand__text">语韵东方</span>
      </a>
      <nav class="nav" aria-label="主导航">
        <a class="nav__link" href="./index.html#top">首页</a>
        <a class="nav__link" href="./index.html#features">核心功能</a>
        <a class="nav__link" href="./index.html#vision">项目愿景</a>
        <a class="nav__link" href="./index.html#footer">关于</a>
      </nav>
      <button type="button" class="btn btn--ghost" @click="onAuthClick">登录 / 注册</button>
    </header>

    <main class="flex-1">
      <div class="mx-auto flex w-full max-w-[1720px] flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <DatabaseToolbar
          :view-mode="viewMode"
          :overview="overview"
          :pipeline-metrics="pipelineMetrics"
          :filters="filters"
          :region-tree="regionTree"
          :city-options="cityOptions"
          :district-options="districtOptions"
          :content-types="contentTypes"
          :total="total"
          :map-panel-open="mapPanelOpen"
          :volunteer-profile="volunteerProfile"
          :volunteer-applying="loading.volunteerApply"
          @switch-view="setViewMode"
          @toggle-map="toggleMapPanel"
          @apply-volunteer="applyVolunteerForCurrentScope"
          @update-volunteer-name="updateVolunteerName"
          @update-search="setFilter('search', $event)"
          @update-province="setProvince"
          @update-city="setCity"
          @update-district="setDistrict"
          @update-type="setFilter('type', $event)"
          @update-status="setFilter('status', $event)"
          @update-source-type="setFilter('sourceType', $event)"
          @update-has-review="setFilter('hasReview', $event)"
          @update-sort="setFilter('sort', $event)"
          @update-order="setFilter('order', $event)"
          @clear-filters="clearFilters"
        />

        <DialectTrainingPanel
          v-if="viewMode === 'admin'"
          :stats="trainingStats"
          :loading="loading.training"
          :start-training="startTraining"
        />

        <div class="grid gap-4" :class="mapPanelOpen ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : 'grid-cols-1'">
          <ContributionTable
            :view-mode="viewMode"
            :rows="rows"
            :total="total"
            :page="filters.page"
            :page-size="filters.pageSize"
            :total-pages="totalPages"
            :selected-row-id="selectedRowId"
            :expanded-row-ids="expandedRowIds"
            :expanded-state-by-id="expandedStateById"
            :loading="loading.rows"
            :volunteer-profile="volunteerProfile"
            :has-volunteer-reviewed="hasVolunteerReviewed"
            :submit-volunteer-review="submitVolunteerReview"
            @select-row="selectRow"
            @toggle-row="toggleExpandRow"
            @set-page="setPage"
            @set-page-size="setPageSize"
          />

          <div v-if="mapPanelOpen" class="hidden xl:block">
            <DatabaseMapPanel
              :rows="mapRows"
              :selected-row-id="selectedRowId"
              @select-row="handleMapSelect"
              @close="toggleMapPanel"
            />
          </div>
        </div>
      </div>
    </main>

    <footer
      class="relative z-30 shrink-0 border-t border-[rgba(58,143,138,0.07)] bg-gradient-to-b from-white/88 to-[rgba(248,252,251,0.92)] px-4 py-2 shadow-[0_-4px_24px_rgba(22,72,70,0.04)] backdrop-blur-[14px]"
      id="footer"
    >
      <div class="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-2 gap-y-1 text-[0.88rem] text-[#5d6e6d]">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="inline-flex min-w-[6.75rem] rotate-[-2deg] items-center justify-center rounded-lg border-2 border-[#d14c4c] bg-white/75 px-3 py-1.5 text-[0.95rem] font-bold tracking-[0.12em] text-[#c23d3d] shadow-[0_4px_14px_rgba(194,61,61,0.1)]"
          >语韵东方</span>
          <span
            class="inline-flex min-w-[6.75rem] rotate-[1.5deg] items-center justify-center rounded-lg border border-dashed border-[rgba(58,143,138,0.42)] bg-white/55 px-3 py-1.5 text-[0.95rem] font-bold tracking-[0.08em] text-brand-deep"
          >{{ viewMeta.footerLabel }}</span>
        </div>
        <nav class="flex flex-wrap gap-4">
          <a href="./index.html#top" class="text-[#5d6e6d] no-underline transition hover:text-brand-deep">首页</a>
          <a href="./map.html" class="text-[#5d6e6d] no-underline transition hover:text-brand-deep">地图</a>
          <a href="./database.html" class="text-[#5d6e6d] no-underline transition hover:text-brand-deep">数据库</a>
        </nav>
      </div>
      <p class="mx-auto max-w-[1280px] px-4 pb-0.5 text-[0.68rem] leading-snug text-[#7a8a89]">
        © 2026 语韵东方 · 方言活体数据库{{ viewMeta.badge }}。
      </p>
    </footer>

    <teleport to="body">
      <div
        v-if="mapPanelOpen"
        class="fixed inset-0 z-[72] bg-[#10211f]/40 p-3 backdrop-blur-[2px] xl:hidden"
        @click.self="toggleMapPanel"
      >
        <div class="h-full overflow-hidden rounded-[1.8rem]">
          <DatabaseMapPanel
            :rows="mapRows"
            :selected-row-id="selectedRowId"
            @select-row="handleMapSelect"
            @close="toggleMapPanel"
          />
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useDialectDatabase } from '../composables/useDialectDatabase.js'
import ContributionTable from './database/ContributionTable.vue'
import DatabaseMapPanel from './database/DatabaseMapPanel.vue'
import DatabaseToolbar from './database/DatabaseToolbar.vue'
import DialectTrainingPanel from './database/DialectTrainingPanel.vue'

const {
  regionTree,
  contentTypes,
  filters,
  cityOptions,
  districtOptions,
  overview,
  pipelineMetrics,
  rows,
  total,
  totalPages,
  selectedRowId,
  expandedRowIds,
  expandedStateById,
  mapRows,
  mapPanelOpen,
  volunteerProfile,
  loading,
  setFilter,
  setProvince,
  setCity,
  setDistrict,
  setPage,
  selectRow,
  toggleExpandRow,
  openRow,
  updateVolunteerName,
  hasVolunteerReviewed,
  toggleMapPanel,
  applyVolunteerForCurrentScope,
  submitVolunteerReview,
  trainingStats,
  startTraining
} = useDialectDatabase()

const viewMode = ref('admin')

const viewMeta = computed(() => {
  if (viewMode.value === 'volunteer') {
    return {
      badge: '志愿者视图',
      footerLabel: '志愿者入口'
    }
  }

  return {
    badge: '研究后台',
    footerLabel: '管理员视图'
  }
})

function onAuthClick() {
  window.alert('登录 / 注册流程可在此对接统一认证。')
}

function setPageSize(value) {
  setFilter('pageSize', Number(value))
  setFilter('page', 1)
}

function clearFilters() {
  filters.search = ''
  filters.province = ''
  filters.city = ''
  filters.district = ''
  filters.type = '方言'
  filters.status = ''
  filters.sourceType = 'audio_upload'
  filters.hasReview = ''
  filters.sort = 'createdAt'
  filters.order = 'desc'
  filters.page = 1
}

function setViewMode(mode) {
  viewMode.value = mode === 'volunteer' ? 'volunteer' : 'admin'
  if (viewMode.value === 'volunteer') {
    filters.sourceType = 'audio_upload'
    filters.hasReview = ''
    if (volunteerProfile.status === 'approved') {
      filters.province = volunteerProfile.province || ''
      filters.city = volunteerProfile.city || ''
      filters.district = volunteerProfile.district || ''
      filters.status = ''
      filters.page = 1
    }
    filters.sort = 'createdAt'
    filters.order = 'desc'
    filters.page = 1
  }
}

async function handleMapSelect(id) {
  await openRow(id)
}
</script>

<style scoped>
:global(body.database-page) {
  min-height: 100%;
  height: auto;
  overflow-x: hidden;
  overflow-y: auto;
}

:global(body.database-page #app) {
  min-height: 100vh;
}

@supports (min-height: 100dvh) {
  :global(body.database-page #app) {
    min-height: 100dvh;
  }
}
</style>
