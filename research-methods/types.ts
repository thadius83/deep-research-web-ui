export interface SourceReference {
  url: string;
  title: string;
  snippet: string;
  timestamp: string;
}

export interface ResearchContext {
  query: string;
  searchResults: string[];
  sources: SourceReference[];
  currentDate: string;
  learnings?: string[];
}

export interface MethodOutputSection {
  content: string | string[];
  format: 'list' | 'table' | 'text';
  sourceRefs: SourceReference[];
}

export interface MethodOutput {
  sections: {
    [key: string]: MethodOutputSection;
  };
}

export interface ResearchMethod {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
  followUpTemplate: string;
  learningTemplate: string;
  formatInput: (context: ResearchContext) => string;
  parseOutput: (response: string) => MethodOutput;
  validateOutput: (output: MethodOutput) => boolean;
}

export abstract class BaseResearchMethod implements ResearchMethod {
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract promptTemplate: string;
  abstract followUpTemplate: string;
  abstract learningTemplate: string;

  formatInput(context: ResearchContext): string {
    let input = this.promptTemplate;
    input = input.replace('{{query}}', context.query);
    input = input.replace('{{searchResults}}', context.searchResults.join('\n\n'));
    input = input.replace('{{sources}}', JSON.stringify(context.sources, null, 2));
    input = input.replace('{{currentDate}}', context.currentDate);
    if (context.learnings) {
      input = input.replace('{{learnings}}', context.learnings.join('\n'));
    }
    return input;
  }

  abstract parseOutput(response: string): MethodOutput;

  validateOutput(output: MethodOutput): boolean {
    // Basic validation that all sections exist and have correct format
    return Object.values(output.sections).every(section => 
      section.content !== undefined && 
      section.format !== undefined &&
      section.sourceRefs !== undefined
    );
  }
}
