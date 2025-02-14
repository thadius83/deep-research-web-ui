export function useClassify() {
  const config = useRuntimeConfig()

  async function classify({
    query,
    content,
    template,
    systemPrompt,
  }: {
    query: string
    content?: string
    template: string
    systemPrompt?: string
  }): Promise<string> {
    try {
      const { response } = await $fetch('/api/classify', {
        method: 'POST',
        body: {
          query,
          content,
          template,
          systemPrompt,
        },
      })
      return response
    } catch (error) {
      console.error('Classification error:', error)
      throw error
    }
  }

  return {
    classify,
  }
}
