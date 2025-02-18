import { streamText } from 'ai'
import { compact } from 'lodash-es'
import pLimit from 'p-limit'
import { z } from 'zod'
import zodToJsonSchema from 'zod-to-json-schema'
import { type TavilySearchResponse } from '@tavily/core'
import { type SearchResponse as FirecrawlSearchResponse } from '@mendable/firecrawl-js'
import { logger } from '../utils/logger'
import type { FirecrawlResponse, FirecrawlResult } from '~/server/utils/firecrawl-client'
import type { ResearchContext } from '~/research-methods/types'
import { parseStreamingJson, type DeepPartial } from '~/utils/json'
import { trimPrompt } from './ai/providers'
import { systemPrompt } from './prompt'
import { useAiModel } from '~/composables/useAiProvider'
import { getMethodById } from '~/research-methods'
import { ExtractInfoMethod } from '~/research-methods/methods/extract-info'
import { isUrlQuery, extractUrls, isMultiUrlQuery } from '~/utils/url'
import { useServerSearch } from '~/composables/useServerSearch'

export type ResearchResult = {
  learnings: string[]
  visitedUrls: string[]
}

export interface WriteFinalReportParams {
  prompt: string
  learnings: string[]
  methodId: string
  visitedUrls: string[]
  currentDate: string
}

// Used for streaming response
export type SearchQuery = z.infer<typeof searchQueriesTypeSchema>['queries'][0]
export type PartialSearchQuery = DeepPartial<SearchQuery>

interface TavilyResult {
  url: string
  content: string
  title: string
  score: number
}

interface TavilyResponse {
  results: TavilyResult[]
}

type WebSearchResult = TavilyResponse | FirecrawlResponse

function isTavilyResponse(response: any): response is TavilyResponse {
  return 'results' in response && Array.isArray(response.results)
}

function isFirecrawlResponse(response: any): response is FirecrawlResponse {
  return 'data' in response && Array.isArray(response.data) && response.data.every((item: any) => 
    typeof item.url === 'string' && 
    typeof item.markdown === 'string' && 
    (!item.metadata || typeof item.metadata === 'object')
  )
}

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
  | { type: 'classifying_content'; query: string; nodeId: string }
  | { type: 'classified_content'; 
      query: string; 
      nodeId: string;
      classification: {
        type: ContentType;
        confidence: 'high' | 'medium' | 'low';
        metadata: {
          contentType?: string;
          audience?: string;
        }
      }
      rawResponse: string;
    }
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

// Function to generate search queries
export function generateSearchQueries({
  query,
  numQueries = 3,
  learnings,
}: {
  query: string
  numQueries?: number
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

  logger.debug(`[Generate Search Queries] Query: ${query}, Max Queries: ${numQueries}, Previous Learnings: ${learnings?.length || 0}`);

  return streamText({
    model: useAiModel(),
    system: systemPrompt(),
    prompt,
  })
}

// Function to process search results
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

  // Extract content safely with type checking
  const contents = isTavilyResponse(result)
    ? compact(result.results.map(item => item.content))
    : isFirecrawlResponse(result)
      ? compact(result.data.map(item => item.markdown))
      : []

  const trimmedContents = contents.map(content => trimPrompt(content, 50_000))

  const prompt = [
    `Given the following contents from a SERP search for the query <query>${query}</query>, generate a list of learnings from the contents. Return a maximum of ${numLearnings} learnings, but feel free to return less if the contents are clear. Make sure each learning is unique and not similar to each other. The learnings should be concise and to the point, as detailed and information dense as possible. Make sure to include any entities like people, places, companies, products, things, etc in the learnings, as well as any exact metrics, numbers, or dates. The learnings will be used to research the topic further.`,
    `<contents>${trimmedContents
      .map((content) => `<content>\n${content}\n</content>`)
      .join('\n')}</contents>`,
    `You MUST respond in JSON with the following schema: ${jsonSchema}`,
  ].join('\n\n')

  logger.debug(`[Process Search Result] Query: ${query}, Content Count: ${contents.length}`);

  return streamText({
    model: useAiModel(),
    abortSignal: AbortSignal.timeout(60_000),
    system: systemPrompt(),
    prompt,
  })
}

