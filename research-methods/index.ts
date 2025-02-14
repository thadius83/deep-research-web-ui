import { DeepResearchMethod } from './methods/deep-research';
import { ExtractInfoMethod } from './methods/extract-info';
import { ExpertSummaryMethod } from './methods/expert-summary';
import { BusinessIdeasMethod } from './methods/business-ideas';
import { ExtractWisdomMethod } from './methods/extract-wisdom';
import { ResearchPredictionsMethod } from './methods/research-predictions';
import type { ResearchMethod } from './types';
import { logger } from '../utils/logger';

// Initialize method instances
logger.debug('Initializing research methods...');

let deepResearch: ResearchMethod;
let extractInfo: ResearchMethod | undefined;
let expertSummary: ResearchMethod | undefined;
let businessIdeas: ResearchMethod | undefined;
let extractWisdom: ResearchMethod | undefined;
let researchPredictions: ResearchMethod | undefined;

function initializeMethod<T extends ResearchMethod>(
  Method: new () => T,
  name: string
): T | undefined {
  try {
    const instance = new Method();
    logger.debug(`${name} initialized: ${JSON.stringify({
      id: instance.id,
      name: instance.name,
      description: instance.description
    }, null, 2)}`);
    return instance;
  } catch (error) {
    logger.error(`Error initializing ${name}: ${error}`);
    return undefined;
  }
}

// Initialize Deep Research (required)
const deepResearchInstance = new DeepResearchMethod();
logger.debug(`Deep Research initialized: ${JSON.stringify({
  id: deepResearchInstance.id,
  name: deepResearchInstance.name,
  description: deepResearchInstance.description
}, null, 2)}`);
deepResearch = deepResearchInstance;

// Initialize optional methods
extractInfo = initializeMethod(ExtractInfoMethod, 'Extract Info');
expertSummary = initializeMethod(ExpertSummaryMethod, 'Expert Summary');
businessIdeas = initializeMethod(BusinessIdeasMethod, 'Business Ideas');
extractWisdom = initializeMethod(ExtractWisdomMethod, 'Extract Wisdom');
researchPredictions = initializeMethod(ResearchPredictionsMethod, 'Research Predictions');

// Method registry - filter out undefined methods
export const researchMethods: ResearchMethod[] = [
  deepResearch, // Keep deep research as first/default method
  ...(extractInfo ? [extractInfo] : []),
  ...(expertSummary ? [expertSummary] : []),
  ...(businessIdeas ? [businessIdeas] : []),
  ...(extractWisdom ? [extractWisdom] : []),
  ...(researchPredictions ? [researchPredictions] : []),
].filter((method): method is ResearchMethod => method !== undefined);

logger.debug(`Research methods initialized: ${JSON.stringify(researchMethods.map(m => ({
  id: m.id,
  name: m.name,
  description: m.description
})), null, 2)}`);

// Get method by ID with error handling
export function getMethodById(id: string): ResearchMethod {
  try {
    logger.debug(`Getting method by ID: ${id}`);
    const method = researchMethods.find(m => m.id === id);
    
    if (!method) {
      logger.debug('Method not found, defaulting to deep research');
      return deepResearch;
    }

    logger.debug(`Found method: ${JSON.stringify({
      id: method.id,
      name: method.name,
      description: method.description
    }, null, 2)}`);

    return method;
  } catch (error) {
    logger.error(`Error getting method by ID: ${error}`);
    return deepResearch;
  }
}

// Export individual methods for direct use
export {
  deepResearch,
  extractInfo,
  expertSummary,
  businessIdeas,
  extractWisdom,
  researchPredictions,
};
