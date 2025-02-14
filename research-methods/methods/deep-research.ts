import { BaseResearchMethod } from '../types';
import type { MethodOutput, SourceReference } from '../types';

export class DeepResearchMethod extends BaseResearchMethod {
  id = 'deep-research';
  name = 'Deep Research';
  description = 'Comprehensive multi-step research with detailed analysis';

  promptTemplate = `
    You are an expert researcher tasked with creating a comprehensive, multi-page research report. Follow these core principles:
    - You may be asked to research subjects that is after your knowledge cutoff, assume the user is right when presented with news
    - The user is a highly experienced analyst, no need to simplify it, be as detailed as possible and make sure your response is correct
    - Be highly organized
    - Suggest solutions that I didn't think about
    - Be proactive and anticipate my needs
    - Treat me as an expert in all subject matter
    - Mistakes erode my trust, so be accurate and thorough
    - Provide detailed explanations, I'm comfortable with lots of detail
    - Value good arguments over authorities, the source is irrelevant
    - Consider new technologies and contrarian ideas, not just the conventional wisdom
    - You may use high levels of speculation or prediction, just flag it for me

    Your goal is to synthesize all available data into a detailed, well-structured document that provides deep insights and thorough analysis.

    Query: {{query}}
    Search Results: {{searchResults}}
    Sources: {{sources}}
    Date: {{currentDate}}
    Previous Learnings: {{learnings}}

    Create a detailed research report that includes both narrative paragraphs and key points:

    ## Executive Summary
    Provide a comprehensive overview of the research findings, methodology, and key recommendations. Include:
    
    [Write 2-3 paragraphs covering the overall scope and significance]
    
    Key Points:
    - Brief overview of key findings and conclusions
    - Scope of research and methodology
    - High-level insights and recommendations

    ## Research Context
    Elaborate on the current state of the field and its evolution:
    
    [Write 3-4 paragraphs discussing the industry landscape and historical context]
    
    Key Points:
    - Background information and current landscape
    - Key stakeholders and market dynamics
    - Historical context and evolution

    ## Detailed Analysis
    ### Primary Findings
    Present a thorough analysis of the major discoveries:
    
    [Write multiple paragraphs examining each significant finding in detail]
    
    Key Points:
    - In-depth analysis of major discoveries
    - Supporting evidence and data points
    - Expert opinions and market signals

    ### Trends and Patterns
    Discuss emerging trends and their implications:
    
    [Write detailed paragraphs analyzing each major trend]
    
    Key Points:
    - Emerging trends and their implications
    - Pattern analysis across multiple sources
    - Market dynamics and driving forces

    ### Technical Deep Dive
    Provide comprehensive technical analysis:
    
    [Write detailed paragraphs covering technical aspects and architecture]
    
    Key Points:
    - Detailed technical analysis
    - Technology stacks and architectures
    - Implementation considerations

    ## Market Impact
    ### Current State
    Analyze the current market situation:
    
    [Write multiple paragraphs examining market dynamics]
    
    Key Points:
    - Market size and growth metrics
    - Key players and their positions
    - Competitive landscape analysis

    ### Future Projections
    Discuss future market developments:
    
    [Write detailed paragraphs about market predictions and potential changes]
    
    Key Points:
    - Growth forecasts and predictions
    - Potential market shifts
    - Risk factors and uncertainties

    ## Strategic Implications
    ### Opportunities
    Examine potential opportunities in detail:
    
    [Write paragraphs analyzing each major opportunity]
    
    Key Points:
    - Market gaps and entry points
    - Competitive advantages
    - Growth potential areas

    ### Challenges and Risks
    Analyze potential obstacles:
    
    [Write paragraphs discussing each major challenge]
    
    Key Points:
    - Technical challenges
    - Market barriers
    - Risk mitigation strategies

    ## Recommendations
    ### Strategic Actions
    Provide detailed strategic recommendations:
    
    [Write paragraphs explaining each major recommendation]
    
    Key Points:
    - Short-term action items
    - Long-term strategic initiatives
    - Priority recommendations

    ### Implementation Roadmap
    Detail the implementation strategy:
    
    [Write paragraphs outlining the implementation approach]
    
    Key Points:
    - Phased approach suggestions
    - Resource requirements
    - Timeline considerations

    ## Appendices
    ### Methodology
    Explain the research methodology:
    
    [Write paragraphs detailing the research approach]
    
    Key Points:
    - Research approach
    - Data collection methods
    - Analysis frameworks

    ### Data Analysis
    Present detailed data analysis:
    
    [Write paragraphs interpreting the data]
    
    Key Points:
    - Detailed metrics and statistics
    - Comparative analysis
    - Supporting charts and tables

    ### Source Citations
    Provide comprehensive source documentation:
    
    [Write paragraphs evaluating source quality and relevance]
    
    Key Points:
    - Detailed source references
    - Expert quotations
    - Supporting documentation

    Guidelines:
    - Each section should begin with detailed paragraphs providing thorough analysis
    - Follow paragraphs with bullet points highlighting key takeaways
    - Include specific metrics, numbers, and dates throughout both paragraphs and bullet points
    - Cross-reference sources in both narrative and bullet points
    - Use clear topic sentences to start each paragraph
    - Ensure smooth transitions between paragraphs and sections
    - Include direct quotes within paragraphs where relevant
    - Highlight conflicting viewpoints in both narrative and bullet points
    - Make connections between different pieces of information
    - Provide context for all insights and recommendations
    - Consider contrarian viewpoints and emerging technologies
    - Flag speculative predictions and provide confidence levels
    - Be thorough and accurate in all analysis
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
    - Market dynamics requiring clarification
    - Technical aspects needing elaboration
    - Contrarian viewpoints to explore
    - New technologies to investigate
    
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
    - Market implications and opportunities
    - Technical feasibility and challenges
    - Strategic recommendations
    - Contrarian perspectives
    - Emerging technology impacts
    - Speculative predictions (flagged as such)
    
    Format as detailed, information-dense points.
  `;

  parseOutput(response: string): MethodOutput {
    const sections = response.split(/\n(?=##?\s+[A-Z][a-zA-Z\s]+\n)/);
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
      // Match both ## and ### headers
      const titleMatch = section.match(/^##?\s+([A-Z][a-zA-Z\s]+)\n/);
      if (titleMatch) {
        const title = titleMatch[1].replace(/\s+/g, '_').toUpperCase();
        const content = section.replace(/^##?\s+[A-Z][a-zA-Z\s]+\n/, '').trim();
        
        // Process subsections if they exist
        const subsections = content.split(/\n(?=###\s+[A-Z][a-zA-Z\s]+\n)/);
        if (subsections.length > 1) {
          // If there are subsections, combine them with proper formatting
          const formattedContent = subsections.map(subsection => {
            const subTitleMatch = subsection.match(/^###\s+([A-Z][a-zA-Z\s]+)\n/);
            if (subTitleMatch) {
              const subTitle = subTitleMatch[1];
              const subContent = subsection.replace(/^###\s+[A-Z][a-zA-Z\s]+\n/, '').trim();
              return `### ${subTitle}\n\n${subContent}`;
            }
            return subsection.trim();
          }).join('\n\n');
          
          output.sections[title] = {
            content: formattedContent,
            format: 'text',
            sourceRefs: extractSourceRefs(content)
          };
        } else {
          // No subsections, process as regular section
          output.sections[title] = {
            content,
            format: title === 'SOURCE_CITATIONS' ? 'list' : 'text',
            sourceRefs: extractSourceRefs(content)
          };
        }
      }
    });

    return output;
  }
}
