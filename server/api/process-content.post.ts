import { useAiClient } from '../utils/ai-client'
import { getConfig } from '../utils/server-config'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  const config = getConfig()
  const { query, content, template, systemPrompt, sources, learnings } = await readBody(event)

  if (!query || !template || !content) {
    throw createError({
      statusCode: 400,
      message: 'Query, template, and content are required',
    })
  }

  try {
    // Format the processing prompt
    const prompt = template
      .replace('{{query}}', query)
      .replace('{{searchResults}}', content)
      .replace('{{sources}}', sources ? JSON.stringify(sources) : '[]')
      .replace('{{learnings}}', learnings ? learnings.join('\n') : '')
      .replace('{{currentDate}}', new Date().toISOString())

    if (config.isDev) {
      logger.debug('[Process Content] Request:', {
        query,
        contentLength: content.length,
        templateLength: template.length,
        hasSystemPrompt: !!systemPrompt,
        sourcesCount: sources?.length || 0,
        learningsCount: learnings?.length || 0
      })
    }

    // Process content with LLM
    const aiClient = useAiClient()
    let response = ''
    const { textStream } = await aiClient.streamText({
      system: systemPrompt || 'You are an expert information extractor and analyzer.',
      prompt,
    })

    for await (const chunk of textStream) {
      response += chunk
    }

    if (config.isDev) {
      logger.debug('[Process Content] Response:', response)
    }

    return { response }
  } catch (error) {
    logger.error('[Process Content] Error:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Content processing failed',
    })
  }
})
