import type { TavilySearchResponse } from '@tavily/core'
import type { SearchResponse as FirecrawlSearchResponse } from '@mendable/firecrawl-js'
import { useConfigStore } from '~/stores/config'

interface SearchParams {
  maxResults?: number
  timeout?: number
  limit?: number
  scrapeOptions?: {
    formats?: string[]
    onlyMainContent?: boolean
    waitFor?: number
    removeBase64Images?: boolean
  }
}

export function useServerSearch() {
  const config = useConfigStore()

  return {
    async search(query: string, params: SearchParams = {}): Promise<TavilySearchResponse | FirecrawlSearchResponse> {
      try {
        // Get base URL, defaulting to current origin
        const baseUrl = process.client 
          ? (window.location.origin || 'http://localhost:3000')
          : 'http://localhost:3000'

        const searchUrl = `${baseUrl}/api/search`

        console.log('Making search request:', {
          url: searchUrl,
          provider: config.config.webSearch.provider,
          query,
          params,
        })

        const response = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            params,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Failed to get response text')
          console.error('Search error:', {
            status: response.status,
            statusText: response.statusText,
            url: searchUrl,
            responseText: errorText,
          })
          throw new Error(`Search failed: ${response.status} ${response.statusText}\n${errorText}`)
        }

        return response.json()
      } catch (error) {
        console.error('Search request failed:', error)
        throw error instanceof Error 
          ? error 
          : new Error('Failed to make search request')
      }
    }
  }
}
