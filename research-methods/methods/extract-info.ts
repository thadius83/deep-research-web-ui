import { BaseResearchMethod } from '../types';
import type { 
  MethodOutput, 
  SourceReference, 
  ContentStructure, 
  CodeBlock, 
  SourceMetadata 
} from '../types';
import { useClassify } from '../../composables/useClassify';
interface ContentMetadata {
  publishDate?: string;
  lastUpdated?: string;
  contentType?: string;
  audience?: string;
  confidence: {
    primary: string;
    secondary: { [type: string]: number };
  };
}

enum ContentType {
  Technical = 'technical',
  Analysis = 'analysis'
}

interface ClassificationResult {
  primaryType: ContentType;
  confidence: 'high' | 'medium' | 'low';
  secondaryTypes: { [type in ContentType]?: number };
  metadata: ContentMetadata;
}


export class ExtractInfoMethod extends BaseResearchMethod {
  override id = 'extract-info';
  override name = 'Extract Information';
  override description = 'Extract and organize key information points';
  override promptTemplate = `
    You are an expert information extractor. Extract and organize key information from the provided content.
    
    CONTEXT:
    Query: {{query}}
    Search Results: {{searchResults}}
    Sources: {{sources}}
    Date: {{currentDate}}
    Previous Learnings: {{learnings}}

    Extract and organize the information into these sections:

    ## Overview
    [Brief overview of the content]

    - Key findings
    - Main points
    - Core insights

    ## Details
    [Core information extracted from content]

    - Important facts
    - Critical data
    - Key relationships

    ## Examples
    [Actual examples from content]

    \`\`\`
    [verbatim examples]
    \`\`\`

    ## Data
    [Structured data from content]

    | [Actual column names] |
    |----------------------|
    | [Actual data rows]   |

    ## Analysis
    [Analysis of extracted information]

    - Key patterns
    - Important implications
    - Critical insights

    ## Source References
    [Source details]

    - Publication dates
    - Source quality
    - Content context

    Remember to:
    - Extract actual data, not placeholders
    - Include verbatim examples
    - Note publication dates
    - Link to source material
    - Reference any previous learnings
  `;

  private classify = useClassify();
  private processContent = useProcessContent();

  override formatInput(context: ResearchContext): string {
    // Use the base implementation for template variable replacement
    let input = super.formatInput(context);

    // Add any additional formatting specific to this method
    return input;
  }

  async processInput(context: ResearchContext): Promise<string> {
    try {
      // First classify the content
      const contentType = await this.detectContentType(context.query, context.searchResults.join('\n'));
      const classification = await this.classifyContent(context.query, context.searchResults.join('\n'));
      
      // Get the appropriate template
      const template = contentType === ContentType.Technical ? this.getTechnicalTemplate() : this.promptTemplate;

      // Process the content with the template
      const response = await this.processContent.processContent({
        query: context.query,
        content: context.searchResults.join('\n'),
        template,
        systemPrompt: 'You are an expert information extractor and analyzer.',
        sources: context.sources,
        learnings: context.learnings,
      });

      // Add metadata to the response
      return response.replace('CONTEXT:', `
        CONTEXT:
        Content Type: ${classification.metadata.contentType || 'Unknown'}
        Publication Date: ${classification.metadata.publishDate || 'Unknown'}
        Last Updated: ${classification.metadata.lastUpdated || 'Unknown'}
        Target Audience: ${classification.metadata.audience || 'Unknown'}
        Classification Confidence: ${classification.confidence}
        Secondary Types: ${Object.entries(classification.secondaryTypes)
          .map(([type, conf]) => `${type} (${conf}%)`)
          .join(', ')}
        
      `);
    } catch (error) {
      console.error('Error processing input:', error);
      return this.formatInput(context);
    }
  }

  private classificationTemplate = `
    You are an expert content classifier.
    
    CONTEXT:
    Query: {{query}}
    Content: {{searchResults}}
    Date: {{currentDate}}
    
    Analyze the content and classify it into one of these types:
    - Technical: Code, APIs, software, technical documentation, implementation details
    - Analysis: General analysis, reports, reviews, research, guides, educational content
    
    Provide your classification in this format:
    
    ## Classification Tree
    Primary Type: [main content type]
    Confidence: [high/medium/low]
    
    Secondary Types:
    - [type]: [confidence]%
    - [type]: [confidence]%
    
    ## Reasoning
    [Explain why this classification best fits the content]
    
    ## Content Metadata
    Publication Date: [extract if available]
    Last Updated: [extract if available]
    Content Type: [article/documentation/etc]
    Target Audience: [identify intended readers]
  `;

