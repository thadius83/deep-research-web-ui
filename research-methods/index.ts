import { DeepResearchMethod } from './methods/deep-research';
import { ExtractInfoMethod } from './methods/extract-info';
import type { ResearchMethod } from './types';

// Initialize method instances
console.log('Initializing research methods...');

let deepResearch: ResearchMethod;
let extractInfo: ResearchMethod | undefined;

try {
  const deepResearchInstance = new DeepResearchMethod();
  console.log('Deep Research initialized:', {
    id: deepResearchInstance.id,
    name: deepResearchInstance.name,
    description: deepResearchInstance.description
  });
  deepResearch = deepResearchInstance;
} catch (error) {
  console.error('Error initializing Deep Research:', error);
  throw new Error('Failed to initialize Deep Research method');
}

try {
  const extractInfoInstance = new ExtractInfoMethod();
  console.log('Extract Info initialized:', {
    id: extractInfoInstance.id,
    name: extractInfoInstance.name,
    description: extractInfoInstance.description
  });
  extractInfo = extractInfoInstance;
} catch (error) {
  console.error('Error initializing Extract Info:', error);
  // Don't throw, just continue without this method
}

// Method registry
export const researchMethods: ResearchMethod[] = [
  deepResearch, // Keep deep research as first/default method
  ...(extractInfo ? [extractInfo] : []),
];

console.log('Research methods initialized:', researchMethods.map(m => ({
  id: m.id,
  name: m.name,
  description: m.description
})));

// Get method by ID with error handling
export function getMethodById(id: string): ResearchMethod {
  try {
    console.log('Getting method by ID:', id);
    const method = researchMethods.find(m => m.id === id);
    
    if (!method) {
      console.warn('Method not found, defaulting to deep research');
      return deepResearch;
    }

    console.log('Found method:', {
      id: method.id,
      name: method.name,
      description: method.description
    });

    return method;
  } catch (error) {
    console.error('Error getting method by ID:', error);
    return deepResearch;
  }
}

// Export individual methods for direct use
export {
  deepResearch,
  extractInfo,
};
