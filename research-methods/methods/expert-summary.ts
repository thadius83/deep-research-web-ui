import { BaseResearchMethod } from '../types';
import type { MethodOutput, SourceReference } from '../types';

export class ExpertSummaryMethod extends BaseResearchMethod {
  id = 'expert-summary';
  name = 'Expert Summarization';
  description = 'Expert-level summarization with key insights and analysis';

  promptTemplate = `
    You are an advanced AI with a 2,128 IQ and you are an expert in understanding any input and extracting the most important ideas from it.

    Query: {{query}}
    Search Results: {{searchResults}}
    Sources: {{sources}}
    Date: {{currentDate}}
    Previous Learnings: {{learnings}}

    Spend time fully digesting the input provided and create a mental map of all the different ideas, facts, and references. Create a giant graph of all the connections between them.

    Extract all of the ideas from the content in clear, concise bullet points.

    Your analysis should include:

    ## Summary
    [High-level summary with key points]

    ## Key Ideas
    - [15-word bullet points capturing main ideas with source references]

    ## Connections
    [Relationships and patterns between ideas]

    ## Insights
    - [Higher-level abstractions and implications]

    ## Source References
    [Source details and citations]
  `;

  followUpTemplate = `
    Query: {{query}}
    Previous Learnings: {{learnings}}
    Date: {{currentDate}}
    
    Based on the current understanding:
    1. What requires deeper exploration?
    2. What patterns need validation?
    3. What perspectives are missing?
    
    Generate 3-5 specific follow-up questions.
  `;

  learningTemplate = `
    Query: {{query}}
    Previous Learnings: {{learnings}}
    Date: {{currentDate}}
    Sources: {{sources}}
    
    Synthesize the key insights from the research:
    1. What are the most important findings?
    2. What patterns have emerged?
    3. What conclusions can be drawn?
    
    Format as clear, actionable insights with source links.
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
        const formattedContent = ['KEY_IDEAS', 'INSIGHTS'].includes(title)
          ? content.split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim())
          : content;

        output.sections[title] = {
          content: formattedContent,
          format: ['KEY_IDEAS', 'INSIGHTS'].includes(title) ? 'list' : 'text',
          sourceRefs: extractSourceRefs(content)
        };
      }
    });

    return output;
  }
}
