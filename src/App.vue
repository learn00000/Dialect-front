<template>
  <DialectPanoramaMap v-if="isMapPage" />
  <DialectStageAdventure v-else />
</template>

<script setup>
import { computed } from 'vue'
import DialectPanoramaMap from './components/DialectPanoramaMap.vue'
import DialectStageAdventure from './components/DialectStageAdventure.vue'

const isMapPage = computed(() => {
  const path = window.location.pathname.toLowerCase()
  return path.endsWith('/map.html') || path.endsWith('map.html')
})
</script>
