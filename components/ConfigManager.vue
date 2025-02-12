<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfigStore } from '@/stores/config'

const showModal = ref(false)
const store = useConfigStore()
const runtimeConfig = useRuntimeConfig()

// Get reactive references to store state
const { config } = storeToRefs(store)

// Use a computed property for the provider that reads from the reactive ref
const provider = computed({
  get: () => config.value.webSearch.provider,
  set: (value: 'tavily' | 'firecrawl') => {
    console.log('Updating provider to:', value)
    store.updateProvider(value)
  }
})

// Environment variable indicators
const isApiKeyFromEnv = computed(() => !!runtimeConfig.public.openaiKey)
const isEndpointFromEnv = computed(() => 
  !!runtimeConfig.public.openaiEndpoint && 
  runtimeConfig.public.openaiEndpoint !== 'https://api.openai.com/v1'
)
const isModelFromEnv = computed(() => 
  !!runtimeConfig.public.openaiModel && 
  runtimeConfig.public.openaiModel !== 'gpt-4o'
)
const isContextSizeFromEnv = computed(() => 
  !!runtimeConfig.public.contextSize && 
  runtimeConfig.public.contextSize !== '128000'
)

// The computed to check if the env var forces provider was already updated
const isWebSearchProviderFromEnv = computed(() => {
  return typeof runtimeConfig.public.defaultSearchProvider === 'string' &&
         runtimeConfig.public.defaultSearchProvider.length > 0 &&
         runtimeConfig.public.defaultSearchProvider !== 'firecrawl'
})
const isTavilyKeyFromEnv = computed(() => !!runtimeConfig.public.tavilyKey)
const isFirecrawlKeyFromEnv = computed(() => !!runtimeConfig.public.firecrawlKey)

// Base URL environment checks with debug logs
const isTavilyBaseUrlFromEnv = computed(() => {
  const hasCustomUrl = !!runtimeConfig.public.tavilyBaseUrl && 
                      runtimeConfig.public.tavilyBaseUrl !== 'https://api.tavily.com'
  console.log('Tavily base URL env check:', {
    url: runtimeConfig.public.tavilyBaseUrl,
    hasCustom: hasCustomUrl
  })
  return hasCustomUrl
})

const isFirecrawlBaseUrlFromEnv = computed(() => {
  const hasCustomUrl = !!runtimeConfig.public.firecrawlBaseUrl && 
                      runtimeConfig.public.firecrawlBaseUrl !== 'https://api.firecrawl.dev/v1'
  console.log('Firecrawl base URL env check:', {
    url: runtimeConfig.public.firecrawlBaseUrl,
    hasCustom: hasCustomUrl
  })
  return hasCustomUrl
})

// Watch for modal open to ensure config is up to date
watch(() => showModal.value, (isOpen) => {
  if (isOpen) {
    console.log('Modal opened, current config:', {
      provider: provider.value,
      apiBase: config.value.webSearch.apiBase,
      hasCustomUrl: isFirecrawlBaseUrlFromEnv.value
    })
  }
})

defineExpose({
  show() {
    showModal.value = true
  },
})
</script>

