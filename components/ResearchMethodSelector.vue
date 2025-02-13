<template>
  <div class="flex flex-col gap-2">
    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
      Research Method
    </label>
    <div class="space-y-2">
      <div v-if="error" class="text-sm text-red-500 mb-2">
        {{ error }}
      </div>
      
      <div v-if="isDev" class="text-xs text-gray-500 mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
        <div>Selected ID: {{ selectedMethodId }}</div>
        <div>Available Methods: {{ availableMethods?.length || 0 }}</div>
        <div>Options: {{ methodOptions?.length || 0 }}</div>
      </div>
      
      <USelect
        v-model="selectedMethodId"
        :items="methodOptions"
        item-text="label"
        item-value="value"
        placeholder="Select a research method"
        :loading="false"
        :disabled="false"
      >
        <template #option="{ item }">
          <div class="flex flex-col gap-1">
            <span class="font-medium">{{ item.label }}</span>
            <span v-if="item.description" class="text-sm text-gray-500 dark:text-gray-400">
              {{ item.description }}
            </span>
          </div>
        </template>
        <template #empty>
          <div class="p-2 text-sm text-gray-500 dark:text-gray-400">
            No research methods available
          </div>
        </template>
      </USelect>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useResearchMethod } from '~/composables/useResearchMethod';
import { useRuntimeConfig } from '#app';

const config = useRuntimeConfig();
const isDev = computed(() => config.public.dev || process.env.NODE_ENV === 'development');

const { selectedMethodId, availableMethods } = useResearchMethod();

const methodOptions = computed(() => 
  availableMethods.value.map(method => ({
    label: method.name,
    value: method.id,
    description: method.description
  }))
);

const emit = defineEmits<{
  (e: 'method-change', methodId: string): void
}>();

watch(selectedMethodId, (newId) => {
  if (newId) {
    emit('method-change', newId);
  }
});

const isLoading = computed(() => !availableMethods.value?.length);
const error = ref<string | null>(null);

watch([availableMethods, methodOptions], ([methods, options]) => {
  if (!methods?.length) {
    error.value = 'No research methods available';
  } else if (!options?.length) {
    error.value = 'Error loading research methods';
  } else {
    error.value = null;
  }
}, { immediate: true });
</script>
