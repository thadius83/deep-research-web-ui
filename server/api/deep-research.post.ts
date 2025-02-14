import { ResearchStep } from '~/lib/deep-research'
import type { ResearchContext } from '~/research-methods/types'
import { getResearchPrompts, validateMethodOutput } from '../utils/research-method'
import { useAiClient } from '../utils/ai-client'
import { useTavily } from '../utils/tavily-client'
import { useFirecrawl } from '../utils/firecrawl-client'
import { getConfig } from '../utils/server-config'
import { serverDeepResearch } from '../utils/deep-research'

export default defineEventHandler(async (event) => {
  const { initialQuery, feedback, depth, breadth, methodId } = await readBody(event)
  const config = getConfig()

  if (config.isDev) {
    console.log('[Research] Starting new research:', {
      methodId,
      depth,
      breadth,
      query: initialQuery,
      feedbackCount: feedback.length
    });
  }

  // Set SSE headers
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')

  const combinedQuery = `
Initial Query: ${initialQuery}
Follow-up Questions and Answers:
${feedback.map((qa: { question: string; answer: string }) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n')}
`

  if (config.isDev) {
    console.log('[Research] Combined query:', combinedQuery);
  }

  return new Promise<void>(async (resolve, reject) => {
    const onProgress = (data: ResearchStep) => {
      if (config.isDev) {
        switch (data.type) {
          case 'generating_query':
            console.log(`[Research] Generating query for node ${data.nodeId}`);
            break;
          case 'generated_query':
            console.log(`[Research] Generated query for node ${data.nodeId}:`, data.query);
            break;
          case 'searching':
            console.log(`[Research] Searching for node ${data.nodeId}:`, data.query);
            break;
          case 'search_complete':
            console.log(`[Research] Search complete for node ${data.nodeId}, found ${data.urls.length} URLs`);
            break;
          case 'processing_serach_result':
            console.log(`[Research] Processing results for node ${data.nodeId}:`, {
              learningsCount: data.result.learnings?.length || 0,
              questionsCount: data.result.followUpQuestions?.length || 0
            });
            break;
          case 'processed_search_result':
            console.log(`[Research] Processed results for node ${data.nodeId}:`, {
              learningsCount: data.result.learnings.length,
              questionsCount: data.result.followUpQuestions.length
            });
            break;
          case 'error':
            console.error(`[Research] Error in node ${data.nodeId}:`, data.message);
            break;
          case 'complete':
            console.log('[Research] Research complete:', {
              learningsCount: data.learnings.length,
              urlsCount: data.visitedUrls.length
            });
            break;
        }
      }
      // Send progress events
      event.node.res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    try {
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

      if (config.isDev) {
        console.log('[Research] Initial context:', {
          query: context.query,
          currentDate: context.currentDate
        });
      }

      // Get method-specific prompts
      const prompts = getResearchPrompts(methodId, context);

      if (config.isDev) {
        console.log('[Research] Using method:', {
          id: methodId,
          mainPromptLength: prompts.mainPrompt.length,
          hasFollowUp: !!prompts.followUpTemplate,
          hasLearning: !!prompts.learningTemplate
        });
      }

      const result = await serverDeepResearch({
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

      // Validate the final output
      const validation = validateMethodOutput(methodId, {
        sections: {
          LEARNINGS: {
            content: result.learnings,
            format: 'list',
            sourceRefs: result.visitedUrls.map(url => ({
              url,
              title: '',
              snippet: '',
              timestamp: new Date().toISOString()
            }))
          }
        }
      });

      if (config.isDev) {
        console.log('[Research] Final results:', {
          learningsCount: result.learnings.length,
          visitedUrlsCount: result.visitedUrls.length,
          isValid: validation.isValid,
          learnings: result.learnings
        });
      }

      resolve()
    } catch (error) {
      console.error('[Research] Error:', error)
      const errorStep: ResearchStep = {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        nodeId: '0',
      }
      onProgress(errorStep)

      if (config.isDev) {
        console.error('[Research] Full error details:', error);
      }

      resolve() // Resolve instead of reject to ensure the error is sent to the client
    }
  })
})
