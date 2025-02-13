import { getConfig } from './server-config'

interface TavilySearchParams {
  maxResults?: number
}

interface TavilyResult {
  url: string
  content: string
}

interface TavilySearchResponse {
  results: TavilyResult[]
}

export function useTavily() {
  const config = getConfig()
  
  if (config.webSearch.provider !== 'tavily') {
    throw new Error('Tavily is not configured as the current search provider')
  }

  if (!config.webSearch.apiBase) {
    throw new Error('Tavily API base URL is not configured')
  }

  if (!config.webSearch.apiKey) {
    throw new Error('Tavily API key is not configured')
  }

  const baseUrl = config.webSearch.apiBase.replace(/\/$/, '')

  return {
    async search(query: string, params: TavilySearchParams = {}): Promise<TavilySearchResponse> {
      const searchUrl = `${baseUrl}/search`

      console.log('Making Tavily request to:', searchUrl)

      try {
        const response = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.webSearch.apiKey}`,
          },
          body: JSON.stringify({
            query,
            max_results: params.maxResults || 5,
            search_depth: 'advanced',
            include_answer: false,
            include_raw_content: false,
            include_images: false,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Failed to get response text')
          console.error('Tavily error:', {
            status: response.status,
            statusText: response.statusText,
            url: searchUrl,
            responseText: errorText,
          })
          throw new Error(`Tavily API error: ${response.status} ${response.statusText}\n${errorText}`)
        }

        return response.json()
      } catch (error) {
        console.error('Tavily request failed:', error)
        throw error instanceof Error 
          ? error 
          : new Error('Failed to make request to Tavily API')
      }
    }
  }
}