<template>
  <div>
    <UButton icon="i-lucide-settings" @click="showModal = true" />
    <UModal :open="showModal" @update:open="showModal = $event" title="Settings">
      <template #body>
        <div class="space-y-2">
          <!-- AI provider -->
          <h3 class="font-bold">AI Provider</h3>
          <UFormField label="Provider">
            <template #help>
              Currently only OpenAI compatible providers are supported, e.g.
              Gemini, Together AI, SiliconCloud, ...
            </template>
            <USelect
              v-model="store.config.ai.provider"
              :items="[
                { label: 'OpenAI Compatible', value: 'openai-compatible' },
              ]"
            />
          </UFormField>
          <div
            v-if="store.config.ai.provider === 'openai-compatible'"
            class="space-y-2"
          >
            <UFormField label="API Key" required>
              <template #help>
                <span v-if="isApiKeyFromEnv" class="text-green-600">
                  Using API key from environment variables
                </span>
              </template>
              <PasswordInput
                v-model="store.config.ai.apiKey"
                class="w-full"
                placeholder="API Key"
                :disabled="isApiKeyFromEnv"
              />
            </UFormField>
            <UFormField label="API Base URL">
              <template #help>
                <span v-if="isEndpointFromEnv" class="text-green-600">
                  Using custom endpoint from environment variables
                </span>
                <span v-else>
                  Default endpoint for OpenAI API
                </span>
              </template>
              <UInput
                v-model="store.config.ai.apiBase"
                class="w-full"
                placeholder="https://api.openai.com/v1"
              />
            </UFormField>
            <UFormField label="Model" required>
              <template #help>
                <span v-if="isModelFromEnv" class="text-green-600">
                  Using model from environment variables
                </span>
                <span v-else>
                  Default model is gpt-4o
                </span>
              </template>
              <UInput
                v-model="store.config.ai.model"
                class="w-full"
                placeholder="gpt-4o"
                :disabled="isModelFromEnv"
              />
            </UFormField>
          </div>

          <USeparator class="my-4" />

          <!-- Web search provider -->
          <h3 class="font-bold">Web Search Provider</h3>
          <UFormField label="Provider">
            <template #help>
              <span v-if="provider === 'firecrawl'">
                Firecrawl provides advanced web search and content extraction. Get your API key at
                <UButton
                  class="!p-0"
                  to="https://firecrawl.dev"
                  target="_blank"
                  variant="link"
                >
                  firecrawl.dev
                </UButton>
                . Tavily is available as an alternative option.
              </span>
              <span v-else>
                Tavily provides web search capabilities. Get your API key at
                <UButton
                  class="!p-0"
                  to="https://app.tavily.com/home"
                  target="_blank"
                  variant="link"
                >
                  app.tavily.com
                </UButton>
                . Firecrawl is available as an alternative option.
              </span>
            </template>
            <USelect
              v-model="provider"
              :items="[
                { label: 'Firecrawl', value: 'firecrawl' },
                { label: 'Tavily', value: 'tavily' }
              ]"
              :disabled="isWebSearchProviderFromEnv"
            />
          </UFormField>
          <template v-if="provider === 'tavily'">
            <UFormField label="API Key" required>
              <template #help>
                <span v-if="isTavilyKeyFromEnv" class="text-green-600">
                  Using API key from environment variables
                </span>
                <span v-else>
                  Get your API key at
                  <UButton
                    class="!p-0"
                    to="https://app.tavily.com/home"
                    target="_blank"
                    variant="link"
                  >
                    app.tavily.com
                  </UButton>
                </span>
              </template>
              <PasswordInput
                v-model="store.config.webSearch.apiKey"
                class="w-full"
                placeholder="API Key"
                :disabled="isTavilyKeyFromEnv"
              />
            </UFormField>
          </template>
          <template v-else-if="provider === 'firecrawl'">
            <UFormField label="API Key" required>
              <template #help>
                <span v-if="isFirecrawlKeyFromEnv" class="text-green-600">
                  Using API key from environment variables
                </span>
                <span v-else>
                  Get your API key at
                  <UButton
                    class="!p-0"
                    to="https://firecrawl.dev"
                    target="_blank"
                    variant="link"
                  >
                    firecrawl.dev
                  </UButton>
                </span>
              </template>
              <PasswordInput
                v-model="store.config.webSearch.apiKey"
                class="w-full"
                placeholder="API Key"
                :disabled="isFirecrawlKeyFromEnv"
              />
            </UFormField>
            <UFormField label="API Base URL">
              <template #help>
                <span v-if="isFirecrawlBaseUrlFromEnv" class="text-green-600">
                  Using custom endpoint from environment variables
                </span>
                <span v-else>
                  Default Firecrawl API endpoint
                </span>
              </template>
              <UInput
                v-model="config.webSearch.apiBase"
                class="w-full"
                placeholder="https://api.firecrawl.dev/v1"
              />
            </UFormField>
          </template>
        </div>
      </template>
      <template #footer>
        <div class="flex items-center justify-between gap-2 w-full">
          <p class="text-sm text-gray-500">
            Settings are stored locally in your browser.
          </p>
            <UButton
              color="primary"
              icon="i-lucide-check"
              @click="showModal = false"
            >
            Save
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
