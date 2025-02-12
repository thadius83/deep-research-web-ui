import { useRuntimeConfig } from '#imports'

const obfuscateEnvValue = () => '****ENV****'

export const useEnvConfig = () => {
  const runtimeConfig = useRuntimeConfig()

  // Simplified helper: do not trim—just check that a nonempty string was provided.
  const hasEnvVar = (value: string | undefined) => {
    if (!process.client) return false
    return typeof value === 'string' && value.length > 0
  }

  const config = {
    ai: {
      hasKey: hasEnvVar(runtimeConfig.public.openaiKey),
      hasEndpoint: hasEnvVar(runtimeConfig.public.openaiEndpoint),
      hasModel: hasEnvVar(runtimeConfig.public.openaiModel),
      hasContextSize: hasEnvVar(runtimeConfig.public.contextSize),
      getKey: () => runtimeConfig.public.openaiKey || '',
      getEndpoint: () => runtimeConfig.public.openaiEndpoint || 'https://api.openai.com/v1',
      getModel: () => runtimeConfig.public.openaiModel || 'gpt-4o',
      getContextSize: () => Number(runtimeConfig.public.contextSize) || 128000,
      getObfuscatedKey: () =>
        hasEnvVar(runtimeConfig.public.openaiKey) ? obfuscateEnvValue() : '',
    },
    webSearch: {
      hasProvider: hasEnvVar(runtimeConfig.public.defaultSearchProvider),
      getProvider: () =>
        (runtimeConfig.public.defaultSearchProvider as 'tavily' | 'firecrawl') || 'firecrawl',
      tavily: {
        hasKey: hasEnvVar(runtimeConfig.public.tavilyKey),
        hasBaseUrl: hasEnvVar(runtimeConfig.public.tavilyBaseUrl),
        getKey: () => runtimeConfig.public.tavilyKey || '',
        getBaseUrl: () =>
          runtimeConfig.public.tavilyBaseUrl || 'https://api.tavily.com',
        getObfuscatedKey: () =>
          hasEnvVar(runtimeConfig.public.tavilyKey) ? obfuscateEnvValue() : '',
      },
      firecrawl: {
        hasKey: hasEnvVar(runtimeConfig.public.firecrawlKey),
        hasBaseUrl: hasEnvVar(runtimeConfig.public.firecrawlBaseUrl),
        getKey: () => runtimeConfig.public.firecrawlKey || '',
        getBaseUrl: () =>
          runtimeConfig.public.firecrawlBaseUrl || 'https://api.firecrawl.dev/v1',
        getObfuscatedKey: () =>
          hasEnvVar(runtimeConfig.public.firecrawlKey) ? obfuscateEnvValue() : '',
      },
    },
  }

  return config
}
