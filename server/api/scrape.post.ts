import { scrapeUrlContent } from '../utils/url-scraper'

export default defineEventHandler(async (event) => {
  try {
    const { url, params } = await readBody(event)

    if (!url) {
      throw createError({
        statusCode: 400,
        message: 'URL is required',
      })
    }

    console.log('Scrape request:', {
      url,
      params,
    })

    return await scrapeUrlContent(url, params)
  } catch (error) {
    console.error('Scrape error:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Scrape operation failed',
      cause: error,
    })
  }
})
