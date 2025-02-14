import { getMethodById } from '~/research-methods';
import type { ResearchContext } from '~/research-methods/types';
import { getConfig } from './server-config';

export async function getResearchPrompts(methodId: string, context: ResearchContext) {
  const method = getMethodById(methodId);
  
  const config = getConfig();
  if (config.isDev) {
    console.group('Research Method Prompts');
    console.group('Method Details');
    console.log('ID:', method.id);
    console.log('Name:', method.name);
    console.log('Description:', method.description);
    console.groupEnd();

    console.group('Input Context');
    console.log('Query:', context.query);
    console.log('Search Results:', context.searchResults.length, 'items');
    console.log('Sources:', context.sources.length, 'items');
    console.log('Previous Learnings:', context.learnings?.length || 0, 'items');
    console.log('Current Date:', context.currentDate);
    console.groupEnd();
  }

  const mainPrompt = await method.formatInput(context);
  const followUpTemplate = method.followUpTemplate;
  const learningTemplate = method.learningTemplate;

  if (config.isDev) {
    console.group('Generated Prompts');
    console.log('Main Prompt:', mainPrompt);
    console.log('Follow-up Template:', followUpTemplate);
    console.log('Learning Template:', learningTemplate);
    console.groupEnd();
    console.groupEnd();
  }
  
  return {
    mainPrompt,
    followUpTemplate,
    learningTemplate,
  };
}

// Method-specific validation
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateMethodOutput(methodId: string, output: any): ValidationResult {
  const config = getConfig();
  const method = getMethodById(methodId);
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (config.isDev) {
    console.group('Method Output Validation');
    console.log('Method:', method.id);
    console.group('Output Structure');
    console.log('Sections:', Object.keys(output?.sections || {}));
    console.log('Raw Output:', output);
    console.groupEnd();
  }

  // Basic validation
  if (!output?.sections) {
    result.isValid = false;
    result.errors.push('Missing sections in output');
    return result;
  }

  // Method-specific section validation
  switch (method.id) {
    case 'expert-summary':
      if (!output.sections.SUMMARY || !output.sections.KEY_IDEAS) {
        result.isValid = false;
        result.errors.push('Missing required sections: SUMMARY or KEY_IDEAS');
      }
      break;
    case 'business-ideas':
      if (!output.sections.EXTRACTED_IDEAS || !output.sections.ELABORATED_IDEAS) {
        result.isValid = false;
        result.errors.push('Missing required sections: EXTRACTED_IDEAS or ELABORATED_IDEAS');
      }
      break;
    case 'extract-wisdom':
      if (!output.sections.PRACTICAL_HABITS || !output.sections.RECOMMENDATIONS) {
        result.isValid = false;
        result.errors.push('Missing required sections: PRACTICAL_HABITS or RECOMMENDATIONS');
      }
      break;
    case 'research-predictions':
      if (!output.sections.PREDICTIONS || !output.sections.VERIFICATION_CRITERIA) {
        result.isValid = false;
        result.errors.push('Missing required sections: PREDICTIONS or VERIFICATION_CRITERIA');
      }
      break;
  }

  // Source reference validation
  Object.entries(output.sections).forEach(([sectionName, section]: [string, any]) => {
    if (!section.sourceRefs || !Array.isArray(section.sourceRefs)) {
      result.warnings.push(`Missing or invalid source references in section: ${sectionName}`);
    }

    if (config.isDev) {
      console.group(`Section: ${sectionName}`);
      console.log('Content Format:', section.format);
      console.log('Content Length:', Array.isArray(section.content) ? section.content.length : section.content?.length || 0);
      console.log('Source References:', section.sourceRefs?.length || 0);
      console.groupEnd();
    }
  });

    if (config.isDev) {
    console.group('Validation Results');
    if (result.errors.length > 0) {
      console.group('Errors');
      result.errors.forEach(error => console.log('-', error));
      console.groupEnd();
    }
    if (result.warnings.length > 0) {
      console.group('Warnings');
      result.warnings.forEach(warning => console.log('-', warning));
      console.groupEnd();
    }
    if (result.isValid && result.warnings.length === 0) {
      console.log('✓ Output is valid with no warnings');
    }
    console.groupEnd();
    console.groupEnd(); // Method Output Validation
  }

  return result;
}
