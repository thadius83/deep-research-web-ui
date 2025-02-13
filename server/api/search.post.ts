import { useFirecrawl } from '../utils/firecrawl-client'
import { useTavily } from '../utils/tavily-client'
import { getConfig } from '../utils/server-config'

export default defineEventHandler(async (event) => {
  try {
    const { query, params } = await readBody(event)
    const config = getConfig()

    console.log('Search request:', {
      provider: config.webSearch.provider,
      apiBase: config.webSearch.apiBase,
      hasKey: !!config.webSearch.apiKey,
      query,
      params,
    })

    // Use the appropriate search client based on config
    if (config.webSearch.provider === 'tavily') {
      const tavily = useTavily()
      const result = await tavily.search(query, {
        maxResults: params?.maxResults || 5,
      })
      console.log(`[Tavily] Ran "${query}", found ${result.results.length} contents`)
      return result
    } else {
      const firecrawl = useFirecrawl()
      const result = await firecrawl.search(query, {
        timeout: params?.timeout || 15000,
        limit: params?.limit || 5,
        scrapeOptions: {
          formats: params?.scrapeOptions?.formats || ['markdown'],
          onlyMainContent: params?.scrapeOptions?.onlyMainContent ?? true,
          waitFor: params?.scrapeOptions?.waitFor || 3000,
          removeBase64Images: params?.scrapeOptions?.removeBase64Images ?? true,
        },
      })
      console.log(`[Firecrawl] Ran "${query}", found ${result.data.length} contents`)
      return result
    }
  } catch (error) {
    console.error('Search error:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Search failed',
      cause: error,
    })
  }
})
