import type { TavilySearchResponse } from '@tavily/core'
import type { SearchResponse as FirecrawlSearchResponse } from '@mendable/firecrawl-js'
import { useConfigStore } from '~/stores/config'

interface ScrapeParams {
  formats?: string[]
  onlyMainContent?: boolean
  waitFor?: number
  removeBase64Images?: boolean
  timeout?: number
}

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
    async scrape(url: string, params: ScrapeParams = {}): Promise<FirecrawlSearchResponse> {
      try {
        const baseUrl = process.client 
          ? (window.location.origin || 'http://localhost:3000')
          : 'http://localhost:3000'

        const scrapeUrl = `${baseUrl}/api/scrape`

        console.log('Making scrape request:', {
          url: scrapeUrl,
          provider: config.config.webSearch.provider,
          targetUrl: url,
          params,
        })

        const response = await fetch(scrapeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url,
            params,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Failed to get response text')
          console.error('Scrape error:', {
            status: response.status,
            statusText: response.statusText,
            url: scrapeUrl,
            responseText: errorText,
          })
          throw new Error(`Scrape failed: ${response.status} ${response.statusText}\n${errorText}`)
        }

        return response.json()
      } catch (error) {
        console.error('Scrape request failed:', error)
        throw error instanceof Error 
          ? error 
          : new Error('Failed to make scrape request')
      }
    },

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
