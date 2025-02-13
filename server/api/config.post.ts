import { updateConfig } from '../utils/server-config'
import { Config } from '~/stores/config'

export default defineEventHandler(async (event) => {
  const updates = await readBody<Partial<Config>>(event)
  
  // Validate the updates
  if (updates.ai?.provider && updates.ai.provider !== 'openai-compatible') {
    throw createError({
      statusCode: 400,
      message: 'Only OpenAI compatible providers are supported',
    })
  }

  if (updates.webSearch?.provider && !['tavily', 'firecrawl'].includes(updates.webSearch.provider)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid web search provider',
    })
  }

  const config = updateConfig(updates)
  
  // Return sanitized config without sensitive data
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
