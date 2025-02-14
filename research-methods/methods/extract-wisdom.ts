import { BaseResearchMethod } from '../types';
import type { MethodOutput, SourceReference } from '../types';

export class ExtractWisdomMethod extends BaseResearchMethod {
  id = 'extract-wisdom';
  name = 'Extract Wisdom';
  description = 'Deep insights and practical wisdom extraction with comprehensive analysis';

  promptTemplate = `
    You are a wisdom extraction expert focused on deriving deep insights related to human flourishing, technology impact, learning, and continuous improvement.

    Query: {{query}}
    Search Results: {{searchResults}}
    Sources: {{sources}}
    Date: {{currentDate}}
    Previous Learnings: {{learnings}}

    Extract surprising, insightful, and interesting information from the content, focusing on practical wisdom and actionable insights.

    Your analysis should include:

    ## Summary
    [25-word summary of content, context, and key themes]

    ## Key Ideas
    - [20-50 surprising and insightful ideas with source references]

    ## Insights
    - [10-20 refined, abstracted wisdom points]

    ## Practical Habits
    - [15-30 actionable habits and practices]

    ## Facts
    - [15-30 surprising facts about the broader context]

    ## Recommendations
    - [15-30 practical recommendations]

    ## Source References
    [Source details and citations]

    Guidelines:
    - Focus on actionable wisdom
    - Include specific examples and practices
    - Note relationships between concepts
    - Identify underlying principles
    - Extract practical applications
  `;

  followUpTemplate = `
    Query: {{query}}
    Previous Learnings: {{learnings}}
    Date: {{currentDate}}
    
    Based on the extracted wisdom:
    1. What principles need deeper exploration?
    2. What practices need validation?
    3. What contexts need consideration?
    
    Generate 3-5 specific follow-up questions.
  `;

  learningTemplate = `
    Query: {{query}}
    Previous Learnings: {{learnings}}
    Date: {{currentDate}}
    Sources: {{sources}}
    
    Synthesize the key wisdom:
    1. What are the fundamental principles?
    2. What patterns reveal deeper truths?
    3. What practices demonstrate effectiveness?
    
    Format as clear, actionable wisdom with examples and source links.
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
        const formattedContent = ['KEY_IDEAS', 'INSIGHTS', 'PRACTICAL_HABITS', 'FACTS', 'RECOMMENDATIONS'].includes(title)
          ? content.split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim())
          : content;

        output.sections[title] = {
          content: formattedContent,
          format: ['KEY_IDEAS', 'INSIGHTS', 'PRACTICAL_HABITS', 'FACTS', 'RECOMMENDATIONS'].includes(title) ? 'list' : 'text',
          sourceRefs: extractSourceRefs(content)
        };
      }
    });

    return output;
  }
}
