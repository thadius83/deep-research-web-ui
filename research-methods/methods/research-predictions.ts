import { BaseResearchMethod } from '../types'
import type { ResearchContext, MethodOutput, MethodOutputSection } from '../types'

export class ResearchPredictionsMethod extends BaseResearchMethod {
  override id = 'research-predictions'
  override name = 'Research Predictions'
  override description = 'Extract and analyze future predictions with confidence levels and timelines'

  override promptTemplate = `
You are a prediction analysis expert. Your task is to analyze the research findings and extract specific predictions with detailed analysis.

CONTEXT:
Query: {{query}}
Current Date: {{currentDate}}

RESEARCH FINDINGS:
{{searchResults}}

PREVIOUS LEARNINGS:
{{learnings}}

Your analysis should include:

## Predictions

For each prediction found in the research:
- Prediction: [Specific prediction in 16 words or less]
- Target Date: [Specific date/timeframe, must be explicit]
- Confidence: [Low/Medium/High] with reasoning
- Supporting Evidence: [Key evidence from sources]
- Verification Criteria: [Clear, measurable criteria to verify if prediction comes true]

## Analysis

Provide a detailed analysis covering:
- Dependencies: Key factors that could influence these predictions
- Alternative Scenarios: What could happen instead and why
- Risk Assessment: Major risks that could affect these predictions
- Uncertainty Factors: Variables that could change the outcomes

## Methodology

Explain your approach including:
- Sources Used: Quality and reliability of sources
- Time Horizon: Range of prediction timeframes
- Confidence Framework: How confidence levels were determined

You MUST:
- Include specific dates/timeframes for each prediction
- Provide clear verification criteria
- Assign and justify confidence levels
- Link predictions to supporting evidence
- Focus on measurable outcomes
`

  override followUpTemplate = `
Given the previous research on predictions about {{topic}}, generate follow-up questions to:
1. Clarify timeframes and dates
2. Identify missing verification criteria
3. Find conflicting predictions
4. Explore alternative scenarios
5. Uncover additional dependencies

Focus on questions that will help make predictions more specific and verifiable.
`

  override learningTemplate = `
Extract key learnings about predictions for {{topic}}, focusing on:
1. Specific dates and timeframes
2. Clear, measurable outcomes
3. Supporting evidence
4. Verification criteria
5. Confidence levels and reasoning

Each learning should be a complete, self-contained insight about a prediction.
`

  override parseOutput(response: string): MethodOutput {
    const sections = response.split(/\n(?=##\s+[A-Z][a-zA-Z]+\n)/);
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
      const titleMatch = section.match(/^##\s+([A-Z][a-zA-Z]+)\n/);
      if (titleMatch) {
        const title = titleMatch[1].toUpperCase();
        const content = section.replace(/^##\s+[A-Z][a-zA-Z]+\n/, '').trim();
        
        // Split content into array for bullet point sections
        const formattedContent = title === 'PREDICTIONS'
          ? content.split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim())
          : content;

        output.sections[title] = {
          content: formattedContent,
          format: title === 'PREDICTIONS' ? 'list' : 'text',
          sourceRefs: extractSourceRefs(content)
        };
      }
    });

    return output;
  }

  override validateOutput(output: MethodOutput): boolean {
    return Object.values(output.sections).every(section => 
      section.content !== undefined && 
      section.format !== undefined &&
      section.sourceRefs !== undefined
    );
  }
}