export async function writeFinalReport({
  prompt,
  learnings,
  methodId,
  currentDate,
}: WriteFinalReportParams) {
  const method = getMethodById(methodId);
  const learningsString = trimPrompt(
    learnings
      .map((learning) => `<learning>\n${learning}\n</learning>`)
      .join('\n'),
    300_000,
  )

  const context: ResearchContext = {
    query: prompt,
    searchResults: [],
    sources: [],
    currentDate,
    learnings,
  };

  const formattedPrompt = await method.formatInput(context);

  const _prompt = [
    `Given the following prompt from the user, write a final report following the specific format for this research method:`,
    `<prompt>${prompt}</prompt>`,
    `Here are all the learnings from the research:`,
    `<learnings>\n${learningsString}\n</learnings>`,
    formattedPrompt,
    `Write the report in Markdown following this method's specific structure and requirements.`,
    `## Deep Research Report`,
  ].join('\n\n')

  logger.debug(`[Final Report Generation] Method ID: ${methodId}, User prompt: ${prompt}, Number of learnings: ${learnings.length}`);

  const response = await streamText({
    model: useAiModel(),
    system: systemPrompt(),
    prompt: _prompt,
  })
  return response.textStream
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
    // Check if query contains URLs
    if (isUrlQuery(query)) {
      const urls = extractUrls(query)
      if (urls.length > 0) {
        logger.debug(`[Research] Direct URL scraping: ${urls.join(', ')}`)
        // Use server search endpoint for scraping
        const search = useServerSearch()
        const scrapeResults = await Promise.all(
          urls.map(url => 
            search.scrape(url, {
              formats: ['markdown'],
              onlyMainContent: true,
              waitFor: 3000,
              removeBase64Images: true,
              timeout: 30000
            })
          )
        )

        // Combine results and preserve metadata
        const combinedResult: FirecrawlResponse = {
          success: true,
          data: scrapeResults.flatMap(result => result.data.map(item => ({
            url: item.url || '',
            markdown: item.markdown || '',
            metadata: {
              ...item.metadata,
              sourceURL: item.url || '', // Ensure sourceURL is set for metadata tracking
              title: item.metadata?.title || '',
              description: item.metadata?.description || '',
              language: item.metadata?.language || 'en',
              contentType: item.metadata?.contentType || 'article'
            },
            actions: []
          })))
        }

        // Classify content before processing
        onProgress({
          type: 'classifying_content',
          query: isMultiUrlQuery(query) ? 'Multi-URL Analysis' : urls[0],
          nodeId,
        })

        const method = getMethodById('extract-info') as ExtractInfoMethod;
        const classificationResult = await method.classifyContent(
          isMultiUrlQuery(query) ? 'Multi-URL Analysis' : urls[0],
          combinedResult.data.map(item => item.markdown).join('\n\n')
        );

        onProgress({
          type: 'classified_content',
          query: isMultiUrlQuery(query) ? 'Multi-URL Analysis' : urls[0],
          nodeId,
          classification: {
            type: classificationResult.primaryType,
            confidence: classificationResult.confidence,
            metadata: {
              contentType: classificationResult.metadata.contentType,
              audience: classificationResult.metadata.audience,
            }
          },
          rawResponse: JSON.stringify(classificationResult, null, 2)
        });

        // Process combined results
        const searchResultGenerator = processSearchResult({
          query: isMultiUrlQuery(query) ? 'Multi-URL Analysis' : urls[0],
          result: combinedResult,
          numFollowUpQuestions: 0, // No follow-up questions for direct URLs
        })

        let searchResult: PartialProcessedResult = {}
        for await (const parsedLearnings of parseStreamingJson(
          searchResultGenerator.textStream,
          searchResultTypeSchema,
          (value) => !!value.learnings?.length,
        )) {
          searchResult = parsedLearnings
        }

        onProgress({
          type: 'complete',
          learnings: searchResult.learnings || [],
          visitedUrls: urls
        })

        return {
          learnings: searchResult.learnings || [],
          visitedUrls: urls
        }
      }
    }

    // Regular search process for non-URL queries
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
            const search = useServerSearch()

            // Use server search endpoint
            const searchResponse = await search.search(searchQuery.query, {
              limit: 5,
              timeout: 15000,
              scrapeOptions: { 
                formats: ['markdown'],
                onlyMainContent: true,
                waitFor: 3000,
                removeBase64Images: true,
              },
            })

            // Convert response to FirecrawlResponse format
            const result: FirecrawlResponse = isTavilyResponse(searchResponse)
              ? {
                  success: true,
                  data: searchResponse.results.map(item => ({
                    url: item.url || '',
                    markdown: item.content || '',
                    metadata: {
                      title: item.title || '',
                      description: '',  // Tavily doesn't provide snippets
                      sourceURL: item.url || '',
                      contentType: 'article', // Default for Tavily results
                      language: 'en' // Default language
                    },
                    actions: []
                  }))
                }
              : isFirecrawlResponse(searchResponse)
                ? searchResponse
                : {
                    success: false,
                    data: [],
                    error: 'Invalid response format'
                  }

            // Extract URLs safely with type checking
            const newUrls = isTavilyResponse(searchResponse)
              ? compact(searchResponse.results.map(item => item.url))
              : isFirecrawlResponse(searchResponse)
                ? compact(searchResponse.data.map(item => item.url))
                : []

            onProgress({
              type: 'search_complete',
              urls: newUrls,
              nodeId: childNodeId(nodeId, i),
            })

            // Classify content before processing
            onProgress({
              type: 'classifying_content',
              query: searchQuery.query,
              nodeId: childNodeId(nodeId, i),
            })

            const method = getMethodById('extract-info') as ExtractInfoMethod;
            const classificationResult = await method.classifyContent(searchQuery.query, result.data.map(item => item.markdown).join('\n\n'));

            onProgress({
              type: 'classified_content',
              query: searchQuery.query,
              nodeId: childNodeId(nodeId, i),
              classification: {
                type: classificationResult.primaryType,
                confidence: classificationResult.confidence,
                metadata: {
                  contentType: classificationResult.metadata.contentType,
                  audience: classificationResult.metadata.audience,
                }
              },
              rawResponse: JSON.stringify(classificationResult, null, 2)
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
            logger.debug(`[Research] Processed search result for ${searchQuery.query}: ${JSON.stringify(searchResult, null, 2)}`);
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
              logger.debug(`[Research] Researching deeper, breadth: ${nextBreadth}, depth: ${nextDepth}`);

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
    logger.error(`[Research] Error: ${error}`);
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
