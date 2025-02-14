<template>
  <div class="flex flex-col gap-2">
    <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
      Research Method
    </label>
    <div class="space-y-2">
      <div v-if="error" class="text-sm text-red-500 mb-2">
        {{ error }}
      </div>
      
      <USelect
        v-model="selectedMethodId"
        :items="methodOptions"
        item-text="label"
        item-value="value"
        placeholder="Select a research method"
        :loading="isLoading"
        :disabled="isLoading"
        class="min-w-[400px]"
        :ui="{
          select: {
            base: 'relative block',
            width: 'min-w-[400px] w-full',
            container: 'min-w-[400px]',
            button: 'min-w-[400px] w-full',
            popper: 'min-w-[400px]'
          },
          option: {
            base: 'relative flex items-start gap-2 p-2 cursor-pointer min-w-[400px]',
            selected: 'bg-gray-100 dark:bg-gray-800',
            active: 'bg-gray-50 dark:bg-gray-900',
            inactive: 'opacity-50 cursor-not-allowed'
          }
        }"
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

const { selectedMethodId, availableMethods } = useResearchMethod();

if (process.dev) {
  console.group('ResearchMethodSelector');
  console.log('Initial state:', {
    selectedId: selectedMethodId.value,
    availableMethods: availableMethods.value?.map(m => ({
      id: m.id,
      name: m.name
    }))
  });
  console.groupEnd();
}

const methodOptions = computed(() => {
  const options = availableMethods.value.map(method => ({
    label: method.name,
    value: method.id,
    description: method.description
  }));

  if (process.dev) {
    console.group('ResearchMethodSelector - Options Update');
    console.log('Method options:', options);
    console.groupEnd();
  }

  return options;
});

const emit = defineEmits<{
  (e: 'method-change', methodId: string): void
}>();

watch(selectedMethodId, (newId) => {
  if (newId) {
    if (process.dev) {
      console.log('ResearchMethodSelector - Method changed:', newId);
    }
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
