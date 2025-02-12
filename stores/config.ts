import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'
import { useEnvConfig } from '~/composables/useEnvConfig'
import { onMounted } from 'vue'

export type ConfigAiProvider = 'openai-compatible'

const isEnvValue = (value: string) => value === '****ENV****'
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
  const runtimeConfig = useRuntimeConfig()

  // Default config values
  const defaultConfig: Config = {
    ai: {
      provider: 'openai-compatible',
      model: 'gpt-4o',
      apiBase: 'https://api.openai.com/v1',
      contextSize: 128000,
    },
    webSearch: {
      provider: 'firecrawl',
      apiBase: 'https://api/firecrawl.dev/v1',
    },
  }

  const envConfig = useEnvConfig()

  // Auto-sync with localStorage
  const config = useLocalStorage<Config>('deep-research-config', defaultConfig)

  // Check if a value exists
  const hasValidEnvValue = (value?: string) => {
    return typeof value === 'string' && value.length > 0
  }

  // Update environment values on client mount in case localStorage is stale.
  onMounted(() => {
    // 1. Set provider if specified by environment
    const defaultProvider = runtimeConfig.public.defaultSearchProvider
    if (hasValidEnvValue(defaultProvider)) {
      console.log('Updating onMounted: Setting default provider from env:', defaultProvider)
      config.value.webSearch.provider = defaultProvider as 'tavily' | 'firecrawl'
    }

    // 2. Set API keys from environment (overriding localStorage if necessary)
    const openaiKey = runtimeConfig.public.openaiKey
    if (hasValidEnvValue(openaiKey)) {
      console.log('Updating onMounted: Setting OpenAI key from env')
      config.value.ai.apiKey = '****ENV****'
    }

    const currentProvider = config.value.webSearch.provider
    const webSearchKey =
      currentProvider === 'firecrawl'
        ? runtimeConfig.public.firecrawlKey
        : runtimeConfig.public.tavilyKey
    if (hasValidEnvValue(webSearchKey)) {
      console.log(`Updating onMounted: Setting ${currentProvider} key from env`)
      config.value.webSearch.apiKey = '****ENV****'
    }

    // 3. Set base URLs using the runtime values directly
    const openaiUrl = runtimeConfig.public.openaiEndpoint
    if (hasValidEnvValue(openaiUrl)) {
      console.log('Updating onMounted: Setting OpenAI endpoint from env:', openaiUrl)
      config.value.ai.apiBase = openaiUrl
    }
    const webSearchUrl =
      currentProvider === 'firecrawl'
        ? runtimeConfig.public.firecrawlBaseUrl
        : runtimeConfig.public.tavilyBaseUrl
    if (hasValidEnvValue(webSearchUrl)) {
      console.log(`Updating onMounted: Setting ${currentProvider} base URL from env:`, webSearchUrl)
      config.value.webSearch.apiBase = webSearchUrl
    }

    // 4. Set model and context size from environment
    const model = runtimeConfig.public.openaiModel
    if (hasValidEnvValue(model)) {
      console.log('Updating onMounted: Setting OpenAI model from env:', model)
      config.value.ai.model = model
    }
    const contextSize = runtimeConfig.public.contextSize
    if (hasValidEnvValue(contextSize)) {
      console.log('Updating onMounted: Setting context size from env:', contextSize)
      config.value.ai.contextSize = Number(contextSize)
    }

    console.log('Final config after onMounted env initialization:', {
      ai: {
        ...config.value.ai,
        apiKey: config.value.ai.apiKey ? '****' : undefined,
      },
      webSearch: {
        ...config.value.webSearch,
        apiKey: config.value.webSearch.apiKey ? '****' : undefined,
      }
    })
  })

  // Getter for actual API keys (de-obfuscate using env values if needed)
  const getActualApiKey = (type: 'ai' | 'webSearch') => {
    if (type === 'ai') {
      const envKey = runtimeConfig.public.openaiKey
      const uiKey = config.value.ai.apiKey
      if (isEnvValue(uiKey || '') && envKey) {
        return envKey
      }
      return uiKey || ''
    } else {
      const provider = config.value.webSearch.provider
      const envKey =
        provider === 'tavily'
          ? runtimeConfig.public.tavilyKey
          : runtimeConfig.public.firecrawlKey
      const uiKey = config.value.webSearch.apiKey
      if (isEnvValue(uiKey || '') && envKey) {
        return envKey
      }
      return uiKey || ''
    }
  }

  // Method to update the search provider and update keys/URLs accordingly
  const updateProvider = (provider: 'tavily' | 'firecrawl') => {
    const oldProvider = config.value.webSearch.provider
    console.log('Updating provider:', { from: oldProvider, to: provider })

    config.value.webSearch.provider = provider

    const envKey =
      provider === 'firecrawl'
        ? runtimeConfig.public.firecrawlKey
        : runtimeConfig.public.tavilyKey

    if (envKey) {
      console.log(`Setting ${provider} key from env`)
      config.value.webSearch.apiKey = '****ENV****'
    } else {
      if (isEnvValue(config.value.webSearch.apiKey || '')) {
        console.log('Clearing env key after provider change')
        config.value.webSearch.apiKey = ''
      }
    }

    const envUrl =
      provider === 'firecrawl'
        ? runtimeConfig.public.firecrawlBaseUrl
        : runtimeConfig.public.tavilyBaseUrl

    if (envUrl && envUrl.length > 0) {
      console.log(`Setting ${provider} base URL from env:`, envUrl)
      config.value.webSearch.apiBase = envUrl
    } else {
      config.value.webSearch.apiBase = getDefaultApiBase(provider)
    }

    console.log('Provider update complete:', {
      provider: config.value.webSearch.provider,
      apiBase: config.value.webSearch.apiBase,
      hasKey: !!config.value.webSearch.apiKey
    })
  }

  // Helper to get default API URL for a provider
  const getDefaultApiBase = (provider: 'tavily' | 'firecrawl') => {
    return provider === 'firecrawl'
      ? 'https://api.firecrawl.dev/v1'
      : 'https://api.tavily.com'
  }

  // Watch for API base changes to clear keys when necessary
  watch(() => config.value.ai.apiBase, (newEndpoint?: string, oldEndpoint?: string) => {
    if (!newEndpoint || !oldEndpoint || newEndpoint === oldEndpoint) return
    if (isEnvValue(config.value.ai.apiKey || '')) {
      console.log('Endpoint changed while using env key - clearing key')
      config.value.ai.apiKey = ''
    }
  })

  return {
    config,
    getActualApiKey,
    updateProvider
  }
})
