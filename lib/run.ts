import * as fs from 'fs/promises'
import * as readline from 'readline'

import { deepResearch, writeFinalReport } from './deep-research'
import { generateFeedback } from './feedback'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

// Helper function to get user input
function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer)
    })
  })
}

// run the agent
async function run() {
  // Get initial query
  const initialQuery = await askQuestion('What would you like to research? ')

  // Get breath and depth parameters
  const breadth =
    parseInt(
      await askQuestion(
        'Enter research breadth (recommended 2-10, default 4): ',
      ),
      10,
    ) || 4
  const depth =
    parseInt(
      await askQuestion('Enter research depth (recommended 1-5, default 2): '),
      10,
    ) || 2

  console.log(`Creating research plan...`)

  // Generate follow-up questions
  let questions: string[] = []
  for await (const feedback of generateFeedback({
    query: initialQuery,
  })) {
    questions = feedback.questions
  }

  console.log(
    '\nTo better understand your research needs, please answer these follow-up questions:',
  )

  // Collect answers to follow-up questions
  const answers: string[] = []
  for (const question of questions) {
    const answer = await askQuestion(`\n${question}\nYour answer: `)
    answers.push(answer)
  }

  // Combine all information for deep research
  const combinedQuery = `
Initial Query: ${initialQuery}
Follow-up Questions and Answers:
${questions.map((q, i) => `Q: ${q}\nA: ${answers[i]}`).join('\n')}
`

  console.log('\nResearching your topic...')

  const { learnings, visitedUrls } = await deepResearch({
    query: combinedQuery,
    breadth,
    maxDepth: depth,
    onProgress: (step) => {
      // Optional: Add progress logging here if needed
    }
  })

  console.log(`\n\nLearnings:\n\n${learnings.join('\n')}`)
  console.log(
    `\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`,
  )
  console.log('Writing final report...')

  const report = await writeFinalReport({
    prompt: combinedQuery,
    learnings,
    methodId: 'deep-research', // Use deep-research method by default
    visitedUrls,
    currentDate: new Date().toISOString()
  })

  // Save report to file
  await fs.writeFile('output.md', report, 'utf-8')

  console.log(`\n\nFinal Report:\n\n${report}`)
  console.log('\nReport has been saved to output.md')
  rl.close()
}

run().catch(console.error)
