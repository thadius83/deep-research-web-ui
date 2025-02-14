import { defineStore } from 'pinia'
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
      apiBase: 'https://api.firecrawl.dev/v1',
    },
  }

  // Try to use localStorage, fall back to memory storage
  const config = useLocalStorage<Config>('deep-research-config', defaultConfig, {
    mergeDefaults: true,
    onError: (error) => {
      console.warn('Storage error (falling back to memory storage):', error)
    }
  })

  // Get base URL for API requests
  function getBaseUrl() {
    if (process.server) return ''
    return window.location.origin || ''
  }

  // Load initial config from server
  async function loadConfig() {
    try {
      const response = await fetch(getBaseUrl() + '/api/config')
      if (!response.ok) {
        throw new Error(`Failed to load config: ${response.status} ${response.statusText}`)
      }
      const serverConfig = await response.json()
      
      // Update local config with server values, preserving any local overrides
      const runtimeConfig = useRuntimeConfig()
      config.value = {
        ai: {
          ...config.value.ai,
          ...serverConfig.ai,
          // Keep local API key if we have one and no env var
          apiKey: !runtimeConfig.public.openaiKey ? config.value.ai.apiKey : serverConfig.ai.apiKey,
        },
        webSearch: {
          ...config.value.webSearch,
          ...serverConfig.webSearch,
          // Keep local API key if we have one and no env var
          apiKey: !(config.value.webSearch.provider === 'tavily' 
            ? runtimeConfig.public.tavilyKey 
            : runtimeConfig.public.firecrawlKey)
            ? config.value.webSearch.apiKey 
            : serverConfig.webSearch.apiKey,
          // Always use environment variables for base URLs if available
          apiBase: config.value.webSearch.provider === 'tavily'
            ? (runtimeConfig.public.tavilyBaseUrl || serverConfig.webSearch.apiBase)
            : (runtimeConfig.public.firecrawlBaseUrl || serverConfig.webSearch.apiBase),
        },
      }
    } catch (error) {
      console.error('Error loading config:', error)
      // On error, keep using local config + env vars
      const runtimeConfig = useRuntimeConfig()
      if (runtimeConfig.public.openaiKey || runtimeConfig.public.tavilyKey || runtimeConfig.public.firecrawlKey) {
        console.log('Using environment variables for configuration')
      }
    }
  }

  // Save config to server
  async function saveConfig() {
    try {
      const response = await fetch(getBaseUrl() + '/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config.value),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to save config: ${response.status} ${response.statusText}`)
      }
      
      const serverConfig = await response.json()
      
      // Update local config with server response, preserving any local overrides
      const runtimeConfig = useRuntimeConfig()
      config.value = {
        ai: {
          ...config.value.ai,
          ...serverConfig.ai,
          // Keep local API key if we have one and no env var
          apiKey: !runtimeConfig.public.openaiKey ? config.value.ai.apiKey : serverConfig.ai.apiKey,
        },
        webSearch: {
          ...config.value.webSearch,
          ...serverConfig.webSearch,
          // Keep local API key if we have one and no env var
          apiKey: !(config.value.webSearch.provider === 'tavily' 
            ? runtimeConfig.public.tavilyKey 
            : runtimeConfig.public.firecrawlKey)
            ? config.value.webSearch.apiKey 
            : serverConfig.webSearch.apiKey,
        },
      }
    } catch (error) {
      console.error('Error saving config:', error)
      // On error, keep using current config
    }
  }

  // Method to update the search provider and update keys/URLs accordingly
  const updateProvider = async (provider: 'tavily' | 'firecrawl') => {
    const oldProvider = config.value.webSearch.provider
    console.log('Updating provider:', { from: oldProvider, to: provider })

    const runtimeConfig = useRuntimeConfig()
    
    config.value.webSearch.provider = provider
    
    // Handle API base URLs with proper fallback logic
    if (provider === 'firecrawl') {
      // For Firecrawl:
      // 1. Use environment variable if set
      // 2. Keep existing base URL if switching back to Firecrawl
      // 3. Use default only if no other option exists
      config.value.webSearch.apiBase = runtimeConfig.public.firecrawlBaseUrl || 
        (oldProvider === provider ? config.value.webSearch.apiBase : null) || 
        'https://api.firecrawl.dev/v1'
    } else {
      // For Tavily, always use env var or default
      config.value.webSearch.apiBase = runtimeConfig.public.tavilyBaseUrl || 
        'https://api.tavily.com'
    }

    // Clear API key if switching providers (for security)
    if (oldProvider !== provider) {
      config.value.webSearch.apiKey = undefined
    }

    await saveConfig()
  }

  // Get the actual API key for a given service
  const getActualApiKey = (type: 'ai' | 'webSearch') => {
    const runtimeConfig = useRuntimeConfig()
    
    if (type === 'ai') {
      // Use environment variable if available, otherwise use stored key
      return runtimeConfig.public.openaiKey || config.value.ai.apiKey || ''
    } else {
      // Use environment variable based on provider if available, otherwise use stored key
      return config.value.webSearch.provider === 'tavily'
        ? (runtimeConfig.public.tavilyKey || config.value.webSearch.apiKey || '')
        : (runtimeConfig.public.firecrawlKey || config.value.webSearch.apiKey || '')
    }
  }

  // Load config on store initialization
  if (process.client) {
    loadConfig()
  }

  return {
    config,
    updateProvider,
    saveConfig,
    getActualApiKey,
  }
})
