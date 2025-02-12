import { streamText } from 'ai'
import { compact } from 'lodash-es'
import pLimit from 'p-limit'
import { z } from 'zod'
import { parseStreamingJson, type DeepPartial } from '~/utils/json'

import { trimPrompt } from './ai/providers'
import { systemPrompt } from './prompt'
import zodToJsonSchema from 'zod-to-json-schema'
import { type TavilySearchResponse } from '@tavily/core'
import { type SearchResponse as FirecrawlSearchResponse } from '@mendable/firecrawl-js'
import { useTavily } from '~/composables/useTavily'
import { useFirecrawl } from '~/composables/useFirecrawl'
import { useConfigStore } from '~/stores/config'
import { useAiModel } from '~/composables/useAiProvider'

export type ResearchResult = {
  learnings: string[]
  visitedUrls: string[]
}

export interface WriteFinalReportParams {
  prompt: string
  learnings: string[]
}

// Used for streaming response
export type SearchQuery = z.infer<typeof searchQueriesTypeSchema>['queries'][0]
export type PartialSearchQuery = DeepPartial<SearchQuery>

type WebSearchResult = TavilySearchResponse | FirecrawlSearchResponse

interface ProcessedSearchResult {
  learnings: string[]
  followUpQuestions: string[]
}

export type PartialProcessedResult = DeepPartial<ProcessedSearchResult>

export type ResearchStep =
  | { type: 'generating_query'; result: PartialSearchQuery; nodeId: string }
  | {
      type: 'generated_query'
      query: string
      result: PartialSearchQuery
      nodeId: string
    }
  | { type: 'searching'; query: string; nodeId: string }
  | { type: 'search_complete'; urls: string[]; nodeId: string }
  | {
      type: 'processing_serach_result'
      query: string
      result: PartialProcessedResult
      nodeId: string
    }
  | {
      type: 'processed_search_result'
      query: string
      result: ProcessedSearchResult
      nodeId: string
    }
  | { type: 'error'; message: string; nodeId: string }
  | { type: 'complete'; learnings: string[]; visitedUrls: string[] }

// increase this if you have higher API rate limits
const ConcurrencyLimit = 2

/**
 * Schema for {@link generateSearchQueries} without dynamic descriptions
 */
export const searchQueriesTypeSchema = z.object({
  queries: z.array(
    z.object({
      query: z.string(),
      researchGoal: z.string(),
    }),
  ),
})

// take en user query, return a list of SERP queries
export function generateSearchQueries({
  query,
  numQueries = 3,
  learnings,
}: {
  query: string
  numQueries?: number
  // optional, if provided, the research will continue from the last learning
  learnings?: string[]
}) {
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
      .describe(`List of SERP queries, max of ${numQueries}`),
  })
  const jsonSchema = JSON.stringify(zodToJsonSchema(schema))

  const prompt = [
    `Given the following prompt from the user, generate a list of SERP queries to research the topic. Return a maximum of ${numQueries} queries, but feel free to return less if the original prompt is clear. Make sure each query is unique and not similar to each other: <prompt>${query}</prompt>\n\n`,
    learnings
      ? `Here are some learnings from previous research, use them to generate more specific queries: ${learnings.join(
          '\n',
        )}`
      : '',
    `You MUST respond in JSON with the following schema: ${jsonSchema}`,
  ].join('\n\n')
  return streamText({
    model: useAiModel(),
    system: systemPrompt(),
    prompt,
  })
}

export const searchResultTypeSchema = z.object({
  learnings: z.array(z.string()),
  followUpQuestions: z.array(z.string()),
})

function processSearchResult({
  query,
  result,
  numLearnings = 5,
  numFollowUpQuestions = 3,
}: {
  query: string
  result: WebSearchResult
  numLearnings?: number
  numFollowUpQuestions?: number
}) {
  const schema = z.object({
    learnings: z
      .array(z.string())
      .describe(`List of learnings, max of ${numLearnings}`),
    followUpQuestions: z
      .array(z.string())
      .describe(
        `List of follow-up questions to research the topic further, max of ${numFollowUpQuestions}`,
      ),
  })
  const jsonSchema = JSON.stringify(zodToJsonSchema(schema))
  const contents = compact(
    'results' in result
      ? result.results.map((item) => item.content)
      : result.data.map((item) => item.markdown)
  ).map((content) => trimPrompt(content, 25_000))
  const prompt = [
    `Given the following contents from a SERP search for the query <query>${query}</query>, generate a list of learnings from the contents. Return a maximum of ${numLearnings} learnings, but feel free to return less if the contents are clear. Make sure each learning is unique and not similar to each other. The learnings should be concise and to the point, as detailed and information dense as possible. Make sure to include any entities like people, places, companies, products, things, etc in the learnings, as well as any exact metrics, numbers, or dates. The learnings will be used to research the topic further.`,
    `<contents>${contents
      .map((content) => `<content>\n${content}\n</content>`)
      .join('\n')}</contents>`,
    `You MUST respond in JSON with the following schema: ${jsonSchema}`,
  ].join('\n\n')

  return streamText({
    model: useAiModel(),
    abortSignal: AbortSignal.timeout(60_000),
    system: systemPrompt(),
    prompt,
  })
}

