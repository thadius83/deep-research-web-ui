import { getConfig } from './server-config'

interface FirecrawlSearchParams {
  timeout?: number
  limit?: number
  scrapeOptions?: {
    formats?: string[]
    onlyMainContent?: boolean
    waitFor?: number
    removeBase64Images?: boolean
  }
}

interface FirecrawlResult {
  url: string
  markdown: string
}

interface FirecrawlSearchResponse {
  data: FirecrawlResult[]
}

export function useFirecrawl() {
  const config = getConfig()
  
  if (config.webSearch.provider !== 'firecrawl') {
    throw new Error('Firecrawl is not configured as the current search provider')
  }

  if (!config.webSearch.apiBase) {
    throw new Error('Firecrawl API base URL is not configured')
  }

  if (!config.webSearch.apiKey) {
    throw new Error('Firecrawl API key is not configured')
  }

  // Ensure base URL doesn't end with a slash and doesn't include /v1
  const baseUrl = config.webSearch.apiBase
    .replace(/\/$/, '')
    .replace(/\/v1$/, '')

  return {
    async search(query: string, params: FirecrawlSearchParams = {}): Promise<FirecrawlSearchResponse> {
      // Use /v1/search endpoint
      const searchUrl = `${baseUrl}/v1/search`

      console.log('Making Firecrawl request to:', searchUrl)

      try {
        const response = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.webSearch.apiKey}`,
          },
          body: JSON.stringify({
            query,
            timeout: params.timeout || 15000,
            limit: params.limit || 5,
            scrapeOptions: {
              formats: params.scrapeOptions?.formats || ['markdown'],
              onlyMainContent: params.scrapeOptions?.onlyMainContent ?? true,
              waitFor: params.scrapeOptions?.waitFor || 3000,
              removeBase64Images: params.scrapeOptions?.removeBase64Images ?? true,
            },
          }),
        })

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Failed to get response text')
          console.error('Firecrawl error:', {
            status: response.status,
            statusText: response.statusText,
            url: searchUrl,
            responseText: errorText,
          })
          throw new Error(`Firecrawl API error: ${response.status} ${response.statusText}\n${errorText}`)
        }

        return response.json()
      } catch (error) {
        console.error('Firecrawl request failed:', error)
        throw error instanceof Error 
          ? error 
          : new Error('Failed to make request to Firecrawl API')
      }
    }
  }
}
