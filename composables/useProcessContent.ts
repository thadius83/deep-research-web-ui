export function useProcessContent() {
  const config = useRuntimeConfig()

  async function processContent({
    query,
    content,
    template,
    systemPrompt,
    sources,
    learnings,
  }: {
    query: string
    content: string
    template: string
    systemPrompt?: string
    sources?: any[]
    learnings?: string[]
  }): Promise<string> {
    try {
      const { response } = await $fetch('/api/process-content', {
        method: 'POST',
        body: {
          query,
          content,
          template,
          systemPrompt,
          sources,
          learnings,
        },
      })
      return response
    } catch (error) {
      console.error('Content processing error:', error)
      throw error
    }
  }

  return {
    processContent,
  }
}