export function writeFinalReport({
  prompt,
  learnings,
}: WriteFinalReportParams) {
  const learningsString = trimPrompt(
    learnings
      .map((learning) => `<learning>\n${learning}\n</learning>`)
      .join('\n'),
    150_000,
  )
  const _prompt = [
    `Given the following prompt from the user, write a final report on the topic using the learnings from research. Make it as as detailed as possible, aim for 6 or more pages, include ALL the learnings from research:`,
    `<prompt>${prompt}</prompt>`,
    `Here are all the learnings from previous research:`,
    `<learnings>\n${learningsString}\n</learnings>`,
    `Write the report in Markdown.`,
    `## Deep Research Report`,
  ].join('\n\n')

  return streamText({
    model: useAiModel(),
    system: systemPrompt(),
    prompt: _prompt,
  })
}

function childNodeId(parentNodeId: string, currentIndex: number) {
  return `${parentNodeId}-${currentIndex}`
}

export async function deepResearch({
  query,
  breadth,
  maxDepth,
  learnings = [],
  visitedUrls = [],
  onProgress,
  currentDepth = 1,
  nodeId = '0',
}: {
  query: string
  breadth: number
  maxDepth: number
  learnings?: string[]
  visitedUrls?: string[]
  onProgress: (step: ResearchStep) => void
  currentDepth?: number
  nodeId?: string
}): Promise<ResearchResult> {
  try {
    const searchQueriesResult = generateSearchQueries({
      query,
      learnings,
      numQueries: breadth,
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
            const config = useConfigStore()
            let result: WebSearchResult
            let newUrls: string[] = []

            if (config.config.webSearch.provider === 'tavily') {
              result = await useTavily().search(searchQuery.query, {
                maxResults: 5,
              })
              console.log(
                `[Tavily] Ran ${searchQuery.query}, found ${result.results.length} contents`,
              )
              newUrls = compact(result.results.map((item) => item.url))
            } else {
              result = await useFirecrawl().search(searchQuery.query, {
                timeout: 15000,
                limit: 5,
                scrapeOptions: { 
                  formats: ['markdown'],
                  onlyMainContent: true,
                  waitFor: 3000,
                  removeBase64Images: true,
                },
              })
              console.log(
                `[Firecrawl] Ran ${searchQuery.query}, found ${result.data.length} contents`,
              )
              newUrls = compact(result.data.map((item) => item.url))
            }
            onProgress({
              type: 'search_complete',
              urls: newUrls,
              nodeId: childNodeId(nodeId, i),
            })
            // Breadth for the next search is half of the current breadth
            const nextBreadth = Math.ceil(breadth / 2)

            const searchResultGenerator = processSearchResult({
              query: searchQuery.query,
              result,
              numFollowUpQuestions: nextBreadth,
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
            console.log(
              `Processed search result for ${searchQuery.query}`,
              searchResult,
            )
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
              console.warn(
                `Researching deeper, breadth: ${nextBreadth}, depth: ${nextDepth}`,
              )

              const nextQuery = `
              Previous research goal: ${searchQuery.researchGoal}
              Follow-up research directions: ${searchResult.followUpQuestions
                .map((q: string) => `\n${q}`)
                .join('')}
            `.trim()

              return deepResearch({
                query: nextQuery,
                breadth: nextBreadth,
                maxDepth,
                learnings: allLearnings,
                visitedUrls: allUrls,
                onProgress,
                currentDepth: nextDepth,
                nodeId: childNodeId(nodeId, i),
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
    // Conclude results
    const _learnings = [...new Set(results.flatMap((r) => r.learnings))]
    const _visitedUrls = [...new Set(results.flatMap((r) => r.visitedUrls))]
    // Complete should only be called once
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
