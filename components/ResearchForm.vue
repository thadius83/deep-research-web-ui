<script setup lang="ts">
  export interface ResearchInputData {
    query: string
    breadth: number
    depth: number
    numQuestions: number
  }

  defineProps<{
    isLoadingFeedback: boolean
  }>()

  const emit = defineEmits<{
    (e: 'submit', value: ResearchInputData): void
  }>()

  const form = reactive({
    query: '',
    breadth: 2,
    depth: 2,
    numQuestions: 3,
  })

  const store = useConfigStore()

  const configManager = inject<{ show: () => void }>('configManager')

  // Updated key checks: return a valid key if it is a nonempty string
  const hasAiKey = computed(() => {
    const key = store.getActualApiKey('ai')
    return typeof key === 'string' && key.length > 0
  })
  const hasWebSearchKey = computed(() => {
    const key = store.getActualApiKey('webSearch')
    return typeof key === 'string' && key.length > 0
  })
  const hasConfig = computed(() => hasAiKey.value && hasWebSearchKey.value)

  // Check that all form fields are set
  const hasFormValues = computed(() =>
    form.query && form.breadth && form.depth && form.numQuestions
  )

  const isSubmitButtonDisabled = computed(
    () => !hasFormValues.value || !hasConfig.value
  )

  watch([hasAiKey, hasWebSearchKey, hasFormValues], () => {
    console.log('Form state:', {
      hasFormValues: hasFormValues.value,
      hasAiKey: hasAiKey.value,
      hasWebSearchKey: hasWebSearchKey.value
    })
  }, { immediate: true })

  function handleSubmit() {
    emit('submit', { ...form })
  }

  defineExpose({
    form,
  })
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-bold">1. Research Topic</h2>
    </template>
    <div class="flex flex-col gap-2">
      <UFormField label="Research Topic" required>
        <UTextarea
          class="w-full"
          v-model="form.query"
          :rows="3"
          placeholder="Enter whatever you want to research..."
          required
        />
      </UFormField>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <UFormField label="Number of Questions" required>
          <template #help> Number of clarifying questions to refine the research scope. </template>
          <UInput
            v-model="form.numQuestions"
            class="w-full"
            type="number"
            :min="1"
            :max="5"
            :step="1"
          />
        </UFormField>

        <UFormField label="Depth" required>
          <template #help> Determines how many levels deep the research will explore. </template>
          <UInput
            v-model="form.depth"
            class="w-full"
            type="number"
            :min="1"
            :max="5"
            :step="1"
          />
        </UFormField>

        <UFormField label="Breadth" required>
          <template #help> Number of parallel research paths at each depth level. </template>
          <UInput
            v-model="form.breadth"
            class="w-full"
            type="number"
            :min="1"
            :max="5"
            :step="1"
          />
        </UFormField>
      </div>
    </div>

    <template #footer>
      <div class="space-y-2">
        <div v-if="!hasConfig" class="text-sm text-red-500 text-center">
          Please configure API keys in
          <UButton
            variant="link"
            class="!p-0"
            @click="configManager?.show()"
          >
            settings
          </UButton>
          before starting research.
        </div>
        <UButton
          type="submit"
          color="primary"
          :loading="isLoadingFeedback"
          :disabled="isSubmitButtonDisabled"
          block
          @click="handleSubmit"
        >
          {{ isLoadingFeedback ? 'Researching...' : 'Start Research' }}
        </UButton>
      </div>
    </template>
  </UCard>
</template>
