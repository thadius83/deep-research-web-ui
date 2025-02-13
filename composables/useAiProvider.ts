import { createOpenAI } from '@ai-sdk/openai'
import { useConfigStore } from '~/stores/config'

/* These types represent the expected response from the OpenAI /models endpoint */
export interface OpenAICompatibleModel {
  id: string
  object: string
}
export interface OpenAICompatibleModelsResponse {
  object: string
  data: OpenAICompatibleModel[]
}

/* This function is used when you want to run an AI model */
export const useAiModel = () => {
  const config = useConfigStore()
  switch (config.config.ai.provider) {
    case 'openai-compatible': {
      const openai = createOpenAI({
        apiKey: config.getActualApiKey('ai'),
        baseURL: config.config.ai.apiBase || 'https://api.openai.com/v1',
      })
      return openai(config.config.ai.model)
    }
    default:
      throw new Error(`Unknown AI provider: ${config.config.ai.provider}`)
  }
}

/* Updated function to list available models using $fetch */
export const listAvailableModels = async (): Promise<OpenAICompatibleModel[]> => {
  const config = useConfigStore()
  if (config.config.ai.provider !== 'openai-compatible') {
    throw new Error(`Unknown AI provider: ${config.config.ai.provider}`)
  }
  const apiKey = config.getActualApiKey('ai')
  if (!apiKey) {
    console.error('No API key provided for listing AI models')
    return []
  }
  const aiApiBase = config.config.ai.apiBase || 'https://api.openai.com/v1'

  try {
    const result = await $fetch<OpenAICompatibleModelsResponse | OpenAICompatibleModel>(`${aiApiBase}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    console.log('Received models response:', result)
    // If the response contains a "data" array, return that.
    if ('data' in result && Array.isArray(result.data) && result.data.length > 0) {
      return result.data
    } 
    // Otherwise, if the response looks like a single model object, wrap it in an array.
    else if ('id' in result) {
      return [result as OpenAICompatibleModel]
    } else {
      console.warn('No models returned from API. Falling back to default.')
      return [{ id: config.config.ai.model, object: 'model' }]
    }
  } catch (error) {
    console.error('Error fetching models:', error)
    // Fallback: include at least the default model
    return [{ id: config.config.ai.model, object: 'model' }]
  }
}
