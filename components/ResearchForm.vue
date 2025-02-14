<script setup lang="ts">
  export interface ResearchInputData {
    query: string
    breadth: number
    depth: number
    numQuestions: number
    methodId: string
  }

  defineProps<{
    isLoadingFeedback: boolean
  }>()

  const emit = defineEmits<{
    (e: 'submit', value: ResearchInputData): void
  }>()

  const { selectedMethodId } = useResearchMethod();

  const defaultValues = {
    query: '',
    breadth: 2,
    depth: 2,
    numQuestions: 3,
  };

  const form = reactive({
    ...defaultValues,
    get methodId() {
      return selectedMethodId.value;
    },
    set methodId(value: string) {
      selectedMethodId.value = value;
    }
  });

  const store = useConfigStore()
  const runtimeConfig = useRuntimeConfig()

  const configManager = inject<{ show: () => void }>('configManager')

  // Check for API keys in both environment and user config
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
    form.query && form.breadth && form.depth && form.numQuestions && form.methodId
  )

  const isSubmitButtonDisabled = computed(
    () => !hasFormValues.value || !hasConfig.value
  )

  watch([hasAiKey, hasWebSearchKey, hasFormValues], () => {
    if (process.dev) {
      console.log('Form state:', {
        hasFormValues: hasFormValues.value,
        hasAiKey: hasAiKey.value,
        hasWebSearchKey: hasWebSearchKey.value,
        envAiKey: !!runtimeConfig.public.openaiKey,
        envSearchKey: store.config.webSearch.provider === 'tavily' 
          ? !!runtimeConfig.public.tavilyKey 
          : !!runtimeConfig.public.firecrawlKey
      })
    }
  }, { immediate: true })

  function handleSubmit() {
    emit('submit', {
      ...form,
      methodId: form.methodId // Ensure we get the current value
    })
    // Scroll to feedback section after a short delay
    setTimeout(() => {
      const feedbackElement = document.querySelector('#model-feedback')
      if (feedbackElement) {
        feedbackElement.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        })
      }
    }, 500)
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
      <ResearchMethodSelector />
      
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
          <template #help> Number of clarifying questions to refine the research scope (0 for direct research). </template>
          <UInput
            v-model="form.numQuestions"
            class="w-full"
            type="number"
            :min="0"
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
