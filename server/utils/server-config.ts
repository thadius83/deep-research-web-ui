import { Config, ConfigAiProvider } from '~/stores/config'

// In-memory store for user-provided config
let userConfig: Partial<Config> = {}

// Default configuration values
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

/**
 * Get effective configuration by merging:
 * 1. User-provided config (highest priority)
 * 2. Environment variables (initial defaults)
 * 3. Default values (fallback)
 */
export function getEffectiveConfig(): Config {
  const runtimeConfig = useRuntimeConfig()

  // Start with environment variables as initial values
  const envConfig = {
    ai: {
      provider: 'openai-compatible' as ConfigAiProvider,
      apiKey: runtimeConfig.public.openaiKey,
      apiBase: runtimeConfig.public.openaiEndpoint,
      model: runtimeConfig.public.openaiModel,
      contextSize: Number(runtimeConfig.public.contextSize),
    },
    webSearch: {
      provider: runtimeConfig.public.defaultSearchProvider as 'tavily' | 'firecrawl' || defaultConfig.webSearch.provider,
      apiKey: runtimeConfig.public.defaultSearchProvider === 'tavily'
        ? runtimeConfig.public.tavilyKey
        : runtimeConfig.public.firecrawlKey,
      apiBase: runtimeConfig.public.defaultSearchProvider === 'tavily'
        ? (runtimeConfig.public.tavilyBaseUrl || 'https://api.tavily.com')
        : (runtimeConfig.public.firecrawlBaseUrl || 'http://10.0.0.145:3002/v1'),
    },
  }

  // Merge in this order: defaults < env vars < user config
  const config = {
    ai: {
      ...defaultConfig.ai,
      ...envConfig.ai,
      ...userConfig.ai,
      // Always keep provider as openai-compatible for now
      provider: 'openai-compatible' as ConfigAiProvider,
    },
    webSearch: {
      ...defaultConfig.webSearch,
      ...envConfig.webSearch,
      ...userConfig.webSearch,
    },
  }

  // Ensure Firecrawl base URL includes /v1
  if (config.webSearch.provider === 'firecrawl' && config.webSearch.apiBase) {
    config.webSearch.apiBase = config.webSearch.apiBase
      .replace(/\/$/, '')  // Remove trailing slash
      .replace(/\/v1$/, '') // Remove /v1 if it exists
      + '/v1'  // Add /v1
  }

  return config
}

/**
 * Update user-provided configuration
 */
export function updateConfig(newConfig: Partial<Config>) {
  userConfig = {
    ...userConfig,
    ...newConfig,
  }
  return getEffectiveConfig()
}

/**
 * Get current configuration state
 */
export function getConfig(): Config {
  return getEffectiveConfig()
}
