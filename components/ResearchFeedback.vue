<script setup lang="ts">
  import { generateFeedback } from '~/lib/feedback'

  export interface ResearchFeedbackResult {
    assistantQuestion: string
    userAnswer: string
  }

  const props = defineProps<{
    isLoadingSearch?: boolean
  }>()

  const emit = defineEmits<{
    (e: 'submit', feedback: ResearchFeedbackResult[]): void
  }>()

  const feedback = ref<ResearchFeedbackResult[]>([])

  const isLoading = ref(false)
  const error = ref('')

  const isSubmitButtonDisabled = computed(() => {
    // If there are feedback items, ensure they're all answered
    if (feedback.value.length > 0) {
      return feedback.value.some((v) => !v.assistantQuestion || !v.userAnswer) ||
        isLoading.value ||
        props.isLoadingSearch;
    }
    // If no feedback items, only check loading states
    return isLoading.value || props.isLoadingSearch;
  })

  async function getFeedback(query: string, numQuestions = 3) {
    clear()
    isLoading.value = true
    try {
      // If numQuestions is 0, proceed directly with research
      if (numQuestions === 0) {
        emit('submit', [])
        return
      }

      for await (const f of generateFeedback({
        query,
        numQuestions,
      })) {
        const questions = f.questions!.filter((s) => typeof s === 'string')
        // Incrementally update modelValue
        for (let i = 0; i < questions.length; i += 1) {
          if (feedback.value[i]) {
            feedback.value[i].assistantQuestion = questions[i]
          } else {
            feedback.value.push({
              assistantQuestion: questions[i],
              userAnswer: '',
            })
          }
        }
      }
    } catch (e: any) {
      console.error('Error getting feedback:', e)
      error.value = e.message
    } finally {
      isLoading.value = false
    }
  }

  function clear() {
    feedback.value = []
    error.value = ''
  }

  defineExpose({
    getFeedback,
    clear,
    isLoading,
  })
</script>

<template>
  <UCard id="model-feedback">
    <template #header>
      <h2 class="font-bold">2. Model Feedback</h2>
      <p class="text-sm text-gray-500">
        {{ feedback.length > 0 
          ? 'The AI will ask follow-up questions to help clarify and refine your research direction.'
          : 'Ready to proceed with research.' }}
      </p>
    </template>

    <div class="flex flex-col gap-2">
      <p v-if="error" class="text-red-500">{{ error }}</p>
      <div v-if="!feedback.length && !error">
        {{ isLoading ? 'Waiting for model feedback...' : 'Ready to proceed with research' }}
      </div>
      <template v-else>
        <div v-if="error" class="text-red-500">{{ error }}</div>
        <div
          v-for="(feedback, index) in feedback"
          class="flex flex-col gap-2"
          :key="index"
        >
          Assistant: {{ feedback.assistantQuestion }}
          <UInput v-model="feedback.userAnswer" />
        </div>
      </template>
      <UButton
        color="primary"
        :loading="isLoadingSearch || isLoading"
        :disabled="isSubmitButtonDisabled"
        block
        @click="$emit('submit', feedback)"
      >
        {{ feedback.length ? 'Submit Answer' : 'Start Research' }}
      </UButton>
    </div>
  </UCard>
</template>
