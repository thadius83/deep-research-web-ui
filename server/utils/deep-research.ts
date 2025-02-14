import { compact } from 'lodash-es'
import pLimit from 'p-limit'
import { z } from 'zod'
import { parseStreamingJson, type DeepPartial } from '~/utils/json'
import { trimPrompt } from '~/lib/ai/providers'
import { systemPrompt } from '~/lib/prompt'
import zodToJsonSchema from 'zod-to-json-schema'
import { getConfig } from './server-config'
import { logger } from '../../utils/logger'

// Define a common interface for search results
interface SearchResult {
  url: string
  content?: string
  markdown?: string
}

interface SearchResponse {
  results?: SearchResult[]
  data?: SearchResult[]
}

export type ResearchResult = {
  learnings: string[]
  visitedUrls: string[]
}

export type SearchQuery = z.infer<typeof searchQueriesTypeSchema>['queries'][0]
export type PartialSearchQuery = DeepPartial<SearchQuery>

interface ProcessedSearchResult {
  learnings: string[]
  followUpQuestions: string[]
}

export type PartialProcessedResult = DeepPartial<ProcessedSearchResult>

export type ResearchStep =
  | { type: 'generating_query'; result: PartialSearchQuery; nodeId: string }
  | { type: 'generated_query'; query: string; result: PartialSearchQuery; nodeId: string }
  | { type: 'searching'; query: string; nodeId: string }
  | { type: 'search_complete'; urls: string[]; nodeId: string }
  | { type: 'processing_serach_result'; query: string; result: PartialProcessedResult; nodeId: string }
  | { type: 'processed_search_result'; query: string; result: ProcessedSearchResult; nodeId: string }
  | { type: 'error'; message: string; nodeId: string }
  | { type: 'complete'; learnings: string[]; visitedUrls: string[] }

const ConcurrencyLimit = 2

export const searchQueriesTypeSchema = z.object({
  queries: z.array(
    z.object({
      query: z.string(),
      researchGoal: z.string(),
    }),
  ),
})

export const searchResultTypeSchema = z.object({
  learnings: z.array(z.string()),
  followUpQuestions: z.array(z.string()),
})

interface ResearchPrompts {
  mainPrompt: string;
  followUpTemplate: string;
  learningTemplate: string;
}

interface Clients {
  ai: {
    streamText: (params: { prompt: string; system?: string; model?: string; abortSignal?: AbortSignal }) => Promise<{ textStream: AsyncGenerator<string, void, unknown> }>
  }
  search: {
    search: (query: string, params: any) => Promise<SearchResponse>
  }
}

