import { BaseResearchMethod } from '../types';
import type { MethodOutput, SourceReference } from '../types';

export class DeepResearchMethod extends BaseResearchMethod {
  id = 'deep-research';
  name = 'Deep Research';
  description = 'Comprehensive multi-step research with detailed analysis';

  promptTemplate = `
    You are an expert researcher. Follow these instructions when responding:
    - You may be asked to research subjects that is after your knowledge cutoff, assume the user is right when presented with news.
    - The user is a highly experienced analyst, no need to simplify it, be as detailed as possible and make sure your response is correct.
    - Be highly organized.
    - Suggest solutions that I didn't think about.
    - Be proactive and anticipate my needs.
    - Treat me as an expert in all subject matter.
    - Mistakes erode my trust, so be accurate and thorough.
    - Provide detailed explanations, I'm comfortable with lots of detail.
    - Value good arguments over authorities, the source is irrelevant.
    - Consider new technologies and contrarian ideas, not just the conventional wisdom.
    - You may use high levels of speculation or prediction, just flag it for me.

    Query: {{query}}
    Search Results: {{searchResults}}
    Sources: {{sources}}
    Date: {{currentDate}}
    Previous Learnings: {{learnings}}

    Generate a list of learnings from the contents. The learnings should be concise and to the point, as detailed and information dense as possible. Make sure to include any entities like people, places, companies, products, things, etc in the learnings, as well as any exact metrics, numbers, or dates.

    OUTPUT FORMAT:
    1. ANALYSIS
    2. KEY_FINDINGS
    3. CONNECTIONS
    4. CONCLUSIONS
    5. SOURCE_REFERENCES
  `;

  followUpTemplate = `
    Query: {{query}}
    Previous Learnings: {{learnings}}
    Date: {{currentDate}}
    
    Based on the current research, generate specific follow-up questions. Focus on:
    - Critical gaps in current knowledge
    - Potential contradictions that need resolution
    - Emerging patterns that warrant deeper investigation
    - Unexplored angles and perspectives
    
    Format as a list of clear, focused questions.
  `;

  learningTemplate = `
    Query: {{query}}
    Previous Learnings: {{learnings}}
    Date: {{currentDate}}
    Sources: {{sources}}
    
    Synthesize the key insights from the research, ensuring:
    - Maximum detail and accuracy
    - Clear source attribution
    - Specific metrics and data points
    - Identification of patterns and trends
    
    Format as detailed, information-dense points.
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
        
        output.sections[title] = {
          content,
          format: title === 'SOURCE_REFERENCES' ? 'list' : 'text',
          sourceRefs: extractSourceRefs(content)
        };
      }
    });

    return output;
  }
}
