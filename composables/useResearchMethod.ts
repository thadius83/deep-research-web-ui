import { ref, computed, watch } from 'vue';
import { researchMethods, getMethodById } from '~/research-methods';
import type { ResearchMethod } from '~/research-methods/types';

/**
 * This module defines a singleton reactive state for all research methods.
 * All calls to useResearchMethod() will share the same instance.
 */

// Create a single shared state across your application.
const methods = ref<ResearchMethod[]>([...researchMethods]);
console.log(
  'useResearchMethod: Available methods',
  methods.value.map((m) => m.id)
);

// Initialize with the first method as the default selection.
const selectedMethodId = ref<string>(methods.value[0]?.id || '');
console.log('useResearchMethod: Initial selectedMethodId', selectedMethodId.value);

// Defensive computed copy of methods.
const availableMethods = computed(() => {
  if (methods.value.length === 0) {
    return [];
  }
  return [...methods.value];
});

// Watch for changes to the selectedMethodId.
watch(selectedMethodId, (newId, oldId) => {
  console.log('useResearchMethod: selectedMethodId changed:', { newId, oldId });
  if (newId && !methods.value.find((m) => m.id === newId)) {
    console.warn('useResearchMethod: Invalid method ID, resetting to default');
    selectedMethodId.value = methods.value[0]?.id || '';
  }
});

// Watch for changes to the methods list.
watch(
  methods,
  (newMethods) => {
    console.log('useResearchMethod: methods changed:', newMethods.map((m) => m.id));
    if (!selectedMethodId.value && newMethods.length > 0) {
      selectedMethodId.value = newMethods[0].id;
    }
  },
  { deep: true }
);

// Helper functions.
function selectMethod(id: string) {
  console.log('useResearchMethod: selectMethod called with', id);
  if (!methods.value.find((m) => m.id === id)) {
    console.warn('useResearchMethod: Invalid method ID:', id);
    return;
  }
  selectedMethodId.value = id;
}

function getCurrentMethod(): ResearchMethod {
  if (!selectedMethodId.value) {
    console.warn('useResearchMethod: No method selected, using default');
    return methods.value[0];
  }
  const method = getMethodById(selectedMethodId.value);
  if (!method) {
    console.warn('useResearchMethod: Method not found, using default');
    return methods.value[0];
  }
  return method;
}

export function useResearchMethod() {
  return {
    selectedMethodId,
    availableMethods,
    selectMethod,
    getCurrentMethod,
  };
}