export async function serverDeepResearch({
  query,
  breadth,
  maxDepth,
  learnings = [],
  visitedUrls = [],
  onProgress,
  currentDepth = 1,
  nodeId = '0',
  clients,
  prompts,
}: {
  query: string
  breadth: number
  maxDepth: number
  learnings?: string[]
  visitedUrls?: string[]
  onProgress: (step: ResearchStep) => void
  currentDepth?: number
  nodeId?: string
  clients: Clients;
  prompts: ResearchPrompts;
}): Promise<ResearchResult> {
  try {
    const config = getConfig()
    if (config.isDev) {
      logger.debug(`[Research] Starting depth ${currentDepth}, node ${nodeId}`);
      logger.debug(`[Research] Input: ${JSON.stringify({
        query,
        breadth,
        maxDepth,
        learningsCount: learnings.length,
        urlsCount: visitedUrls.length
      }, null, 2)}`);
      logger.debug(`[Research] Prompts: ${JSON.stringify({
        mainPromptLength: prompts.mainPrompt.length,
        hasFollowUp: !!prompts.followUpTemplate,
        hasLearning: !!prompts.learningTemplate
      }, null, 2)}`);
    }

    const schema = z.object({
      queries: z
        .array(
          z.object({
            query: z.string().describe('The SERP query'),
            researchGoal: z
              .string()
              .describe(
                'First talk about the goal of the research that this query is meant to accomplish, then go deeper into how to advance the research once the results are found, mention additional research directions. Be as specific as possible, especially for additional research directions.',
              ),
          }),
        )
        .describe(`List of SERP queries, max of ${breadth}`),
    })
    const jsonSchema = JSON.stringify(zodToJsonSchema(schema))

    const prompt = prompts.mainPrompt

    if (config.isDev) {
      logger.debug('[LLM] Starting search query generation');
      logger.debug(`[LLM] System Prompt: ${systemPrompt()}`);
      logger.debug(`[LLM] User Prompt: ${prompt}`);
      logger.debug(`[LLM] JSON Schema: ${jsonSchema}`);
    }

    const searchQueriesResult = await clients.ai.streamText({
      prompt,
      system: systemPrompt(),
    })

    let searchQueries: PartialSearchQuery[] = []

    for await (const parsedQueries of parseStreamingJson(
      searchQueriesResult.textStream,
      searchQueriesTypeSchema,
      (value) => !!value.queries?.length && !!value.queries[0]?.query,
    )) {
      if (parsedQueries.queries) {
      if (config.isDev) {
        logger.debug(`[Research] Generated queries: ${JSON.stringify(parsedQueries.queries, null, 2)}`);
        logger.debug('[LLM] Query generation complete');
      }

        for (let i = 0; i < searchQueries.length; i++) {
          onProgress({
            type: 'generating_query',
            result: searchQueries[i],
            nodeId: childNodeId(nodeId, i),
          })
        }
        searchQueries = parsedQueries.queries
      }
    }

    for (let i = 0; i < searchQueries.length; i++) {
      onProgress({
        type: 'generated_query',
        query,
        result: searchQueries[i],
        nodeId: childNodeId(nodeId, i),
      })
    }

    const limiter = pLimit(ConcurrencyLimit)
    const results = await Promise.all(
      searchQueries.map((searchQuery, i) =>
        limiter(async () => {
          if (!searchQuery?.query)
            return {
              learnings: [],
              visitedUrls: [],
            }

          if (config.isDev) {
            logger.debug(`[Research] Processing query ${i + 1}: ${JSON.stringify({
              query: searchQuery.query,
              goal: searchQuery.researchGoal
            }, null, 2)}`);
          }

          onProgress({
            type: 'searching',
            query: searchQuery.query,
            nodeId: childNodeId(nodeId, i),
          })
          try {
            const result = await clients.search.search(searchQuery.query, {
              maxResults: 5,
              limit: 5,
              timeout: 15000,
              scrapeOptions: { 
                formats: ['markdown'],
                onlyMainContent: true,
                waitFor: 3000,
                removeBase64Images: true,
              },
            })

            const newUrls = compact(
              result.results
                ? result.results.map((item) => item.url)
                : result.data?.map((item) => item.url) || []
            )

            if (config.isDev) {
              logger.debug(`[Research] Search results: ${JSON.stringify({
                query: searchQuery.query,
                urlsFound: newUrls.length
              }, null, 2)}`);
            }

            onProgress({
              type: 'search_complete',
              urls: newUrls,
              nodeId: childNodeId(nodeId, i),
            })

            const nextBreadth = Math.ceil(breadth / 2)
            const contents = compact(
              result.results
                ? result.results.map((item) => item.content || '')
                : result.data?.map((item) => item.markdown || '') || []
            ).map((content) => trimPrompt(content, 50_000))

            // Create context for processing search results
            const searchContext = {
              query: searchQuery.query,
              searchResults: contents.map((content) => `<content>\n${content}\n</content>`).join('\n'),
              sources: result.results || result.data || [],
              currentDate: new Date().toISOString(),
              learnings: learnings,
            };

            if (config.isDev) {
              logger.debug(`[Research] Processing context: ${JSON.stringify({
                query: searchContext.query,
                resultsCount: contents.length,
                sourcesCount: searchContext.sources.length,
                learningsCount: searchContext.learnings.length
              }, null, 2)}`);
            }

            const processPrompt = prompts.mainPrompt

            const searchResultGenerator = await clients.ai.streamText({
              prompt: processPrompt,
              system: systemPrompt(),
              abortSignal: AbortSignal.timeout(60_000),
            })

            let searchResult: PartialProcessedResult = {}

            for await (const parsedLearnings of parseStreamingJson(
              searchResultGenerator.textStream,
              searchResultTypeSchema,
              (value) => !!value.learnings?.length,
            )) {
              searchResult = parsedLearnings
              if (config.isDev) {
                logger.debug(`[Research] Processed results: ${JSON.stringify({
                  learningsCount: parsedLearnings.learnings?.length || 0,
                  questionsCount: parsedLearnings.followUpQuestions?.length || 0
                }, null, 2)}`);
              }

              onProgress({
                type: 'processing_serach_result',
                result: parsedLearnings,
                query: searchQuery.query,
                nodeId: childNodeId(nodeId, i),
              })
            }

            const allLearnings = [
              ...learnings,
              ...(searchResult.learnings ?? []),
            ]
            const allUrls = [...visitedUrls, ...newUrls]
            const nextDepth = currentDepth + 1

            onProgress({
              type: 'processed_search_result',
              result: {
                learnings: allLearnings,
                followUpQuestions: searchResult.followUpQuestions ?? [],
              },
              query: searchQuery.query,
              nodeId: childNodeId(nodeId, i),
            })

            if (
              nextDepth < maxDepth &&
              searchResult.followUpQuestions?.length
            ) {
              const nextQuery = `
              Previous research goal: ${searchQuery.researchGoal}
              Follow-up research directions: ${searchResult.followUpQuestions
                .map((q: string) => `\n${q}`)
                .join('')}
            `.trim()

              if (config.isDev) {
                logger.debug(`[Research] Next iteration: ${JSON.stringify({
                  nextQuery,
                  nextDepth,
                  nextBreadth
                }, null, 2)}`);
              }

              return serverDeepResearch({
                query: nextQuery,
                breadth: nextBreadth,
                maxDepth,
                learnings: allLearnings,
                visitedUrls: allUrls,
                onProgress,
                currentDepth: nextDepth,
                nodeId: childNodeId(nodeId, i),
                clients,
                prompts,
              })
            } else {
              if (config.isDev) {
                logger.debug(`[Research] Branch complete: ${JSON.stringify({
                  learningsCount: allLearnings.length,
                  urlsCount: allUrls.length
                }, null, 2)}`);
              }
              return {
                learnings: allLearnings,
                visitedUrls: allUrls,
              }
            }
          } catch (e: any) {
              if (config.isDev) {
              logger.error(`[Research] Branch error: ${e}`);
            }
            throw new Error(
              `Error searching for ${searchQuery.query}, depth ${currentDepth}\nMessage: ${e.message}`,
            )
          }
        }),
      ),
    )

    const _learnings = [...new Set(results.flatMap((r: ResearchResult) => r.learnings))]
    const _visitedUrls = [...new Set(results.flatMap((r: ResearchResult) => r.visitedUrls))]

    if (nodeId === '0') {
      if (config.isDev) {
        logger.debug(`[Research] Final results: ${JSON.stringify({
          totalLearnings: _learnings.length,
          totalUrls: _visitedUrls.length,
          learnings: _learnings
        }, null, 2)}`);
      }

      onProgress({
        type: 'complete',
        learnings: _learnings,
        visitedUrls: _visitedUrls,
      })
    }

    return {
      learnings: _learnings,
      visitedUrls: _visitedUrls,
    }
  } catch (error: any) {
    const config = getConfig()
    logger.error(`[Research] Error: ${error}`);
    onProgress({
      type: 'error',
      message: error?.message ?? 'Something went wrong',
      nodeId,
    })

    if (config.isDev) {
      logger.error(`[Research] Full error details: ${JSON.stringify(error, null, 2)}`);
    }

    return {
      learnings: [],
      visitedUrls: [],
    }
  }
}

function childNodeId(parentNodeId: string, currentIndex: number) {
  return `${parentNodeId}-${currentIndex}`
}
