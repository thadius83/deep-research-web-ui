export interface Config {
  ai: {
    apiKey: string
    apiBase: string
    model: string
    contextSize: number
  }
  webSearch: {
    provider: 'tavily' | 'firecrawl'
    apiKey: string
    apiBase: string
  }
  isDev: boolean
}

export function getConfig(): Config {
  // Log development mode status
  console.log('[Config] Development mode:', process.dev)
  console.log('[Config] NODE_ENV:', process.env.NODE_ENV)

  return {
    ai: {
      apiKey: process.env.OPENAI_KEY || '',
      apiBase: process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      contextSize: parseInt(process.env.CONTEXT_SIZE || '256000', 10),
    },
    webSearch: {
      provider: (process.env.DEFAULT_SEARCH_PROVIDER || 'firecrawl') as 'tavily' | 'firecrawl',
      apiKey: process.env.DEFAULT_SEARCH_PROVIDER === 'tavily' 
        ? process.env.TAVILY_KEY || ''
        : process.env.FIRECRAWL_KEY || '',
      // Always respect provider-specific base URLs regardless of current provider
      apiBase: process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev/v1',
    },
    isDev: process.dev || process.env.NODE_ENV === 'development'
  }
}

export function updateConfig(updates: Partial<Config>): Config {
  if (process.dev) {
    console.log('[Config] Updating configuration:', updates);
  }

  // Update environment variables with new values
  if (updates.ai) {
    if (updates.ai.apiKey) process.env.OPENAI_KEY = updates.ai.apiKey
    if (updates.ai.apiBase) process.env.OPENAI_ENDPOINT = updates.ai.apiBase
    if (updates.ai.model) process.env.OPENAI_MODEL = updates.ai.model
    if (updates.ai.contextSize) process.env.CONTEXT_SIZE = updates.ai.contextSize.toString()
  }

  if (updates.webSearch) {
    if (updates.webSearch.provider) process.env.DEFAULT_SEARCH_PROVIDER = updates.webSearch.provider
    if (updates.webSearch.apiKey) {
      if (updates.webSearch.provider === 'tavily') {
        process.env.TAVILY_KEY = updates.webSearch.apiKey
      } else {
        process.env.FIRECRAWL_KEY = updates.webSearch.apiKey
      }
    }
    if (updates.webSearch.apiBase) {
      if (updates.webSearch.provider === 'tavily') {
        process.env.TAVILY_BASE_URL = updates.webSearch.apiBase
      } else {
        process.env.FIRECRAWL_BASE_URL = updates.webSearch.apiBase
      }
    }
  }

  if (process.dev) {
    console.log('[Config] Configuration updated');
  }

  // Return updated config
  return getConfig()
}
