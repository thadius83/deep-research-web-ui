import { v4 as uuidv4 } from 'uuid'
import { logger } from '../../utils/logger'
import { useFirecrawl } from './firecrawl-client'
import type { FirecrawlScrapeParams } from './firecrawl-client'

import type { FirecrawlResponse } from './firecrawl-client'

function ensureString(value: string | undefined, fallback: string): string {
  return value || fallback
}

/**
 * Scrapes content from a URL using Firecrawl's scraping capabilities
 */
export async function scrapeUrlContent(url: string, params?: FirecrawlScrapeParams): Promise<FirecrawlResponse> {
  try {
    const firecrawl = useFirecrawl()
    const result = await firecrawl.scrape(url, {
      formats: params?.formats || ['markdown'],
      onlyMainContent: params?.onlyMainContent ?? true,
      waitFor: params?.waitFor || 3000,
      removeBase64Images: params?.removeBase64Images ?? true,
      timeout: params?.timeout || 30000
    })

    if (!result.success || !result.data.length) {
      logger.error('URL scraping failed:', {
        url,
        error: result.error
      })
      return {
        success: false,
        data: []
      }
    }

    // Transform scrape result into FirecrawlResponse format
    return {
      success: true,
      data: [{
        url: ensureString(result.data[0].metadata?.sourceURL, url),
        markdown: ensureString(result.data[0].markdown, ''),
        metadata: {
          title: ensureString(result.data[0].metadata?.title, url),
          description: ensureString(result.data[0].metadata?.description, ''),
          sourceURL: ensureString(result.data[0].metadata?.sourceURL, url)
        },
        actions: []
      }]
    }

  } catch (error) {
    logger.error('Error scraping URL:', {
      url,
      error
    })
    return {
      success: false,
      data: []
    }
  }
}
