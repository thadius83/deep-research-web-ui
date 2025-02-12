import FirecrawlApp, { type SearchResponse } from '@mendable/firecrawl-js'
import { useConfigStore } from '~/stores/config'

export const useFirecrawl = () => {
  const config = useConfigStore()
  const firecrawl = new FirecrawlApp({
    apiKey: config.config.webSearch.apiKey ?? '',
    apiUrl: config.config.webSearch.apiBase,
  })
  return firecrawl
}
