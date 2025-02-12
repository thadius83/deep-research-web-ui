<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
  import { provide } from 'vue'

  // Provide a stub for configManager; the real one will be inserted in index.vue
  provide('configManager', {
    show: () => {
      console.warn('ConfigManager not available in app.vue')
    }
  })

  useHead({
    title: 'Deep Research Web UI',
  })
</script>
