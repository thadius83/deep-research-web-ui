<script setup lang="ts">
import type { ResearchStep } from '~/lib/deep-research'

export type TreeNodeStatus = Exclude<ResearchStep['type'], 'complete'>

export type TreeNode = {
  id: string
  /** Label, represents the search query */
  label: string
  researchGoal?: string
  learnings?: string[]
  followUpQuestions?: string[]
  visitedUrls?: string[]
  status?: TreeNodeStatus
  classification?: {
    type: 'technical' | 'analysis'
    confidence: 'high' | 'medium' | 'low'
    metadata: {
      contentType?: string
      audience?: string
    }
    rawResponse?: string
  }
  children: TreeNode[]
}

const props = defineProps<{
  node: TreeNode
  selectedNode?: TreeNode
}>()

const emit = defineEmits<{
  (e: 'select', value: TreeNode): void
}>()

const icon = computed(() => {
  const result = { name: '', pulse: false }
  if (!props.node.status) return result
  switch (props.node.status) {
    case 'generating_query':
      result.name = 'i-lucide-clipboard-list'
      result.pulse = true
      break
    case 'generated_query':
      result.name = 'i-lucide-pause'
      break
    case 'searching':
      result.name = 'i-lucide-search'
      result.pulse = true
      break
    case 'search_complete':
      result.name = 'i-lucide-search-check'
      break
    case 'classifying_content':
      result.name = 'i-lucide-filter'
      result.pulse = true
      break
    case 'classified_content':
      result.name = props.node.classification?.type === 'technical' 
        ? 'i-lucide-code-2' 
        : 'i-lucide-book-open'
      break
    case 'processing_serach_result':
      result.name = 'i-lucide-brain'
      result.pulse = true
      break
    case 'processed_search_result':
      result.name = 'i-lucide-circle-check-big'
      break
    case 'error':
      result.name = 'i-lucide-octagon-x'
      break
  }
  return result
})

function selectNode(node: TreeNode) {
  selectedNode.value = node // Always set the node, don't toggle
}
</script>

<template>
  <div class="flex items-center gap-1">
    <UIcon name="i-lucide-circle-dot" />
    <div class="flex items-center gap-1">
      <UButton
        :class="icon.pulse && 'animate-pulse'"
        :icon="icon.name"
        size="sm"
        :color="selectedNode?.id === node.id ? 'primary' : 'info'"
        :variant="selectedNode?.id === node.id ? 'soft' : 'outline'"
        @click="emit('select', node)"
        :data-node-id="node.id"
      >
        {{ node.label }}
      </UButton>
      <UBadge v-if="node.classification" class="capitalize cursor-pointer" @click="emit('select', node)">
        {{ node.classification.type }}
      </UBadge>
    </div>
    <ol v-if="node.children.length > 0" class="space-y-2">
      <li v-for="node in node.children" :key="node.id">
        <Tree
          class="ml-2"
          :node="node"
          :selected-node="selectedNode"
          @select="emit('select', $event)"
        />
      </li>
    </ol>
  </div>
</template>
