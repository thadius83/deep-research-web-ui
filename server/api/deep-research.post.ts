import { ResearchStep } from '~/lib/deep-research'
import type { ResearchContext } from '~/research-methods/types'
import { getResearchPrompts } from '../utils/research-method'
import { useAiClient } from '../utils/ai-client'
import { useTavily } from '../utils/tavily-client'
import { useFirecrawl } from '../utils/firecrawl-client'
import { getConfig } from '../utils/server-config'
import { serverDeepResearch } from '../utils/deep-research'

export default defineEventHandler(async (event) => {
  const { initialQuery, feedback, depth, breadth, methodId } = await readBody(event)
  console.log({ initialQuery, feedback, depth, breadth })

  // Set SSE headers
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')

  const combinedQuery = `
Initial Query: ${initialQuery}
Follow-up Questions and Answers:
${feedback.map((qa: { question: string; answer: string }) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n')}
`

  return new Promise<void>(async (resolve, reject) => {
    const onProgress = (data: ResearchStep) => {
      console.log(data)
      // Send progress events
      event.node.res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    try {
      // Get the current config
      const config = getConfig()

      // Initialize clients
      const aiClient = useAiClient()
      const searchClient = config.webSearch.provider === 'tavily' 
        ? useTavily()
        : useFirecrawl()

      // Create research context
      const context: ResearchContext = {
        query: combinedQuery,
        searchResults: [],
        sources: [],
        currentDate: new Date().toISOString(),
      };

      // Get method-specific prompts
      const prompts = getResearchPrompts(methodId, context);

      await serverDeepResearch({
        prompts,
        query: combinedQuery,
        breadth,
        maxDepth: depth,
        onProgress,
        clients: {
          ai: aiClient,
          search: searchClient,
        },
      })

      resolve()
    } catch (error) {
      console.error('Deep research error:', error)
      const errorStep: ResearchStep = {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        nodeId: '0',
      }
      onProgress(errorStep)
      resolve() // Resolve instead of reject to ensure the error is sent to the client
    }
  })
})
