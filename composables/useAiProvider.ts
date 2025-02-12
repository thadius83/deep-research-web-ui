import { createOpenAI } from '@ai-sdk/openai'

export const useAiModel = () => {
  const config = useConfigStore()
  switch (config.config.ai.provider) {
    case 'openai-compatible':
      const openai = createOpenAI({
        apiKey: config.getActualApiKey('ai'),
        baseURL: config.config.ai.apiBase || 'https://api.openai.com/v1',
      })
      return openai(config.config.ai.model)
    default:
      throw new Error(`Unknown AI provider: ${config.config.ai.provider}`)
  }
}
