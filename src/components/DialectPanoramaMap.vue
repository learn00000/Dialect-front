<template>
  <div
    class="map-shell flex h-full min-h-0 flex-col bg-[#eef8f6] font-sans text-ink [background-image:radial-gradient(120%_70%_at_50%_-15%,rgba(255,255,255,0.95)_0%,transparent_58%),radial-gradient(ellipse_55%_42%_at_0%_100%,rgba(105,196,191,0.11)_0%,transparent_55%),linear-gradient(168deg,#fbffff_0%,#e9f5f3_42%,#f4fbfa_100%)]"
  >
    <!-- 顶栏：与首页 index.html 的 site-header 结构、类名一致 -->
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

    <div class="relative flex min-h-0 min-w-0 flex-1">
      <!-- 左侧边栏：与主站卡片一致的浅色玻璃 -->
      <aside
        class="relative z-20 flex shrink-0 flex-col border-r border-[rgba(58,143,138,0.12)] bg-white/55 shadow-card backdrop-blur-[14px] transition-[width] duration-300 ease-out"
        :class="sidebarCollapsed ? 'w-[52px]' : 'w-[320px]'"
      >
        <button
          type="button"
          class="absolute -right-3 top-16 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(58,143,138,0.2)] bg-white text-xs text-[#1a5c58] shadow-md transition hover:border-brand hover:bg-mist"
          :title="sidebarCollapsed ? '展开侧栏' : '收起侧栏'"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          {{ sidebarCollapsed ? '›' : '‹' }}
        </button>

        <div v-if="!sidebarCollapsed" class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <section
            class="rounded-[1.25rem] border border-white/90 bg-gradient-to-b from-white/95 to-white/75 p-4 shadow-[0_6px_28px_rgba(22,88,85,0.06)] ring-1 ring-[rgba(58,143,138,0.08)]"
          >
            <h3 class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1a5c58]">
              <span class="h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_10px_rgba(58,143,138,0.55)]" />
              地区选择
            </h3>
            <div class="space-y-2">
              <select
                v-model="selProvince"
                class="w-full rounded-xl border border-[rgba(58,143,138,0.18)] bg-white/90 px-3 py-2 text-sm text-[#152322] outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
                @change="onProvinceChange"
              >
                <option value="">请选择省</option>
                <option v-for="p in regionTree" :key="p.name" :value="p.name">{{ p.name }}</option>
              </select>
              <select
                v-model="selCity"
                class="w-full rounded-xl border border-[rgba(58,143,138,0.18)] bg-white/90 px-3 py-2 text-sm text-[#152322] outline-none focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:opacity-40"
                :disabled="!selProvince"
                @change="onCityChange"
              >
                <option value="">请选择市</option>
                <option v-for="c in cityOptions" :key="c.name" :value="c.name">{{ c.name }}</option>
              </select>
              <select
                v-model="selDistrict"
                class="w-full rounded-xl border border-[rgba(58,143,138,0.18)] bg-white/90 px-3 py-2 text-sm text-[#152322] outline-none focus:border-brand focus:ring-2 focus:ring-brand/25 disabled:opacity-40"
                :disabled="!selCity"
              >
                <option value="">请选择区县</option>
                <option v-for="d in districtOptions" :key="d" :value="d">{{ d }}</option>
              </select>
            </div>
          </section>

          <section
            class="rounded-[1.25rem] border border-white/90 bg-white/80 p-4 shadow-[0_6px_28px_rgba(22,88,85,0.05)] ring-1 ring-[rgba(58,143,138,0.06)]"
          >
            <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-[#1a5c58]">内容类型（多选）</h3>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="t in contentTypes"
                :key="t"
                type="button"
                class="rounded-full border px-3 py-1 text-xs transition"
                :class="
                  selectedTypes.includes(t)
                    ? 'border-brand bg-gradient-to-br from-brand-light/35 to-brand/25 text-[#0f3d3a] shadow-[0_4px_14px_rgba(58,143,138,0.25)]'
                    : 'border-[rgba(58,143,138,0.2)] bg-white/70 text-[#3a4a49] hover:border-brand/50'
                "
                @click="toggleType(t)"
              >
                {{ t }}
              </button>
            </div>
            <p class="mt-2 text-[11px] text-[#5d6e6d]">未选择任何类型时，显示全部类型点位。</p>
          </section>

          <p class="rounded-xl border border-[rgba(58,143,138,0.1)] bg-white/60 px-3 py-2 text-[11px] leading-relaxed text-[#5d6e6d]">
            在地图上<strong>点击空白处</strong>，会在当前筛选结果里选中距离点击位置最近的点位，并<strong>自动播放</strong>该点位的方言音频片段（约 280 km 内有效）。
          </p>

          <div class="mt-auto flex flex-col gap-2">
            <button
              type="button"
              class="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#7ed4ce] via-brand to-[#2a726d] px-3 py-2.5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(26,92,88,0.28)] transition hover:brightness-[1.04] active:scale-[0.99]"
              @click="goMyLocation"
            >
              <span class="inline-block h-2 w-2 rounded-full bg-white/95 shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
              前往我的位置
            </button>
            <button
              type="button"
              class="rounded-xl border border-[rgba(58,143,138,0.35)] bg-white/85 px-3 py-2.5 text-sm font-medium text-[#1a5c58] transition hover:border-brand hover:bg-mist/80"
              @click="openRecordPanel"
            >
              上传方言录音
            </button>
          </div>
        </div>

        <div
          v-else
          class="flex flex-1 flex-col items-center gap-3 py-4 text-[10px] text-[#5d6e6d] [writing-mode:vertical-rl]"
        >
          侧栏已收起
        </div>
      </aside>

      <!-- 地图主区域 -->
      <main class="relative min-h-0 min-w-0 flex-1 bg-[#dfecea]">
        <div
          id="amap-container"
          ref="mapContainerRef"
          class="absolute inset-2 z-0 overflow-hidden rounded-2xl border border-[rgba(58,143,138,0.15)] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_32px_rgba(22,88,85,0.08)] sm:inset-3"
        />

        <div
          v-if="mapLoading"
          class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/35 backdrop-blur-[2px]"
        >
          <div
            class="flex items-center gap-3 rounded-2xl border border-[rgba(58,143,138,0.15)] bg-white/95 px-5 py-3 text-sm text-[#3a4a49] shadow-card"
          >
            <span
              class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent"
            />
            地图加载中…
          </div>
        </div>

        <!-- 右侧信息卡片 -->
        <transition name="slide-fade">
          <aside
            v-if="panelOpen && selectedPoint"
            class="absolute right-0 top-0 z-20 flex h-full w-full max-w-sm flex-col border-l border-[rgba(58,143,138,0.12)] bg-gradient-to-b from-white/98 via-white/95 to-mist/95 p-5 shadow-[-12px_0_40px_rgba(22,88,85,0.12)] backdrop-blur-md sm:w-96"
          >
            <div class="mb-4 flex items-start justify-between gap-2">
              <div>
                <div class="text-[11px] font-medium uppercase tracking-wider text-brand">点位详情</div>
                <h2 class="mt-1 text-lg font-semibold text-[#174a47]">{{ selectedPoint.area }}</h2>
              </div>
              <button
                type="button"
                class="rounded-full border border-[rgba(58,143,138,0.2)] p-1.5 text-[#5d6e6d] transition hover:border-brand hover:text-[#1a5c58]"
                aria-label="关闭"
                @click="closeDetailPanel"
              >
                ✕
              </button>
            </div>

            <div class="space-y-3 text-sm">
              <div class="rounded-xl border border-[rgba(58,143,138,0.12)] bg-white/90 p-3">
                <div class="text-[11px] text-[#5d6e6d]">方言片区</div>
                <div class="mt-1 text-[#152322]">{{ selectedPoint.dialect }}</div>
              </div>
              <div class="rounded-xl border border-[rgba(58,143,138,0.12)] bg-white/90 p-3">
                <div class="text-[11px] text-[#5d6e6d]">发言人昵称</div>
                <div class="mt-1 text-[#152322]">{{ selectedPoint.nickname }}</div>
              </div>
              <div class="rounded-xl border border-[rgba(58,143,138,0.12)] bg-white/90 p-3">
                <div class="text-[11px] text-[#5d6e6d]">内容类型</div>
                <div class="mt-1">
                  <span
                    class="inline-flex rounded-full border border-brand/35 bg-brand/10 px-2 py-0.5 text-xs text-[#1a5c58]"
                  >
                    {{ selectedPoint.type }}
                  </span>
                </div>
              </div>
              <div class="rounded-xl border border-[rgba(58,143,138,0.12)] bg-white/90 p-3">
                <div class="text-[11px] text-[#5d6e6d]">文字内容</div>
                <p class="mt-1 leading-relaxed text-[#2c3d3c]">{{ selectedPoint.content }}</p>
              </div>
              <div class="rounded-xl border border-[rgba(58,143,138,0.12)] bg-white/90 p-3">
                <div class="text-[11px] text-[#5d6e6d]">上传时间</div>
                <div class="mt-1 text-[#3a4a49]">{{ selectedPoint.time }}</div>
              </div>
            </div>

            <div class="mt-4 rounded-2xl border border-[rgba(58,143,138,0.18)] bg-mist/60 p-3 shadow-inner">
              <div class="mb-2 text-xs text-[#5d6e6d]">音频播放</div>
              <p class="mb-2 text-[11px] leading-snug text-[#7a8a89]">也可在地图上点击任意处，选中最近点位并播放。</p>
              <audio
                ref="detailAudioRef"
                class="w-full rounded-lg"
                controls
                :src="selectedPoint.audioUrl"
                @ended="onDetailAudioEnded"
              />
            </div>
          </aside>
        </transition>
      </main>

      <!-- 右下角悬浮：快速录音上传（抬高以免压住底栏） -->
      <button
        type="button"
        class="fixed bottom-[5.5rem] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7ed4ce] via-brand to-[#2a726d] text-2xl text-white shadow-[0_12px_36px_rgba(26,92,88,0.35)] ring-2 ring-white/50 transition hover:scale-105 active:scale-95 sm:right-6"
        title="快速录音上传"
        aria-label="快速录音上传"
        @click="openRecordPanel"
      >
        🎙
      </button>
    </div>

    <!-- 底栏：与主站 site-footer 一致 -->
    <footer
      class="relative z-30 shrink-0 border-t border-[rgba(58,143,138,0.07)] bg-gradient-to-b from-white/88 to-[rgba(248,252,251,0.92)] px-4 py-2 shadow-[0_-4px_24px_rgba(22,72,70,0.04)] backdrop-blur-[14px]"
    >
      <div
        class="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-2 gap-y-1 text-[0.88rem] text-[#5d6e6d]"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="inline-flex min-w-[6.75rem] rotate-[-2deg] items-center justify-center rounded-lg border-2 border-[#d14c4c] bg-white/75 px-3 py-1.5 text-[0.95rem] font-bold tracking-[0.12em] text-[#c23d3d] shadow-[0_4px_14px_rgba(194,61,61,0.1)]"
          >语韵东方</span>
          <span
            class="inline-flex min-w-[6.75rem] rotate-[1.5deg] items-center justify-center rounded-lg border border-dashed border-[rgba(58,143,138,0.42)] bg-white/55 px-3 py-1.5 text-[0.95rem] font-bold tracking-[0.08em] text-brand-deep"
          >方言数字化</span>
        </div>
        <nav class="flex flex-wrap gap-4">
          <a href="./index.html#top" class="text-[#5d6e6d] no-underline transition hover:text-brand-deep">首页</a>
          <a href="./index.html#features" class="text-[#5d6e6d] no-underline transition hover:text-brand-deep">功能</a>
          <a href="./index.html#vision" class="text-[#5d6e6d] no-underline transition hover:text-brand-deep">愿景</a>
        </nav>
      </div>
      <p class="mx-auto max-w-[1280px] px-4 pb-0.5 text-[0.68rem] leading-snug text-[#7a8a89]">
        © 2026 语韵东方 · 地方方言语音合成与交互体验设计。
      </p>
    </footer>

    <!-- 录音 / 上传面板 -->
    <teleport to="body">
      <div
        v-if="recordPanelOpen"
        class="upload-modal-backdrop fixed inset-0 z-[60] flex items-end justify-center bg-[#152322]/50 p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
        @click.self="closeRecordPanel"
      >
        <div
          class="upload-modal flex max-h-[min(92dvh,680px)] w-full max-w-xl flex-col overflow-hidden rounded-t-[1.35rem] border border-[rgba(58,143,138,0.14)] bg-white shadow-[0_24px_60px_rgba(22,88,85,0.18)] sm:max-w-2xl sm:rounded-[1.35rem]"
          @click.stop
        >
          <header class="flex shrink-0 items-start justify-between gap-3 border-b border-[rgba(58,143,138,0.1)] px-5 py-4">
            <div>
              <h3 id="upload-modal-title" class="text-lg font-semibold tracking-tight text-[#174a47]">上传乡音</h3>
              <p class="mt-0.5 text-xs leading-relaxed text-[#5d6e6d]">录一段方言原声，标注地区与类型后提交到地图</p>
            </div>
            <button
              type="button"
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#5d6e6d] transition hover:bg-mist/80 hover:text-[#174a47]"
              aria-label="关闭"
              @click="closeRecordPanel"
            >
              <span class="text-xl leading-none" aria-hidden="true">×</span>
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm text-[#152322]">
            <section class="mb-5">
              <h4 class="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[#1a5c58]">所在地区</h4>
              <div class="grid grid-cols-3 gap-2">
                <label class="block min-w-0">
                  <span class="mb-1 block text-[11px] text-[#5d6e6d]">省</span>
                  <select
                    v-model="uploadProvince"
                    class="upload-field w-full"
                    @change="onUploadProvinceChange"
                  >
                    <option value="">请选择</option>
                    <option v-for="p in regionTree" :key="'u-' + p.name" :value="p.name">{{ p.name }}</option>
                  </select>
                </label>
                <label class="block min-w-0">
                  <span class="mb-1 block text-[11px] text-[#5d6e6d]">市</span>
                  <select
                    v-model="uploadCity"
                    class="upload-field w-full"
                    :disabled="!uploadProvince"
                    @change="onUploadCityChange"
                  >
                    <option value="">请选择</option>
                    <option v-for="c in uploadCityOptions" :key="'u-' + c.name" :value="c.name">{{ c.name }}</option>
                  </select>
                </label>
                <label class="block min-w-0">
                  <span class="mb-1 block text-[11px] text-[#5d6e6d]">区县</span>
                  <select v-model="uploadDistrict" class="upload-field w-full" :disabled="!uploadCity">
                    <option value="">请选择</option>
                    <option v-for="d in uploadDistrictOptions" :key="'u-' + d" :value="d">{{ d }}</option>
                  </select>
                </label>
              </div>
              <p v-if="uploadAreaPreview" class="mt-2 text-xs text-brand-deep">
                将标记为：<span class="font-medium">{{ uploadAreaPreview }}</span>
              </p>
              <p v-else class="mt-2 text-xs text-rose-600">请完整选择省、市、区县后再提交</p>
            </section>

            <section class="mb-5 grid gap-3 sm:grid-cols-2">
              <label class="block sm:col-span-2">
                <span class="mb-1 block text-[11px] text-[#5d6e6d]">方言类型 / 片区</span>
                <input
                  v-model="uploadDialect"
                  type="text"
                  placeholder="例如：吴语·杭州小片"
                  class="upload-field w-full"
                />
              </label>
              <label class="block">
                <span class="mb-1 block text-[11px] text-[#5d6e6d]">内容类型</span>
                <select v-model="uploadContentType" class="upload-field w-full">
                  <option v-for="t in contentTypes" :key="'ut-' + t" :value="t">{{ t }}</option>
                </select>
              </label>
              <label class="block sm:col-span-2">
                <span class="mb-1 block text-[11px] text-[#5d6e6d]">文字说明（可选）</span>
                <textarea
                  v-model="uploadText"
                  rows="2"
                  class="upload-field w-full resize-none"
                  placeholder="唱词、释义、场景说明等"
                />
              </label>
            </section>

            <section
              class="rounded-2xl border border-[rgba(58,143,138,0.14)] bg-gradient-to-b from-mist/50 to-white p-4"
            >
              <div class="mb-3 flex items-center justify-between gap-2">
                <h4 class="text-xs font-semibold uppercase tracking-wider text-[#1a5c58]">录制音频</h4>
                <span
                  class="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  :class="
                    isRecording
                      ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/80'
                      : recordBlob
                        ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80'
                        : 'bg-white text-[#5d6e6d] ring-1 ring-[rgba(58,143,138,0.12)]'
                  "
                >
                  {{ recordStatusLabel }}
                </span>
              </div>

              <div class="flex flex-col items-center py-2">
                <button
                  type="button"
                  class="record-mic-btn relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  :class="isRecording ? 'record-mic-btn--active' : recordBlob ? 'record-mic-btn--done' : 'record-mic-btn--idle'"
                  :aria-label="isRecording ? '结束录音' : '开始录音'"
                  @click="toggleMainRecord"
                >
                  <svg
                    v-if="!isRecording"
                    class="h-7 w-7 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    aria-hidden="true"
                  >
                    <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
                    <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3M8 21h8" />
                  </svg>
                  <span v-else class="h-5 w-5 rounded-sm bg-white" aria-hidden="true" />
                </button>
                <p class="mt-3 text-center text-sm text-[#3a4a49]">
                  {{ isRecording ? '正在录音，点击按钮结束' : recordBlob ? '录音已就绪，可试听或重新录制' : '点击麦克风开始录制' }}
                </p>
                <p v-if="isRecording && recordDurationLabel" class="mt-1 font-mono text-xs tabular-nums text-rose-600">
                  {{ recordDurationLabel }}
                </p>
              </div>

              <div v-if="recordBlob && !isRecording" class="mt-1 flex justify-center gap-2 border-t border-[rgba(58,143,138,0.08)] pt-3">
                <button
                  type="button"
                  class="rounded-lg border border-[rgba(58,143,138,0.22)] bg-white px-4 py-2 text-xs font-medium text-[#1a5c58] transition hover:border-brand hover:bg-mist/60"
                  @click="togglePreviewPlayback"
                >
                  {{ previewPlaying ? '停止试听' : '播放试听' }}
                </button>
                <button
                  type="button"
                  class="rounded-lg px-4 py-2 text-xs text-[#5d6e6d] transition hover:bg-white/80 hover:text-[#174a47]"
                  @click="discardRecording"
                >
                  重新录制
                </button>
              </div>

              <p v-if="recordError" class="mt-3 text-center text-xs text-rose-600">{{ recordError }}</p>
              <audio v-show="false" ref="previewAudioRef" :src="previewUrl || undefined" @ended="previewPlaying = false" />
            </section>
          </div>

          <footer class="flex shrink-0 gap-3 border-t border-[rgba(58,143,138,0.1)] bg-white/95 px-5 py-4">
            <button
              type="button"
              class="rounded-xl border border-[rgba(58,143,138,0.22)] px-5 py-2.5 text-sm font-medium text-[#3a4a49] transition hover:border-brand hover:bg-mist/50"
              :disabled="uploading"
              @click="closeRecordPanel"
            >
              取消
            </button>
            <button
              type="button"
              class="flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-[#7ed4ce] via-brand to-[#2a726d] py-2.5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(26,92,88,0.25)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-45"
              :disabled="uploading || !recordBlob"
              @click="submitUpload"
            >
              {{ uploading ? '提交中…' : '提交到地图' }}
            </button>
          </footer>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { MAP_REGION_TREE, buildAreaString } from '../data/map-regions.js'

/** 高德 Key（可按需替换为环境变量） */
const AMAP_KEY = 'c7c2b7231fb6ed1d7ac88eb83c7d86c2'

const contentTypes = ['方言', '戏曲', '民谣', '童谣', '民俗']

/** 与侧栏筛选、上传表单共用（完整省市区） */
const regionTree = MAP_REGION_TREE

const sidebarCollapsed = ref(false)
const selProvince = ref('')
const selCity = ref('')
const selDistrict = ref('')
const selectedTypes = ref([])

const cityOptions = computed(() => {
  const p = regionTree.find((x) => x.name === selProvince.value)
  return p?.cities || []
})

const districtOptions = computed(() => {
  const c = cityOptions.value.find((x) => x.name === selCity.value)
  return c?.districts || []
})

function onProvinceChange() {
  selCity.value = ''
  selDistrict.value = ''
}
function onCityChange() {
  selDistrict.value = ''
}

const uploadProvince = ref('')
const uploadCity = ref('')
const uploadDistrict = ref('')
const uploadDialect = ref('')
const uploadContentType = ref('方言')
const uploadText = ref('')

const uploadCityOptions = computed(() => {
  const p = regionTree.find((x) => x.name === uploadProvince.value)
  return p?.cities || []
})
const uploadDistrictOptions = computed(() => {
  const c = uploadCityOptions.value.find((x) => x.name === uploadCity.value)
  return c?.districts || []
})
function onUploadProvinceChange() {
  uploadCity.value = ''
  uploadDistrict.value = ''
}
function onUploadCityChange() {
  uploadDistrict.value = ''
}

function toggleType(t) {
  const arr = [...selectedTypes.value]
  const i = arr.indexOf(t)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(t)
  selectedTypes.value = arr
}

const allPoints = ref([])
const pointsLoading = ref(false)
const mapLoading = ref(true)
const mapContainerRef = ref(null)
const mapInstance = shallowRef(null)
const markers = shallowRef([])

const panelOpen = ref(false)
const selectedPoint = ref(null)
const detailAudioRef = ref(null)

const recordPanelOpen = ref(false)
const isRecording = ref(false)
const recordBlob = ref(null)
const previewUrl = ref('')
const previewAudioRef = ref(null)
const previewPlaying = ref(false)
const recordError = ref('')
const uploading = ref(false)
const recordDurationSec = ref(0)

let mediaRecorder = null
let mediaChunks = []
let recordStream = null
let recordTimerId = null

const uploadAreaPreview = computed(() => {
  const p = uploadProvince.value
  const c = uploadCity.value
  const d = uploadDistrict.value
  if (p && c && d) return `${p} / ${c} / ${d}`
  if (p && c) return `${p} / ${c}`
  if (p) return p
  return ''
})

const recordStatusLabel = computed(() => {
  if (isRecording.value) return '录音中'
  if (recordBlob.value) return '已录制'
  return '待录制'
})

const recordDurationLabel = computed(() => {
  const s = recordDurationSec.value
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
})

const filteredPoints = computed(() => {
  const list = allPoints.value
  return list.filter((pt) => matchesRegion(pt) && matchesTypes(pt))
})

function buildAreaPrefix() {
  const p = selProvince.value
  const c = selCity.value
  const d = selDistrict.value
  if (!p) return ''
  if (p && c && d) return `${p}/${c}/${d}`
  if (p && c) return `${p}/${c}/`
  if (p) return `${p}/`
  return ''
}

function matchesRegion(pt) {
  const prefix = buildAreaPrefix()
  if (!prefix) return true
  const area = pt.area || ''
  if (selDistrict.value) return area === `${selProvince.value}/${selCity.value}/${selDistrict.value}`
  if (selCity.value) return area.startsWith(`${selProvince.value}/${selCity.value}/`)
  return area.startsWith(`${selProvince.value}/`)
}

function matchesTypes(pt) {
  if (!selectedTypes.value.length) return true
  return selectedTypes.value.includes(pt.type)
}

/** 球面距离（米），用于「点击地图 → 找最近点位」 */
function haversineMeters(lng1, lat1, lng2, lat2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function readEventLngLat(e) {
  const ll = e?.lnglat
  if (!ll) return null
  if (typeof ll.getLng === 'function' && typeof ll.getLat === 'function') {
    return { lng: ll.getLng(), lat: ll.getLat() }
  }
  if (typeof ll.lng === 'number' && typeof ll.lat === 'number') {
    return { lng: ll.lng, lat: ll.lat }
  }
  return null
}

/** 点击地图空白处时：只接受该距离内的最近点位，避免全国尺度误匹配 */
const MAP_CLICK_PLAY_MAX_M = 280_000

function findNearestFilteredPoint(lng, lat) {
  const list = filteredPoints.value
  let best = null
  let bestM = Infinity
  for (const pt of list) {
    const loc = pt.location || {}
    const plng = loc.lng
    const plat = loc.lat
    if (typeof plng !== 'number' || typeof plat !== 'number') continue
    const m = haversineMeters(lng, lat, plng, plat)
    if (m < bestM) {
      bestM = m
      best = pt
    }
  }
  if (!best || bestM > MAP_CLICK_PLAY_MAX_M) return null
  return best
}

function onAuthClick() {
  window.alert('登录 / 注册流程可在此对接统一认证。')
}

async function fetchMapPoints() {
  pointsLoading.value = true
  try {
    const res = await fetch('/api/map/points')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const data = Array.isArray(json) ? json : json.data
    if (!Array.isArray(data)) throw new Error('点位数据格式错误')
    allPoints.value = data
  } catch (e) {
    console.error(e)
    window.alert('获取地图点位失败，请检查后端 GET /api/map/points 是否可用。')
  } finally {
    pointsLoading.value = false
  }
}

function loadAmapScript() {
  if (window.AMap) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const cbName = `__amap_cb_${Date.now()}`
    window[cbName] = () => {
      resolve()
      delete window[cbName]
    }
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.Scale,AMap.ToolBar,AMap.Geolocation&callback=${cbName}`
    script.onerror = () => reject(new Error('高德地图脚本加载失败'))
    document.head.appendChild(script)
  })
}

function clearMarkers() {
  const m = markers.value
  if (m?.length && mapInstance.value) {
    mapInstance.value.remove(m)
  }
  markers.value = []
}

function renderMarkers() {
  const map = mapInstance.value
  if (!map || !window.AMap) return
  clearMarkers()
  const list = filteredPoints.value
  const ms = []
  for (const pt of list) {
    const { lng, lat } = pt.location || {}
    if (typeof lng !== 'number' || typeof lat !== 'number') continue
    const marker = new window.AMap.Marker({
      position: [lng, lat],
      title: pt.area,
      extData: pt
    })
    marker.setMap(map)
    marker.on('click', () => onMarkerClicked(pt))
    ms.push(marker)
  }
  markers.value = ms
}

function playPointAudio(pt) {
  if (!pt?.audioUrl) return
  void nextTick(() => {
    const el = detailAudioRef.value
    if (!el) return
    el.pause()
    el.currentTime = 0
    el.src = pt.audioUrl
    const p = el.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
  })
}

function onMarkerClicked(pt) {
  selectedPoint.value = pt
  panelOpen.value = true
  playPointAudio(pt)
}

/** 上传成功后：同步侧栏筛选、地图定位到新标点并播放 */
function focusUploadedPoint(point) {
  if (!point?.location) return
  const parts = String(point.area || '').split('/')
  if (parts[0]) {
    selProvince.value = parts[0]
    selCity.value = parts[1] || ''
    selDistrict.value = parts[2] || ''
  }
  if (point.type && !selectedTypes.value.includes(point.type)) {
    selectedTypes.value = []
  }
  renderMarkers()
  const map = mapInstance.value
  const { lng, lat } = point.location
  if (map && typeof lng === 'number' && typeof lat === 'number') {
    map.setZoomAndCenter(11, [lng, lat], true)
  }
  onMarkerClicked(point)
}

function closeDetailPanel() {
  panelOpen.value = false
  const el = detailAudioRef.value
  if (el) {
    el.pause()
    el.currentTime = 0
  }
}

function onDetailAudioEnded() {
  /* 预留：例如自动连播 */
}

function goMyLocation() {
  const map = mapInstance.value
  if (!map || !window.AMap) return
  map.plugin('AMap.Geolocation', () => {
    const geo = new window.AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 12000,
      zoomToAccuracy: true,
      needAddress: false
    })
    geo.getCurrentPosition()
    const AMap = window.AMap
    const onComplete = (e) => {
      const pos = e?.position
      let lng
      let lat
      if (pos && typeof pos.getLng === 'function') {
        lng = pos.getLng()
        lat = pos.getLat()
      } else if (pos && typeof pos.lng === 'number') {
        lng = pos.lng
        lat = pos.lat
      }
      if (lng != null && lat != null) {
        map.setZoomAndCenter(14, [lng, lat], true)
      }
      AMap.Event?.removeListener?.(completeHandle)
      AMap.Event?.removeListener?.(errorHandle)
    }
    const onError = () => {
      window.alert('定位失败，请检查浏览器定位权限或稍后重试。')
      AMap.Event?.removeListener?.(completeHandle)
      AMap.Event?.removeListener?.(errorHandle)
    }
    const completeHandle = AMap.Event.addListener(geo, 'complete', onComplete)
    const errorHandle = AMap.Event.addListener(geo, 'error', onError)
  })
}

async function initMap() {
  mapLoading.value = true
  try {
    await loadAmapScript()
    await nextTick()
    const el = mapContainerRef.value
    if (!el) return
    const map = new window.AMap.Map(el, {
      zoom: 5,
      center: [108.55, 34.32],
      viewMode: '2D',
      /** 清新浅绿系底图，与主站青玉色更协调（可改为 normal / macaron 等） */
      mapStyle: 'amap://styles/fresh'
    })
    map.addControl(new window.AMap.Scale())
    map.addControl(new window.AMap.ToolBar({ position: { right: 12, top: 110 } }))
    map.on('click', (e) => {
      const pos = readEventLngLat(e)
      if (!pos) return
      const nearest = findNearestFilteredPoint(pos.lng, pos.lat)
      if (nearest) onMarkerClicked(nearest)
    })
    mapInstance.value = map
    renderMarkers()
  } catch (e) {
    console.error(e)
    window.alert('地图初始化失败，请检查 Key 与网络，或配置安全密钥 securityJsCode。')
  } finally {
    mapLoading.value = false
  }
}

watch(filteredPoints, () => {
  renderMarkers()
})

function pickMimeType() {
  if (!window.MediaRecorder) return ''
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  return ''
}

function revokePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
}

function clearRecordTimer() {
  if (recordTimerId != null) {
    window.clearInterval(recordTimerId)
    recordTimerId = null
  }
  recordDurationSec.value = 0
}

function discardRecording() {
  if (isRecording.value) stopRecording()
  revokePreview()
  recordBlob.value = null
  previewPlaying.value = false
  recordError.value = ''
  clearRecordTimer()
}

function toggleMainRecord() {
  if (isRecording.value) {
    stopRecording()
    return
  }
  startRecording()
}

async function startRecording() {
  recordError.value = ''
  revokePreview()
  recordBlob.value = null
  previewPlaying.value = false
  clearRecordTimer()
  if (!navigator.mediaDevices?.getUserMedia) {
    recordError.value = '当前浏览器不支持录音。'
    return
  }
  try {
    recordStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaChunks = []
    const mime = pickMimeType()
    mediaRecorder = mime ? new MediaRecorder(recordStream, { mimeType: mime }) : new MediaRecorder(recordStream)
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) mediaChunks.push(e.data)
    }
    mediaRecorder.onerror = (ev) => {
      recordError.value = (ev.error && ev.error.message) || '录音过程出错'
    }
    mediaRecorder.onstop = () => {
      const blob = new Blob(mediaChunks, { type: mediaRecorder.mimeType || 'audio/webm' })
      recordBlob.value = blob
      revokePreview()
      previewUrl.value = URL.createObjectURL(blob)
      if (recordStream) {
        recordStream.getTracks().forEach((t) => t.stop())
        recordStream = null
      }
    }
    mediaRecorder.start()
    isRecording.value = true
    recordDurationSec.value = 0
    recordTimerId = window.setInterval(() => {
      recordDurationSec.value += 1
    }, 1000)
  } catch (e) {
    console.error(e)
    recordError.value = '无法访问麦克风，请授予权限后重试。'
    clearRecordTimer()
  }
}

function stopRecording() {
  clearRecordTimer()
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    isRecording.value = false
    return
  }
  mediaRecorder.stop()
  isRecording.value = false
}

function togglePreviewPlayback() {
  const a = previewAudioRef.value
  if (!a || !previewUrl.value) return
  if (previewPlaying.value) {
    a.pause()
    previewPlaying.value = false
  } else {
    a.currentTime = 0
    const p = a.play()
    if (p && typeof p.catch === 'function') p.catch(() => {})
    previewPlaying.value = true
  }
}

function openRecordPanel() {
  syncUploadRegionFromFilter()
  recordPanelOpen.value = true
}

function closeRecordPanel() {
  recordPanelOpen.value = false
  if (isRecording.value) stopRecording()
  previewPlaying.value = false
  const a = previewAudioRef.value
  if (a) a.pause()
}

function syncUploadRegionFromFilter() {
  uploadProvince.value = selProvince.value || uploadProvince.value
  uploadCity.value = selCity.value || uploadCity.value
  uploadDistrict.value = selDistrict.value || uploadDistrict.value
}

async function submitUpload() {
  if (!recordBlob.value) {
    window.alert('请先完成录音。')
    return
  }
  if (!uploadProvince.value || !uploadCity.value || !uploadDistrict.value) {
    window.alert('请完整选择省、市、区县。')
    return
  }
  if (!uploadDialect.value.trim()) {
    window.alert('请填写方言类型 / 片区。')
    return
  }
  const area = buildAreaString(uploadProvince.value, uploadCity.value, uploadDistrict.value)
  const fd = new FormData()
  const ext = recordBlob.value.type.includes('webm') ? 'webm' : recordBlob.value.type.includes('mp4') ? 'm4a' : 'dat'
  fd.append('file', recordBlob.value, `dialect-${Date.now()}.${ext}`)
  fd.append('area', area)
  fd.append('dialect', uploadDialect.value.trim())
  fd.append('type', uploadContentType.value)
  fd.append('content', uploadText.value.trim())
  fd.append('nickname', '我')
  uploading.value = true
  try {
    const res = await fetch('/api/map/upload', { method: 'POST', body: fd })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || (json.code !== undefined && json.code !== 0)) {
      throw new Error(json.message || `上传失败（${res.status}）`)
    }
    const newPoint = json.data?.point
    closeRecordPanel()
    revokePreview()
    recordBlob.value = null
    await fetchMapPoints()
    const point =
      newPoint ||
      allPoints.value.find((p) => p.id === json.data?.id) ||
      allPoints.value[allPoints.value.length - 1]
    if (point) {
      focusUploadedPoint(point)
    } else {
      renderMarkers()
    }
  } catch (e) {
    console.error(e)
    window.alert(e.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchMapPoints(), initMap()])
})

onBeforeUnmount(() => {
  clearMarkers()
  if (mapInstance.value) {
    mapInstance.value.destroy()
    mapInstance.value = null
  }
  clearRecordTimer()
  revokePreview()
  if (recordStream) {
    recordStream.getTracks().forEach((t) => t.stop())
    recordStream = null
  }
})
</script>

<style scoped>
.upload-field {
  border-radius: 0.75rem;
  border: 1px solid rgba(58, 143, 138, 0.2);
  background: rgba(255, 255, 255, 0.95);
  padding: 0.5rem 0.75rem;
  color: #152322;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.upload-field:focus {
  border-color: #3a8f8a;
  box-shadow: 0 0 0 3px rgba(58, 143, 138, 0.18);
}

.upload-field:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.upload-field::placeholder {
  color: #7a8a89;
}

.record-mic-btn--idle {
  background: linear-gradient(145deg, #7ed4ce 0%, #3a8f8a 55%, #2a726d 100%);
  box-shadow: 0 10px 28px rgba(26, 92, 88, 0.32);
}

.record-mic-btn--idle:hover {
  filter: brightness(1.05);
}

.record-mic-btn--active {
  background: linear-gradient(145deg, #f87171 0%, #e11d48 100%);
  box-shadow: 0 0 0 6px rgba(244, 63, 94, 0.2), 0 10px 28px rgba(225, 29, 72, 0.35);
  animation: record-pulse 1.4s ease-in-out infinite;
}

.record-mic-btn--done {
  background: linear-gradient(145deg, #6ee7b7 0%, #3a8f8a 100%);
  box-shadow: 0 8px 22px rgba(58, 143, 138, 0.28);
}

@keyframes record-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.04);
  }
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: transform 0.28s ease, opacity 0.28s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
.slide-fade-enter-to,
.slide-fade-leave-from {
  transform: translateX(0);
  opacity: 1;
}
</style>