  private async classifyContent(query: string, searchResults: string): Promise<ClassificationResult> {
    // Get classification from server
    const response = await this.classify.classify({
      query,
      content: searchResults,
      template: this.classificationTemplate,
      systemPrompt: 'You are an expert content classifier and information extractor.',
    });

    // Parse the response
    const sections = response.split(/\n(?=##\s+[A-Za-z][A-Za-z\s]*\n)/);
    const classification: ClassificationResult = {
      primaryType: ContentType.Analysis, // Default
      confidence: 'low',
      secondaryTypes: {},
      metadata: {
        confidence: {
          primary: 'low',
          secondary: {}
        }
      }
    };

    sections.forEach((section: string) => {
      const titleMatch = section.match(/^##\s+([A-Za-z][A-Za-z\s]*)\n/);
      if (titleMatch) {
        const title = titleMatch[1];
        const content = section.replace(/^##\s+[A-Za-z][A-Za-z\s]*\n/, '').trim();

        if (title === 'Classification Tree') {
          // Extract primary type and confidence
          const primaryMatch = content.match(/Primary Type:\s*(\w+)/);
          const confidenceMatch = content.match(/Confidence:\s*(high|medium|low)/i);
          
          if (primaryMatch && primaryMatch[1]) {
            classification.primaryType = primaryMatch[1].toLowerCase() as ContentType;
          }
          if (confidenceMatch && confidenceMatch[1]) {
            classification.confidence = confidenceMatch[1].toLowerCase() as 'high' | 'medium' | 'low';
          }

          // Extract secondary types
          const secondaryTypes = content.match(/- (\w+): (\d+)%/g);
          if (secondaryTypes) {
            secondaryTypes.forEach((match: string) => {
              const [_, type, confidence] = match.match(/- (\w+): (\d+)%/) || [];
              if (type && confidence) {
                classification.secondaryTypes[type.toLowerCase() as ContentType] = parseInt(confidence);
              }
            });
          }
        }
        else if (title === 'Content Metadata') {
          // Extract metadata
          const publishMatch = content.match(/Publication Date:\s*([^\n]+)/);
          const updateMatch = content.match(/Last Updated:\s*([^\n]+)/);
          const typeMatch = content.match(/Content Type:\s*([^\n]+)/);
          const audienceMatch = content.match(/Target Audience:\s*([^\n]+)/);

          classification.metadata = {
            publishDate: publishMatch?.[1],
            lastUpdated: updateMatch?.[1],
            contentType: typeMatch?.[1],
            audience: audienceMatch?.[1],
            confidence: {
              primary: classification.confidence,
              secondary: classification.secondaryTypes
            }
          };
        }
      }
    });

    return classification;
  }

  private async detectContentType(query: string, searchResults: string): Promise<ContentType> {
    try {
      // Get classification from LLM
      const classification = await this.classifyContent(query, searchResults);
      
      // Use confidence to potentially fall back to Analysis
      return classification.confidence === 'low' ? ContentType.Analysis : classification.primaryType;
    } catch (error) {
      console.error('Error classifying content:', error);
      return ContentType.Analysis;
    }
  }

  private getTechnicalTemplate(): string {
    return `
      You are an expert information extractor. Extract and organize technical information from the provided content.
      
      CONTEXT:
      Query: {{query}}
      Search Results: {{searchResults}}
      Sources: {{sources}}
      Date: {{currentDate}}
      Previous Learnings: {{learnings}}

      Extract and organize the information into these sections:

      ## Overview
      [Brief overview of the technical content]

      - Key capabilities
      - Core features
      - Main use cases

      ## Details
      [Technical details extracted from content]

      - Architecture details
      - System components
      - Dependencies
      - Requirements

      ## Code
      [Actual code examples from content]

      \`\`\`[language]
      [verbatim code]
      \`\`\`

      ## Data
      [Technical specifications and data]

      | [Actual column names] |
      |----------------------|
      | [Actual data rows]   |

      ## Analysis
      [Analysis of technical aspects]

      - Implementation considerations
      - Performance characteristics
      - Integration requirements
      - Technical limitations

      ## Source References
      [Technical documentation]

      - Publication dates
      - Documentation links
      - Version information
      - API references

      Remember to:
      - Extract actual code samples
      - Include real data structures
      - Note version numbers
      - Reference documentation
      - Link to technical specs
      - Include any previous learnings
    `;
  }

  override followUpTemplate = `
    Query: {{query}}
    Previous Learnings: {{learnings}}
    Date: {{currentDate}}
    
    Based on the extracted information:
    1. What requires clarification?
    2. What additional context is needed?
    3. What potential contradictions exist?
    
    Generate 3-5 specific follow-up questions.
  `;

  override learningTemplate = `
    Query: {{query}}
    Previous Learnings: {{learnings}}
    Date: {{currentDate}}
    Sources: {{sources}}
    
    From the extracted information:
    1. What patterns emerge?
    2. What key insights stand out?
    3. What conclusions can be drawn?
    
    Format as clear, actionable learnings with source links.
  `;

  override validateOutput(output: MethodOutput): boolean {
    // Validate that all required sections exist
    const requiredSections = ['Overview', 'Details', 'Examples', 'Data', 'Analysis', 'Source_References'];
    const hasAllSections = requiredSections.every(section => 
      section in output.sections && 
      output.sections[section].content !== undefined &&
      output.sections[section].format !== undefined &&
      output.sections[section].sourceRefs !== undefined
    );

    // Validate that content is not empty
    const hasContent = Object.values(output.sections).every(section => 
      section.content && section.content.length > 0
    );

    return hasAllSections && hasContent;
  }

  override parseOutput(response: string, query?: string): MethodOutput {
    const sections = response.split(/\n(?=##\s+[A-Za-z][A-Za-z\s]*\n)/);
    const output: MethodOutput = { sections: {} };
    
    // Helper to extract source references from content
    const extractSourceRefs = (content: string): SourceReference[] => {
      const refs: SourceReference[] = [];
      // Extract metadata if available
      const metadataMatch = content.match(/Title:\s*([^\n]+)/);
      const authorMatch = content.match(/Author:\s*([^\n]+)/);
      const publishedMatch = content.match(/Published:\s*([^\n]+)/);
      const modifiedMatch = content.match(/Last Modified:\s*([^\n]+)/);
      const contentTypeMatch = content.match(/Content Type:\s*([^\n]+)/);
      const topicsMatch = content.match(/Main Topics:\s*([^\n]+)/);
      
      // Extract source references with metadata
      const sourceMatches = content.match(/\[Source: ([^\]]+)\]/g);
      if (sourceMatches) {
        sourceMatches.forEach(match => {
          const url = match.match(/\[Source: ([^\]]+)\]/)?.[1];
          if (url) {
            refs.push({
              url,
              title: metadataMatch?.[1] || '',
              snippet: '',
              timestamp: new Date().toISOString(),
              metadata: {
                title: metadataMatch?.[1],
                author: authorMatch?.[1],
                publishDate: publishedMatch?.[1],
                lastModified: modifiedMatch?.[1],
                contentType: contentTypeMatch?.[1],
                mainHeadings: topicsMatch?.[1]?.split(',').map(h => h.trim())
              }
            });
          }
        });
      }
      return refs;
    };

    // Helper to extract tables from content
    const extractTables = (content: string): string[][][] | undefined => {
      const tables: string[][][] = [];
      const tableRegex = /\|([^\n]+)\|(?:\r?\n\|[-|\s]+\|)?(?:\r?\n\|([^\n]+)\|)+/g;
      let match;
      
      while ((match = tableRegex.exec(content)) !== null) {
        const tableLines = match[0].split('\n').filter(line => !line.match(/^\|[-|\s]+\|$/));
        const table = tableLines.map(line => 
          line.split('|')
            .slice(1, -1) // Remove empty first/last elements
            .map(cell => cell.trim())
        );
        if (table.length > 0) {
          tables.push(table);
        }
      }
      
      return tables.length > 0 ? tables : undefined;
    };

    // Helper to extract code blocks
    const extractCodeBlocks = (content: string): CodeBlock[] => {
      const codeBlocks: { language: string, code: string }[] = [];
      const codeRegex = /```(\w*)\n([\s\S]*?)```/g;
      let match;
      
      while ((match = codeRegex.exec(content)) !== null) {
        codeBlocks.push({
          language: match[1] || 'text',
          code: match[2].trim()
        });
      }
      
      return codeBlocks;
    };

    sections.forEach(section => {
      const titleMatch = section.match(/^##\s+([A-Za-z][A-Za-z\s]*)\n/);
      if (titleMatch) {
        // Convert to Title Case and replace spaces with underscores
        const title = titleMatch[1]
          .split(/\s+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join('_');
        let content = section.replace(/^##\s+[A-Za-z][A-Za-z\s]*\n/, '').trim();
        
        // Process subsections
        const subsections = content.split(/\n(?=###\s+[A-Za-z][A-Za-z\s]*\n)/);
        if (subsections.length > 1) {
          content = subsections.map(subsection => {
            const subTitleMatch = subsection.match(/^###\s+([A-Za-z][A-Za-z\s]*)\n/);
            if (subTitleMatch) {
              const subTitle = subTitleMatch[1];
              const subContent = subsection.replace(/^###\s+[A-Za-z][A-Za-z\s]*\n/, '').trim();
              return `### ${subTitle}\n\n${subContent}`;
            }
            return subsection.trim();
          }).join('\n\n');
        }

        // Extract tables and code blocks
        const tables = extractTables(content);
        const codeBlocks = extractCodeBlocks(content);
        const subsectionTitles = subsections.length > 1 
          ? subsections.map(sub => {
              const subTitleMatch = sub.match(/^###\s+([A-Za-z][A-Za-z\s]*)\n/);
              return subTitleMatch ? subTitleMatch[1] : '';
            }).filter(Boolean) 
          : undefined;

        // Create structure object only if we have content to include
        const structure: ContentStructure = {};
        if (tables && tables.length > 0) structure.tables = tables;
        if (codeBlocks && codeBlocks.length > 0) structure.codeBlocks = codeBlocks;
        if (subsectionTitles && subsectionTitles.length > 0) structure.subsections = subsectionTitles;

        output.sections[title] = {
          content,
          format: 'text',
          sourceRefs: extractSourceRefs(content),
          structure: Object.keys(structure).length > 0 ? structure : undefined
        };
      }
    });

    return output;
  }
}
