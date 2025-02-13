import { BaseResearchMethod } from '../types';
import type { MethodOutput, SourceReference } from '../types';

export class ExtractInfoMethod extends BaseResearchMethod {
  id = 'extract-info';
  name = 'Extract Information';
  description = 'Extract and organize key information points';

  promptTemplate = `
    You are an advanced AI with expertise in information extraction.
    
    Query: {{query}}
    Search Results: {{searchResults}}
    Sources: {{sources}}
    Date: {{currentDate}}
    Previous Learnings: {{learnings}}
    
    Extract and organize key information:
    1. Identify core facts and ideas
    2. Group related information
    3. Maintain source attribution
    
    OUTPUT FORMAT:
    1. IDEAS
    - [idea with source reference]
    - [idea with source reference]
    
    2. SOURCE_REFERENCES
    - [source details]
  `;

  followUpTemplate = `
    Query: {{query}}
    Previous Learnings: {{learnings}}
    Date: {{currentDate}}
    
    Based on the extracted information:
    1. What requires clarification?
    2. What additional context is needed?
    3. What potential contradictions exist?
    
    Generate 3-5 specific follow-up questions.
  `;

  learningTemplate = `
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

  parseOutput(response: string): MethodOutput {
    const sections = response.split(/\n(?=\d\.\s+[A-Z_]+\n)/);
    const output: MethodOutput = { sections: {} };
    
    // Helper to extract source references from content
    const extractSourceRefs = (content: string): SourceReference[] => {
      const refs: SourceReference[] = [];
      // Basic source extraction - can be enhanced based on actual format
      const sourceMatches = content.match(/\[Source: ([^\]]+)\]/g);
      if (sourceMatches) {
        sourceMatches.forEach(match => {
          const url = match.match(/\[Source: ([^\]]+)\]/)?.[1];
          if (url) {
            refs.push({
              url,
              title: '', // Would be populated from actual source data
              snippet: '', // Would be populated from actual source data
              timestamp: new Date().toISOString()
            });
          }
        });
      }
      return refs;
    };

    sections.forEach(section => {
      const titleMatch = section.match(/^\d\.\s+([A-Z_]+)\n/);
      if (titleMatch) {
        const title = titleMatch[1];
        const content = section.replace(/^\d\.\s+[A-Z_]+\n/, '').trim();
        
        // Split content into array for IDEAS section
        const formattedContent = title === 'IDEAS' 
          ? content.split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim())
          : content;

        output.sections[title] = {
          content: formattedContent,
          format: title === 'IDEAS' ? 'list' : 'text',
          sourceRefs: extractSourceRefs(content)
        };
      }
    });

    return output;
  }
}
