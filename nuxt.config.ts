// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      // AI Provider Settings
      openaiKey: process.env.OPENAI_KEY || '',
      openaiEndpoint: process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1',
      openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
      contextSize: process.env.CONTEXT_SIZE || '128000',
      
      // Web Search Provider Settings
      defaultSearchProvider: process.env.DEFAULT_SEARCH_PROVIDER || '',
      
      // Tavily Settings
      tavilyKey: process.env.TAVILY_KEY || '',
      tavilyBaseUrl: process.env.TAVILY_BASE_URL || 'https://api.tavily.com',
      
      // Firecrawl Settings
      firecrawlKey: process.env.FIRECRAWL_KEY || '',
      firecrawlBaseUrl: process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev/v1',
    }
  },
  modules: ['@pinia/nuxt', '@nuxt/ui', '@nuxtjs/color-mode', '@vueuse/nuxt'],

  colorMode: {
    preference: 'system',
    dataValue: 'theme',
    classSuffix: '',
    storage: 'cookie',
  },

  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('js-tiktoken')) {
              return 'tiktoken'
            }
          },
        },
      },
    },
  },

  css: ['~/assets/css/main.css'],
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  
  // Development server configuration
  devServer: {
    host: '0.0.0.0',
  },

  // Add auto-import directories
  imports: {
    dirs: [
      'composables',
      'research-methods',
      'research-methods/methods'
    ]
  },
})
