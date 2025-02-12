import { defineStore, skipHydrate } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

export type ConfigAiProvider = 'openai-compatible'
export interface ConfigAi {
  provider: ConfigAiProvider
  apiKey?: string
  apiBase?: string
  model: string
  contextSize?: number
}
export interface ConfigWebSearch {
  provider: 'tavily' | 'firecrawl'
  apiKey?: string
  apiBase?: string
}

export interface Config {
  ai: ConfigAi
  webSearch: ConfigWebSearch
}

export const useConfigStore = defineStore('config', () => {
  const config = useLocalStorage<Config>('deep-research-config', {
    ai: {
      provider: 'openai-compatible',
      model: 'gpt-4o',
      apiBase: 'https://api.openai.com/v1',
      contextSize: 128_000,
    },
    webSearch: {
      provider: 'firecrawl',
      apiBase: 'https://api.firecrawl.dev/v1',
    },
  })

  return { config: skipHydrate(config) }
})
