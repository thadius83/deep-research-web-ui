import FirecrawlApp, { type SearchResponse } from '@mendable/firecrawl-js'
import { useConfigStore } from '~/stores/config'

export const useFirecrawl = () => {
  const config = useConfigStore()
  const firecrawl = new FirecrawlApp({
    apiKey: config.getActualApiKey('webSearch') ?? '',
    apiUrl: config.config.webSearch.apiBase,
  })
  return firecrawl
}
