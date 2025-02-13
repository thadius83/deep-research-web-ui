import { getConfig } from '../utils/server-config'

export default defineEventHandler(async () => {
  const config = getConfig()
  
  // Return a sanitized version of the config that doesn't expose sensitive data
  return {
    ai: {
      provider: config.ai.provider,
      apiBase: config.ai.apiBase,
      model: config.ai.model,
      contextSize: config.ai.contextSize,
      hasKey: !!config.ai.apiKey,
    },
    webSearch: {
      provider: config.webSearch.provider,
      apiBase: config.webSearch.apiBase,
      hasKey: !!config.webSearch.apiKey,
    }
  }
})
