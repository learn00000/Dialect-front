<template>
  <DialectLiveDatabase v-if="isDatabasePage" />
  <DialectPanoramaMap v-else-if="isMapPage" />
  <DialectStageAdventure v-else />
</template>

<script setup>
import { computed } from 'vue'
import DialectLiveDatabase from './components/DialectLiveDatabase.vue'
import DialectPanoramaMap from './components/DialectPanoramaMap.vue'
import DialectStageAdventure from './components/DialectStageAdventure.vue'

const isDatabasePage = computed(() => {
  const path = window.location.pathname.toLowerCase()
  return path.endsWith('/database.html') || path.endsWith('database.html')
})

const isMapPage = computed(() => {
  const path = window.location.pathname.toLowerCase()
  return path.endsWith('/map.html') || path.endsWith('map.html')
})
</script>
