import { BaseResearchMethod } from '../types';
import type { MethodOutput, SourceReference } from '../types';

export class BusinessIdeasMethod extends BaseResearchMethod {
  id = 'business-ideas';
  name = 'Research Business Ideas';
  description = 'Extract and analyze business opportunities and innovations';

  promptTemplate = `
    You are a business idea extraction assistant with expertise in identifying revolutionary and innovative business opportunities.

    Query: {{query}}
    Search Results: {{searchResults}}
    Sources: {{sources}}
    Date: {{currentDate}}
    Previous Learnings: {{learnings}}

    Take a deep breath and think step by step about extracting and analyzing business opportunities from the content.

    Your analysis should include:

    ## Extracted Ideas
    - [List of potential business ideas with source references]

    ## Elaborated Ideas
    - [Top 10 ideas with unique differentiators and adjacent opportunities]

    ## Market Analysis
    [Market size, competition, and opportunity assessment]

    ## Implementation Notes
    [Key considerations and requirements for execution]

    ## Source References
    [Source details and citations]

    Guidelines:
    - Each idea should be unique and differentiated
    - Include market size and potential when available
    - Note technological or resource requirements
    - Identify competitive advantages
    - Consider scalability and barriers to entry
  `;

  followUpTemplate = `
    Query: {{query}}
    Previous Learnings: {{learnings}}
    Date: {{currentDate}}
    
    Based on the identified opportunities:
    1. What market segments need validation?
    2. What competitive factors need investigation?
    3. What resource requirements need clarification?
    
    Generate 3-5 specific follow-up questions.
  `;

  learningTemplate = `
    Query: {{query}}
    Previous Learnings: {{learnings}}
    Date: {{currentDate}}
    Sources: {{sources}}
    
    Synthesize the key business insights:
    1. What are the most promising opportunities?
    2. What patterns suggest market readiness?
    3. What factors indicate feasibility?
    
    Format as clear, actionable insights with market data and source links.
  `;

  parseOutput(response: string): MethodOutput {
    const sections = response.split(/\n(?=##\s+[A-Z][a-zA-Z\s]+\n)/);
    const output: MethodOutput = { sections: {} };
    
    // Helper to extract source references from content
    const extractSourceRefs = (content: string): SourceReference[] => {
      const refs: SourceReference[] = [];
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
      const titleMatch = section.match(/^##\s+([A-Z][a-zA-Z\s]+)\n/);
      if (titleMatch) {
        const title = titleMatch[1].replace(/\s+/g, '_').toUpperCase();
        const content = section.replace(/^##\s+[A-Z][a-zA-Z\s]+\n/, '').trim();
        
        // Split content into array for bullet point sections
        const formattedContent = ['EXTRACTED_IDEAS', 'ELABORATED_IDEAS'].includes(title)
          ? content.split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim())
          : content;

        output.sections[title] = {
          content: formattedContent,
          format: ['EXTRACTED_IDEAS', 'ELABORATED_IDEAS'].includes(title) ? 'list' : 'text',
          sourceRefs: extractSourceRefs(content)
        };
      }
    });

    return output;
  }
}
