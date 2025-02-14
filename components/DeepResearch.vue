<script setup lang="ts">
  import {
    deepResearch,
    type PartialSearchResult,
    type ResearchResult,
    type ResearchStep,
  } from '~/lib/deep-research'
  import type { TreeNode } from './Tree.vue'

  const emit = defineEmits<{
    (e: 'complete', results: ResearchResult): void
  }>()

  const tree = ref<TreeNode>({
    id: '0',
    label: 'Start',
    children: [],
  })
  const selectedNode = ref<TreeNode>()
  const searchResults = ref<Record<string, PartialSearchResult>>({})
  const isLoading = ref(false)

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

  function handleResearchProgress(step: ResearchStep) {
    let node: TreeNode | null = null
    let nodeId = ''

    if (step.type !== 'complete') {
      nodeId = step.nodeId
      node = findNode(tree.value, step.nodeId)
      if (node) {
        node.status = step.type
      }
    }

    switch (step.type) {
      case 'generating_query': {
        if (!node) {
          // Create new node
          node = {
            id: nodeId,
            label: 'Generating...',
            researchGoal: 'Generating research goal...',
            learnings: [],
            children: [],
          }
          const parentNodeId = getParentNodeId(nodeId)
          // If direct child of root node
          if (parentNodeId === '0') {
            tree.value.children.push(node)
            // If this is the first query (0-0), scroll to it
            if (nodeId === '0-0') {
              scrollToFirstQuery()
            }
          } else {
            // Find parent node and add
            const parentNode = findNode(
              tree.value,
              getParentNodeId(step.nodeId),
            )
            if (parentNode) {
              parentNode.children.push(node)
            }
          }
        }
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
          searchResults.value[nodeId] = step.result
        }
        break
      }

      case 'error':
        console.error(`Research error on node ${nodeId}:`, step.message)
        break

      case 'complete':
        emit('complete', step)
        isLoading.value = false
        break
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
    if (selectedNode.value?.id === node.id) {
      selectedNode.value = undefined
    } else {
      selectedNode.value = node
    }
  }

  // Helper function: Get parent node ID
  function getParentNodeId(nodeId: string): string {
    const parts = nodeId.split('-')
    parts.pop()
    return parts.join('-')
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
  <UCard id="research-tree">
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
        <h2 class="text-xl font-bold mt-2">{{ selectedNode.label }}</h2>

        <!-- Root node has no additional information -->
        <p v-if="selectedNode.id === '0'">
          This is the beginning of your deep research journey!
        </p>
        <template v-else>
          <h3 class="text-lg font-semibold mt-2">Research Goal:</h3>
          <p>{{ selectedNode.researchGoal }}</p>

          <h3 class="text-lg font-semibold mt-2">Visited URLs:</h3>
          <ul class="list-disc list-inside">
            <li v-for="(url, index) in selectedNode.visitedUrls" :key="index">
              <ULink :href="url" target="_blank">{{ url }}</ULink>
            </li>
          </ul>

          <h3 class="text-lg font-semibold mt-2">Learnings:</h3>
          <ul class="list-disc list-inside">
            <li
              v-for="(learning, index) in selectedNode.learnings"
              :key="index"
              >{{ learning }}</li
            >
          </ul>
        </template>
      </div>
    </div>
  </UCard>
</template>
