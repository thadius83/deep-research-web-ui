<script setup lang="ts">
  import {
    deepResearch,
    type PartialSearchResult,
    type ResearchResult,
    type ResearchStep,
  } from '~/lib/deep-research'
  import type { TreeNode } from './Tree.vue'
  import { ref, nextTick, watch, computed } from 'vue'

  const emit = defineEmits<{
    (e: 'complete', results: ResearchResult): void
  }>()

  const tree = ref<TreeNode>({
    id: '0',
    label: 'Deep Research',
    children: [],
  })
  const selectedNode = ref<TreeNode>()
  const searchResults = ref<Record<string, PartialSearchResult>>({})
  const isLoading = ref(false)

  // Computed property to safely parse JSON
  const parsedClassification = computed(() => {
    try {
      return selectedNode.value?.classification?.rawResponse 
        ? JSON.parse(selectedNode.value.classification.rawResponse)
        : null;
    } catch (e) {
      console.error('Failed to parse classification:', e);
      return null;
    }
  });

  // Debug watch for classification changes
  watch(() => selectedNode.value?.classification, (newVal) => {
    console.log('[Classification] Selected node classification changed:', newVal);
  }, { deep: true });

  // Helper function to create a new node
  function createNode(nodeId: string, label = 'Generating...', researchGoal = 'Generating research goal...'): TreeNode {
    const node = {
      id: nodeId,
      label,
      researchGoal,
      learnings: [],
      children: [],
      classification: undefined
    }
    
    const parentNodeId = getParentNodeId(nodeId)
    if (parentNodeId === '0') {
      tree.value.children.push(node)
      if (nodeId === '0-0') {
        scrollToFirstQuery()
      }
    } else {
      const parentNode = findNode(tree.value, getParentNodeId(nodeId))
      if (parentNode) {
        parentNode.children.push(node)
      }
    }
    return node
  }

  function handleResearchProgress(step: ResearchStep) {
    // Handle complete step separately since it doesn't have a nodeId
    if (step.type === 'complete') {
      emit('complete', step);
      isLoading.value = false;
      return;
    }

    // Get or create node
    let node = findNode(tree.value, step.nodeId)
    if (!node && step.type === 'generating_query') {
      node = createNode(step.nodeId)
    }
    if (!node) {
      console.error(`Node not found for step: ${step.type}, id: ${step.nodeId}`);
      return;
    }

    // Update node status
    node.status = step.type;
    
    // Handle classification if present
    if (step.type === 'classified_content') {
      console.log('[Classification] Received:', {
        type: step.classification.type,
        confidence: step.classification.confidence,
        rawResponse: step.rawResponse
      });
      node.classification = {
        type: step.classification.type,
        confidence: step.classification.confidence,
        metadata: step.classification.metadata,
        rawResponse: step.rawResponse,
      };
      console.log('[Classification] Node updated:', {
        nodeId: node.id,
        classification: node.classification
      });
    }
    
    // Process other events
    switch (step.type) {
      case 'generating_query': {
        // Update node query content
        if (step.result) {
          node.label = step.result.query ?? 'Generating...'
          node.researchGoal = step.result.researchGoal
        }
        break
      }

      case 'generated_query': {
        break
      }

      case 'searching': {
        break
      }

      case 'search_complete': {
        if (node) {
          node.visitedUrls = step.urls
        }
        break
      }

      case 'classifying_content': {
        // No additional data to update
        break
      }

      case 'processing_serach_result': {
        if (node) {
          node.learnings = step.result.learnings || []
          node.followUpQuestions = step.result.followUpQuestions || []
        }
        break
      }

      case 'processed_search_result': {
        if (node) {
          node.learnings = step.result.learnings
          searchResults.value[step.nodeId] = step.result
        }
        break
      }

      case 'error':
        console.error(`Research error on node ${step.nodeId}:`, step.message);
        break;
    }
  }

  // Helper function: Find node by ID
  function findNode(root: TreeNode, targetId: string): TreeNode | null {
    if (!targetId) return null
    if (root.id === targetId) {
      return root
    }
    for (const child of root.children) {
      const found = findNode(child, targetId)
      if (found) {
        return found
      }
    }
    return null
  }

  function selectNode(node: TreeNode) {
    selectedNode.value = node // Always set the node, don't toggle
  }

  // Helper function: Get parent node ID
  function getParentNodeId(nodeId: string): string {
    const parts = nodeId.split('-')
    parts.pop()
    return parts.join('-')
  }

  // Scroll to first query without selecting it
  function scrollToFirstQuery() {
    if (tree.value.children.length > 0) {
      const firstNode = tree.value.children[0]
      nextTick(() => {
        const element = document.querySelector(`[data-node-id="${firstNode.id}"]`)
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          })
        }
      })
    }
  }

  async function startResearch(query: string, depth: number, breadth: number) {
    tree.value.children = []
    selectedNode.value = undefined
    searchResults.value = {}
    isLoading.value = true
    try {
      await deepResearch({
        query,
        maxDepth: depth,
        breadth,
        onProgress: handleResearchProgress,
      })
    } catch (error) {
      console.error('Research failed:', error)
    } finally {
      isLoading.value = false
    }
  }

  defineExpose({
    startResearch,
    isLoading,
  })
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-bold">3. Web Browsing</h2>
      <p class="text-sm text-gray-500">
        The AI will then search the web based on our research goal, and iterate
        until the depth is reached.
        <br />
        Click a child node to view details.
      </p>
    </template>
    <div class="flex flex-col">
      <div class="overflow-y-auto">
        <Tree :node="tree" :selected-node="selectedNode" @select="selectNode" />
      </div>
      <div v-if="selectedNode" class="p-4">
        <USeparator label="Node Details" />
        
        <!-- Classification details -->
        <template v-if="selectedNode.classification">
          <h2 class="text-xl font-bold mt-2">{{ selectedNode.classification.type === 'technical' ? 'Technical Analysis' : 'Content Analysis' }}</h2>
          
          <!-- Format the classification details as text -->
          <div class="mt-4 space-y-2">
            <div>
              <span class="font-semibold">Type:</span> {{ selectedNode.classification.type }}
              <span class="text-sm text-gray-500 ml-2">({{ selectedNode.classification.confidence }} confidence)</span>
            </div>
            
            <div>
              <span class="font-semibold">Content Type:</span> {{ selectedNode.classification.metadata.contentType || 'General Content' }}
            </div>
            
            <div>
              <span class="font-semibold">Target Audience:</span> {{ selectedNode.classification.metadata.audience || 'General Audience' }}
            </div>
            
            <div v-if="selectedNode.classification.metadata.publishDate">
              <span class="font-semibold">Published:</span> {{ selectedNode.classification.metadata.publishDate }}
            </div>
            
            <div v-if="selectedNode.classification.metadata.lastUpdated">
              <span class="font-semibold">Last Updated:</span> {{ selectedNode.classification.metadata.lastUpdated }}
            </div>
            
            <div class="mt-4">
              <span class="font-semibold">Content Distribution:</span>
              <div class="ml-4 mt-1">
                <div>Technical: {{ parsedClassification?.secondaryTypes?.technical }}%</div>
                <div>Analysis: {{ parsedClassification?.secondaryTypes?.analysis }}%</div>
              </div>
            </div>
          </div>
        </template>

        <!-- Root node welcome message -->
        <template v-else-if="selectedNode.id === '0'">
          <h2 class="text-xl font-bold mt-2">Deep Research</h2>
          <p>This is the beginning of your deep research journey!</p>
        </template>

        <!-- Regular node details (only show if not a classification node) -->
        <template v-else>
          <h2 class="text-xl font-bold mt-2">{{ selectedNode.label }}</h2>
          
          <h3 class="text-lg font-semibold mt-4">Research Goal:</h3>
          <p>{{ selectedNode.researchGoal }}</p>

          <h3 class="text-lg font-semibold mt-4">Visited URLs:</h3>
          <ul class="list-disc list-inside">
            <li v-for="(url, index) in selectedNode.visitedUrls" :key="index">
              <ULink :href="url" target="_blank">{{ url }}</ULink>
            </li>
          </ul>

          <h3 class="text-lg font-semibold mt-4">Learnings:</h3>
          <ul class="list-disc list-inside">
            <li v-for="(learning, index) in selectedNode.learnings" :key="index">
              {{ learning }}
            </li>
          </ul>
        </template>
      </div>
    </div>
  </UCard>
</template>
