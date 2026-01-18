import type {
  OpencodeClient as OpencodeClientV2,
  QuestionAnswer,
  QuestionInfo,
} from '@opencode-ai/sdk/v2'
import { getLogger } from './log'

export type QuestionResult = { type: 'answered'; answers: QuestionAnswer[] } | { type: 'rejected' }

type PendingQuestion = {
  resolve: (result: QuestionResult) => void
  reject: (error: Error) => void
}

/** Pending questions waiting for answers */
const pending = new Map<string, PendingQuestion>()

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
    p.resolve({ type: 'answered', answers })
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
    p.resolve({ type: 'rejected' })
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

  return new Promise<QuestionResult>((resolve, reject) => {
    pending.set(questionId, { resolve, reject })
  })
}
