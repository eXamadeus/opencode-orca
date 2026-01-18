import type {
  OpencodeClient as OpencodeClientV2,
  QuestionAnswer,
  QuestionInfo,
} from '@opencode-ai/sdk/v2'
import { QUESTION_TIMEOUT_MS } from './constants'
import { getLogger } from './log'

export type QuestionResult =
  | { type: 'answered'; answers: QuestionAnswer[] }
  | { type: 'rejected' }
  | { type: 'timeout' }

/** Pending questions waiting for answers, keyed by question ID */
const pending = new Map<string, (result: QuestionResult) => void>()

/**
 * Handle a question.replied event
 */
export function handleQuestionReplied(requestID: string, answers: QuestionAnswer[]): void {
  const log = getLogger()
  log.debug('handleQuestionReplied', { requestID, pendingKeys: [...pending.keys()] })
  const p = pending.get(requestID)
  if (p) {
    log.info('Resolved pending question', { requestID })
    pending.delete(requestID)
    p({ type: 'answered', answers })
  } else {
    log.warn('No pending question found', { requestID })
  }
}

/**
 * Handle a question.rejected event
 */
export function handleQuestionRejected(requestID: string): void {
  const log = getLogger()
  const p = pending.get(requestID)
  if (p) {
    log.info('Question rejected', { requestID })
    pending.delete(requestID)
    p({ type: 'rejected' })
  } else {
    log.warn('No pending question found', { requestID })
  }
}

/**
 * Ask a question and wait for the user's response
 */
export async function askQuestion(
  client: OpencodeClientV2,
  sessionID: string,
  questions: QuestionInfo[],
): Promise<QuestionResult> {
  const log = getLogger()

  const result = await client.question.ask({
    questionAskInput: {
      sessionID,
      questions: questions.map((q) => ({
        question: q.question,
        header: q.header,
        options: q.options,
      })),
    },
  })

  const questionId = result.data?.id
  if (!questionId) {
    throw new Error('Failed to create question: no ID returned')
  }

  log.info('Question asked', { questionId, sessionID })

  return new Promise<QuestionResult>((resolve) => {
    const timeoutId = setTimeout(() => {
      if (pending.has(questionId)) {
        pending.delete(questionId)
        log.warn('Question timed out', { questionId, timeoutMs: QUESTION_TIMEOUT_MS })
        resolve({ type: 'timeout' })
      }
    }, QUESTION_TIMEOUT_MS)

    pending.set(questionId, (result) => {
      clearTimeout(timeoutId)
      resolve(result)
    })
  })
}
