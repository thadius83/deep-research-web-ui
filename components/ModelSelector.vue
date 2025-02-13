<template>
  <UFormField label="AI Model">
    <UInputMenu
      v-model="selectedModel"
      :items="modelOptions"
      placeholder="Enter or choose an AI model"
      create-item
      @create="onCreate"
      class="w-full"
    />
  </UFormField>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { listAvailableModels } from '~/composables/useAiProvider'
import { useConfigStore } from '@/stores/config'

const store = useConfigStore()

// Bind the field to the existing model config.
// This field is editable so that the user can change it manually if desired.
const selectedModel = ref(store.config.ai.model)
const modelOptions = ref([])

onMounted(async () => {
  const models = await listAvailableModels()
  // Map the returned models array for use with UInputMenu.
  // Each option contains both a label and value.
  modelOptions.value = models.map((model: any) => ({
    label: model.id,
    value: model.id,
  }))
  console.log('Model options populated:', modelOptions.value)
})

// When the selected model changes, update the config store.
// If newModel is an object (from UInputMenu), extract its value property.
watch(selectedModel, (newModel) => {
  if (typeof newModel === 'object' && newModel !== null) {
    store.config.ai.model = newModel.value
  } else {
    store.config.ai.model = newModel
  }
})

// When the user types in a new model that isn't in the list,
// add that model as an option and update the field.
function onCreate(newValue: string) {
  modelOptions.value.push({ label: newValue, value: newValue })
  selectedModel.value = newValue
}
</script>

<style scoped>
/* 
  Using the new :deep() syntax to target the dropdown container inside UInputMenu.
  Adjust the selector if your UInputMenu uses a different class than `.u-input-menu__dropdown`.
*/
:deep(.u-input-menu__dropdown) {
  max-height: 300px; /* Limit height to trigger vertical scrolling */
  overflow-y: auto;  /* Allow vertical scroll (native arrows on most systems) */
}

/* Custom scrollbar styling for WebKit browsers (optional) */
:deep(.u-input-menu__dropdown::-webkit-scrollbar) {
  width: 10px;
}
:deep(.u-input-menu__dropdown::-webkit-scrollbar-track) {
  background: #f1f1f1;
}
:deep(.u-input-menu__dropdown::-webkit-scrollbar-thumb) {
  background: #888;
  border-radius: 4px;
}
:deep(.u-input-menu__dropdown::-webkit-scrollbar-thumb:hover) {
  background: #555;
}
</style> 