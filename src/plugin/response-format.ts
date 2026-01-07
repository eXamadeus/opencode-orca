import dedent from 'dedent'
import type { ResponseType } from './config'

/**
 * Example JSON responses for each response type.
 * Uses <agent_id> as a placeholder that gets replaced with the actual agent ID.
 * Note: Response messages don't include session_id.
 */
export const RESPONSE_TYPE_EXAMPLES: Record<ResponseType, string> = {
  answer: `{
  "type": "answer",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "payload": {
    "agent_id": "<agent_id>",
    "content": "The implementation uses...",
    "sources": [
      { "type": "file", "ref": "src/index.ts", "title": "Main entry", "excerpt": "export function..." }
    ]
  }
}`,

  plan: `{
  "type": "plan",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "payload": {
    "agent_id": "<agent_id>",
    "goal": "Implement feature X with tests",
    "steps": [
      { "description": "Create the data model in src/models/..." },
      { "description": "Add validation logic...", "command": "coder" },
      { "description": "Write unit tests...", "command": "tester" }
    ],
    "assumptions": ["Using existing auth middleware", "PostgreSQL database"],
    "files_touched": ["src/models/user.ts", "src/services/auth.ts"]
  }
}`,

  question: `{
  "type": "question",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "payload": {
    "agent_id": "<agent_id>",
    "question": "Should the API return paginated results or the full list?",
    "options": ["Paginated (recommended for large datasets)", "Full list"],
    "blocking": true
  }
}`,

  escalation: `{
  "type": "escalation",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "payload": {
    "agent_id": "<agent_id>",
    "decision_id": "auth-strategy",
    "decision": "Choose authentication approach for the API",
    "options": [
      { "label": "JWT tokens (stateless)", "value": "jwt" },
      { "label": "Session cookies (stateful)", "value": "session" }
    ],
    "context": "The API will be used by both web and mobile clients..."
  }
}`,

  failure: `{
  "type": "failure",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "payload": {
    "agent_id": "<agent_id>",
    "code": "AGENT_ERROR",
    "message": "Unable to complete the task due to...",
    "cause": "Missing required configuration..."
  }
}`,
}

/**
 * One-line guidance for when to use each response type.
 */
export const TYPE_GUIDANCE: Record<ResponseType, string> = {
  answer: 'Use when providing information, completing analysis, or returning results.',
  plan: 'Use when proposing a multi-step execution plan that requires approval.',
  question: 'Use when you need clarification or user input to proceed.',
  escalation: 'Use when a decision must be made by the user between specific options.',
  failure: 'Use when the task cannot be completed due to an error or blocker.',
}

export const RESPONSE_FORMAT_INJECTION_HEADER = '## Response Format (REQUIRED)'

/**
 * Generate response format instructions for an agent prompt.
 *
 * @param agentId - The agent identifier to inject into examples
 * @param responseTypes - The response types this agent is allowed to produce
 * @returns Formatted markdown instructions, or empty string if no response types
 */
export function generateResponseFormatInstructions(
  agentId: string,
  responseTypes: ResponseType[],
): string {
  if (responseTypes.length === 0) {
    return ''
  }

  const typeList = responseTypes.map((t) => `\`${t}\``).join(', ')

  const guidanceLines = responseTypes.map((t) => `- **${t}**: ${TYPE_GUIDANCE[t]}`).join('\n')

  const examples = responseTypes
    .map((t) => {
      const example = RESPONSE_TYPE_EXAMPLES[t].replace(/<agent_id>/g, agentId)
      return `### ${t}\n\`\`\`json\n${example}\n\`\`\``
    })
    .join('\n\n')

  return dedent`
    ${RESPONSE_FORMAT_INJECTION_HEADER}

    You MUST respond with a valid JSON message envelope.
    
    **Allowed response types:** ${typeList}
    
    ### Type Selection Guidance
    
    ${guidanceLines}
    
    ### JSON Examples
    
    ${examples}`
}
