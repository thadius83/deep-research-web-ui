<template>
  <div>
    <UContainer>
      <div class="max-w-4xl mx-auto py-8 flex flex-col gap-y-4">
        <div class="flex flex-col sm:flex-row gap-2">
          <h1 class="text-3xl font-bold text-center mb-2">
            Deep Research Assistant
          </h1>
          <div class="mx-auto sm:ml-auto sm:mr-0 flex items-center gap-2">
            <GitHubButton />
            <ColorModeButton />
            <ConfigManager />
          </div>
        </div>

        <div>
          This is an enhanced web UI fork of
          <ULink target="_blank" href="https://github.com/dzhng/deep-research">
            dzhng/deep-research
          </ULink>
          . It features streaming AI responses, tree visualization, and secure API key handling - keys are automatically protected when endpoints change.
        </div>

        <ResearchForm
          :is-loading-feedback="!!feedbackRef?.isLoading"
          ref="formRef"
          @submit="generateFeedback"
        />
        <ResearchFeedback
          :is-loading-search="!!deepResearchRef?.isLoading"
          ref="feedbackRef"
          @submit="startDeepSearch"
        />
        <DeepResearch ref="deepResearchRef" @complete="generateReport" />
        <ResearchReport ref="reportRef" />
      </div>
    </UContainer>
  </div>
</template>

<script setup lang="ts">
  import type ResearchForm from '~/components/ResearchForm.vue'
  import type ResearchFeedback from '~/components/ResearchFeedback.vue'
  import type DeepResearch from '~/components/DeepResearch.vue'
  import type ResearchReport from '~/components/ResearchReport.vue'
  import type { ResearchInputData } from '~/components/ResearchForm.vue'
  import type { ResearchFeedbackResult } from '~/components/ResearchFeedback.vue'
  import type { ResearchResult } from '~/lib/deep-research'
  import ConfigManager from '~/components/ConfigManager.vue'

  const config = useConfigStore()
  const toast = useToast()

  const formRef = ref<InstanceType<typeof ResearchForm>>()
  const feedbackRef = ref<InstanceType<typeof ResearchFeedback>>()
  const deepResearchRef = ref<InstanceType<typeof DeepResearch>>()
  const reportRef = ref<InstanceType<typeof ResearchReport>>()

  const feedback = ref<ResearchFeedbackResult[]>([])
  const researchResult = ref<ResearchResult>()

  function getCombinedQuery() {
    return `Initial Query: ${formRef.value?.form.query}
Follow-up Questions and Answers:
${feedback.value
  .map((qa) => `Q: ${qa.assistantQuestion}\nA: ${qa.userAnswer}`)
  .join('\n')}
    `
  }

  async function generateFeedback(data: ResearchInputData) {
    feedbackRef.value?.getFeedback(data.query, data.numQuestions)
  }

  async function startDeepSearch(_feedback: ResearchFeedbackResult[]) {
    if (
      !formRef.value?.form.query ||
      !formRef.value?.form.breadth ||
      !formRef.value?.form.depth
    )
      return
    feedback.value = _feedback
    deepResearchRef.value?.startResearch(
      getCombinedQuery(),
      formRef.value.form.breadth,
      formRef.value.form.depth,
    )
  }

  async function generateReport(_researchResult: ResearchResult) {
    researchResult.value = _researchResult
    reportRef.value?.generateReport({
      prompt: getCombinedQuery(),
      learnings: researchResult.value?.learnings ?? [],
      visitedUrls: researchResult.value?.visitedUrls ?? [],
    })
  }
</script>
