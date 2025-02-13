import { getConfig } from './server-config'

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
                if (content) yield content
              } catch (e) {
                console.warn('Error parsing SSE message:', e)
              }
            }
          }
        }
      }

      return { textStream: textStream() }
    },

    async listModels(): Promise<{ id: string; object: string }[]> {
      try {
        const response = await fetch(`${config.ai.apiBase}/models`, {
          headers: {
            'Authorization': `Bearer ${config.ai.apiKey}`,
          },
        })
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`)
        }

        const result = await response.json()
        
        if ('data' in result && Array.isArray(result.data)) {
          return result.data
        } else if ('id' in result) {
          return [result]
        }
        return [{ id: config.ai.model, object: 'model' }]
      } catch (error) {
        console.error('Error fetching models:', error)
        return [{ id: config.ai.model, object: 'model' }]
      }
    }
  }
}
