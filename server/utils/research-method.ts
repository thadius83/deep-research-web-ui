import { getMethodById } from '~/research-methods';
import type { ResearchContext } from '~/research-methods/types';

export function getResearchPrompts(methodId: string, context: ResearchContext) {
  const method = getMethodById(methodId);
  
  return {
    mainPrompt: method.formatInput(context),
    followUpTemplate: method.followUpTemplate,
    learningTemplate: method.learningTemplate,
  };
}
