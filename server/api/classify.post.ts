import { useAiClient } from '../utils/ai-client'
import { getConfig } from '../utils/server-config'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  const config = getConfig()
  const { query, content, template, systemPrompt } = await readBody(event)

  if (!query || !template) {
    throw createError({
      statusCode: 400,
      message: 'Query and template are required',
    })
  }

  try {
    // Format the classification prompt
    const prompt = template
      .replace('{{query}}', query)
      .replace('{{searchResults}}', content || '')
      .replace('{{currentDate}}', new Date().toISOString())

    if (config.isDev) {
      logger.debug('[Classify] Request:', {
        query,
        contentLength: content?.length || 0,
        templateLength: template.length,
        hasSystemPrompt: !!systemPrompt
      })
    }

    // Get classification from LLM
    const aiClient = useAiClient()
    let response = ''
    const { textStream } = await aiClient.streamText({
      system: systemPrompt || 'You are an expert content classifier.',
      prompt,
    })

    for await (const chunk of textStream) {
      response += chunk
    }

    if (config.isDev) {
      logger.debug('[Classify] Response:', response)
    }

    return { response }
  } catch (error) {
    logger.error('[Classify] Error:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Classification failed',
    })
  }
})
