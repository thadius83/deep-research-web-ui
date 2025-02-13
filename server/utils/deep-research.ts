import { compact } from 'lodash-es'
import pLimit from 'p-limit'
import { z } from 'zod'
import { parseStreamingJson, type DeepPartial } from '~/utils/json'
import { trimPrompt } from '~/lib/ai/providers'
import { systemPrompt } from '~/lib/prompt'
import zodToJsonSchema from 'zod-to-json-schema'

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
}: {
  query: string
  breadth: number
  maxDepth: number
  learnings?: string[]
  visitedUrls?: string[]
  onProgress: (step: ResearchStep) => void
  currentDepth?: number
  nodeId?: string
  clients: Clients
}): Promise<ResearchResult> {
  try {
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

    const now = new Date().toISOString()
    const prompt = [
      `Today is ${now}. Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of ${breadth} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other: <prompt>${query}</prompt>\n\n`,
      learnings
        ? `Here are some learnings from previous research, use them to generate more specific queries: ${learnings.join(
            '\n',
          )}`
        : '',
      `You MUST respond in JSON with the following schema: ${jsonSchema}`,
    ].join('\n\n')

    const searchQueriesResult = await clients.ai.streamText({
      prompt,
      system: systemPrompt(),
    })

    const limit = pLimit(ConcurrencyLimit)
    let searchQueries: PartialSearchQuery[] = []

    for await (const parsedQueries of parseStreamingJson(
      searchQueriesResult.textStream,
      searchQueriesTypeSchema,
      (value) => !!value.queries?.length && !!value.queries[0]?.query,
    )) {
      if (parsedQueries.queries) {
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

    const results = await Promise.all(
      searchQueries.map((searchQuery, i) =>
        limit(async () => {
          if (!searchQuery?.query)
            return {
              learnings: [],
              visitedUrls: [],
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
            ).map((content) => trimPrompt(content, 25_000))

            const processPrompt = [
              `Today is ${now}. Given the following contents from a SERP search for the query <query>${searchQuery.query}</query>, generate a list of learnings from the contents. Return a maximum of 5 learnings, but feel free to return less if the contents are clear. Make sure each learning is unique and not similar to each other. The learnings should be concise and to the point, as detailed and information dense as possible. Make sure to include any entities like people, places, companies, products, things, etc in the learnings, as well as any exact metrics, numbers, or dates. The learnings will be used to research the topic further.`,
              `<contents>${contents
                .map((content) => `<content>\n${content}\n</content>`)
                .join('\n')}</contents>`,
              `You MUST respond in JSON with the following schema: ${JSON.stringify(zodToJsonSchema(searchResultTypeSchema))}`,
            ].join('\n\n')

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
              })
            } else {
              return {
                learnings: allLearnings,
                visitedUrls: allUrls,
              }
            }
          } catch (e: any) {
            throw new Error(
              `Error searching for ${searchQuery.query}, depth ${currentDepth}\nMessage: ${e.message}`,
            )
          }
        }),
      ),
    )

    const _learnings = [...new Set(results.flatMap((r) => r.learnings))]
    const _visitedUrls = [...new Set(results.flatMap((r) => r.visitedUrls))]

    if (nodeId === '0') {
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
    console.error(error)
    onProgress({
      type: 'error',
      message: error?.message ?? 'Something went wrong',
      nodeId,
    })
    return {
      learnings: [],
      visitedUrls: [],
    }
  }
}

function childNodeId(parentNodeId: string, currentIndex: number) {
  return `${parentNodeId}-${currentIndex}`
}
