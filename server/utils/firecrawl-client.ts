import { getConfig } from './server-config'

export interface FirecrawlSearchParams {
  timeout?: number
  limit?: number
  scrapeOptions?: {
    formats?: string[]
    onlyMainContent?: boolean
    waitFor?: number
    removeBase64Images?: boolean
  }
}

export interface FirecrawlScrapeParams {
  formats?: string[]
  onlyMainContent?: boolean
  waitFor?: number
  removeBase64Images?: boolean
  timeout?: number
}

export interface FirecrawlResult {
  url: string
  markdown: string
  metadata?: {
    title?: string
    description?: string
    sourceURL?: string
    author?: string
    publishDate?: string
    lastModified?: string
    language?: string
    contentType?: string
    mainHeadings?: string[]
  }
  actions: any[]
}

export interface FirecrawlResponse {
  success: boolean
  data: FirecrawlResult[]
  error?: string
}

export function useFirecrawl() {
  const config = getConfig()
  
  // Only check provider and base URL upfront
  const requireConfig = (operation: 'search' | 'scrape') => {
    if (operation === 'search' && config.webSearch.provider !== 'firecrawl') {
      throw new Error('Firecrawl is not configured as the current search provider')
    }
    if (!config.webSearch.apiBase) {
      throw new Error('Firecrawl API base URL is not configured')
    }
  }

  // Ensure base URL doesn't end with a slash and doesn't include /v1
  const baseUrl = config.webSearch.apiBase
    .replace(/\/$/, '')
    .replace(/\/v1$/, '')

  const makeRequest = async (endpoint: string, body: any): Promise<FirecrawlResponse> => {
    try {
      const requestUrl = `${baseUrl}/v1/${endpoint}`
      console.log('Making Firecrawl request:', {
        url: requestUrl,
        method: 'POST',
        body: body,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer [hidden]'
        }
      })

      // Check API key only when making the request
      if (!config.webSearch.apiKey) {
        console.warn('Firecrawl API key is not configured, returning empty response');
        return {
          success: false,
          data: [],
          error: 'Firecrawl API key is not configured'
        };
      }

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.webSearch.apiKey}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to get response text')
        console.error('Firecrawl error details:', {
          status: response.status,
          statusText: response.statusText,
          endpoint,
          url: requestUrl,
          body: body,
          responseText: errorText,
        })
        return {
          success: false,
          data: [],
          error: `Firecrawl API error: ${response.status} ${response.statusText}\n${errorText}`
        }
      }

      const result = await response.json()
      return {
        success: true,
        data: Array.isArray(result.data) ? result.data : [result.data]
      }
    } catch (error) {
      console.error('Firecrawl request failed:', error)
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to make request to Firecrawl API'
      }
    }
  }

  return {
    async search(query: string, params: FirecrawlSearchParams = {}): Promise<FirecrawlResponse> {
      requireConfig('search')
      console.log('Making Firecrawl search request:', query)
      return makeRequest('search', {
        query,
        timeout: params.timeout || 15000,
        limit: params.limit || 5,
        scrapeOptions: {
          formats: params.scrapeOptions?.formats || ['markdown'],
          onlyMainContent: params.scrapeOptions?.onlyMainContent ?? true,
          waitFor: params.scrapeOptions?.waitFor || 3000,
          removeBase64Images: params.scrapeOptions?.removeBase64Images ?? true,
        },
      })
    },

    async scrape(url: string, params: FirecrawlScrapeParams = {}): Promise<FirecrawlResponse> {
      requireConfig('scrape')
      console.log('Making Firecrawl scrape request:', {
        url,
        params
      })
      return makeRequest('scrape', {
        url,
        formats: params.formats || ['markdown'],
        onlyMainContent: params.onlyMainContent ?? true,
        waitFor: params.waitFor || 3000,
        removeBase64Images: params.removeBase64Images ?? true,
        timeout: params.timeout || 30000
      })
    }
  }
}
