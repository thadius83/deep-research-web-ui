export interface SourceMetadata {
  title?: string;
  description?: string;
  sourceURL?: string;
  author?: string;
  publishDate?: string;
  lastModified?: string;
  language?: string;
  contentType?: string;
  mainHeadings?: string[];
}

export interface SourceReference {
  url: string;
  title: string;
  snippet: string;
  timestamp: string;
  metadata?: SourceMetadata;
}

export interface CodeBlock {
  language: string;
  code: string;
}

export interface ContentStructure {
  headings?: string[];
  sections?: { [key: string]: string };
  lists?: string[][];
  tables?: string[][][];
  codeBlocks?: CodeBlock[];
  subsections?: string[];
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
  structure?: ContentStructure;
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
  formatInput: (context: ResearchContext) => string | Promise<string>;
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

  async formatInput(context: ResearchContext): Promise<string> {
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
