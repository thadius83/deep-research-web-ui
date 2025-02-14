import { getConfig } from './server-config'
import { logger } from '../../utils/logger'

interface StreamTextOptions {
  prompt: string
  system?: string
  model?: string
  abortSignal?: AbortSignal
}

interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

export function useAiClient() {
  const config = getConfig()

  return {
    async streamText(params: StreamTextOptions) {
      const { prompt, system, model, abortSignal } = params
      
      const messages: ChatMessage[] = []
      if (system) {
        messages.push({ role: 'system', content: system })
      }
      messages.push({ role: 'user', content: prompt })

      if (config.isDev) {
        logger.debug(`[LLM] Model: ${model || config.ai.model}`);
        if (system) {
          logger.debug(`[LLM] System Prompt: ${system}`);
        }
        logger.debug(`[LLM] User Prompt: ${prompt}`);
      }

      const response = await fetch(`${config.ai.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.ai.apiKey}`,
        },
        body: JSON.stringify({
          model: model || config.ai.model,
          messages,
          stream: true,
        }),
        signal: abortSignal,
      })

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status} ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      let fullResponse = '';

      const textStream = async function* () {
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue
              try {
                const json = JSON.parse(data)
                const content = json.choices?.[0]?.delta?.content
                if (content) {
                  fullResponse += content;
                  yield content;
                }
              } catch (e) {
                if (config.isDev) {
                  logger.error(`[LLM] Error parsing SSE message: ${e}`);
                }
              }
            }
          }
        }

        if (config.isDev && fullResponse) {
          logger.debug(`[LLM] Response: ${fullResponse}`);
        }
      }

      return { textStream: textStream() }
    },

    async listModels(): Promise<{ id: string; object: string }[]> {
      try {
        if (config.isDev) {
          logger.debug('[LLM] Fetching available models');
        }

        const response = await fetch(`${config.ai.apiBase}/models`, {
          headers: {
            'Authorization': `Bearer ${config.ai.apiKey}`,
          },
        })
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`)
        }

        const result = await response.json()
        
        if (config.isDev) {
          logger.debug(`[LLM] Available models: ${JSON.stringify(result, null, 2)}`);
        }

        if ('data' in result && Array.isArray(result.data)) {
          return result.data
        } else if ('id' in result) {
          return [result]
        }
        return [{ id: config.ai.model, object: 'model' }]
      } catch (error) {
        logger.error(`[LLM] Error fetching models: ${error}`);
        if (config.isDev) {
          logger.error(`[LLM] Full error details: ${JSON.stringify(error, null, 2)}`);
        }
        return [{ id: config.ai.model, object: 'model' }]
      }
    }
  }
}
