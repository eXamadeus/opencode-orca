import { describe, expect, test } from 'bun:test'
import type { ZodTypeAny } from 'zod'
import {
  AnnotationSchema,
  AnswerPayloadSchema,
  CheckpointPayloadSchema,
  EscalationOptionSchema,
  EscalationPayloadSchema,
  FailurePayloadSchema,
  InterruptPayloadSchema,
  PlanContextSchema,
  PlanPayloadSchema,
  PlanStepSchema,
  QuestionPayloadSchema,
  SourceSchema,
  TaskPayloadSchema,
  UserInputPayloadSchema,
} from '../payloads'

// Valid fixtures for strict mode tests
const validFixtures: [string, ZodTypeAny, Record<string, unknown>][] = [
  ['TaskPayloadSchema', TaskPayloadSchema, { agent_id: 'a', prompt: 'p' }],
  ['PlanStepSchema', PlanStepSchema, { description: 'd' }],
  [
    'PlanPayloadSchema',
    PlanPayloadSchema,
    { agent_id: 'a', goal: 'g', steps: [{ description: 'd' }] },
  ],
  ['SourceSchema', SourceSchema, { type: 'file', ref: 'src/index.ts' }],
  ['AnnotationSchema', AnnotationSchema, { type: 'note', content: 'n' }],
  ['AnswerPayloadSchema', AnswerPayloadSchema, { agent_id: 'a', content: 'c' }],
  [
    'QuestionPayloadSchema',
    QuestionPayloadSchema,
    { agent_id: 'a', question: 'q', blocking: true },
  ],
  ['EscalationOptionSchema', EscalationOptionSchema, { label: 'l', value: 'v' }],
  [
    'EscalationPayloadSchema',
    EscalationPayloadSchema,
    {
      agent_id: 'a',
      decision_id: 'd',
      decision: 'd',
      options: [{ label: 'l', value: 'v' }],
      context: 'c',
    },
  ],
  ['UserInputPayloadSchema', UserInputPayloadSchema, { content: 'c' }],
  ['InterruptPayloadSchema', InterruptPayloadSchema, { reason: 'r' }],
  ['FailurePayloadSchema', FailurePayloadSchema, { code: 'AGENT_ERROR', message: 'm' }],
  ['CheckpointPayloadSchema', CheckpointPayloadSchema, { agent_id: 'a', prompt: 'p' }],
  ['PlanContextSchema', PlanContextSchema, { goal: 'g', step_index: 0, approved_remaining: false }],
]

describe('strict mode rejects extra fields', () => {
  test.each(validFixtures)('%s', (_name, schema, valid) => {
    expect(() => schema.parse({ ...valid, extra: 'field' })).toThrow()
  })
})

describe('min(1) constraints reject empty values', () => {
  test('TaskPayloadSchema rejects empty prompt', () => {
    expect(() => TaskPayloadSchema.parse({ agent_id: 'a', prompt: '' })).toThrow()
  })

  test('PlanStepSchema rejects empty description', () => {
    expect(() => PlanStepSchema.parse({ description: '' })).toThrow()
  })

  test('PlanPayloadSchema rejects empty goal', () => {
    expect(() =>
      PlanPayloadSchema.parse({
        agent_id: 'a',
        goal: '',
        steps: [{ description: 'd' }],
      }),
    ).toThrow()
  })

  test('PlanPayloadSchema rejects empty steps array', () => {
    expect(() => PlanPayloadSchema.parse({ agent_id: 'a', goal: 'g', steps: [] })).toThrow()
  })

  test('QuestionPayloadSchema rejects empty question', () => {
    expect(() =>
      QuestionPayloadSchema.parse({ agent_id: 'a', question: '', blocking: true }),
    ).toThrow()
  })

  test('EscalationOptionSchema rejects empty label', () => {
    expect(() => EscalationOptionSchema.parse({ label: '', value: 'v' })).toThrow()
  })

  test('EscalationOptionSchema rejects empty value', () => {
    expect(() => EscalationOptionSchema.parse({ label: 'l', value: '' })).toThrow()
  })

  test('EscalationPayloadSchema rejects empty options array', () => {
    expect(() =>
      EscalationPayloadSchema.parse({
        agent_id: 'a',
        decision_id: 'd',
        decision: 'd',
        options: [],
        context: 'c',
      }),
    ).toThrow()
  })

  test('EscalationPayloadSchema rejects empty decision_id', () => {
    expect(() =>
      EscalationPayloadSchema.parse({
        agent_id: 'a',
        decision_id: '',
        decision: 'd',
        options: [{ label: 'l', value: 'v' }],
        context: 'c',
      }),
    ).toThrow()
  })

  test('InterruptPayloadSchema rejects empty reason', () => {
    expect(() => InterruptPayloadSchema.parse({ reason: '' })).toThrow()
  })

  test('FailurePayloadSchema rejects empty message', () => {
    expect(() => FailurePayloadSchema.parse({ code: 'AGENT_ERROR', message: '' })).toThrow()
  })
})

describe('intentional design decisions', () => {
  test('UserInputPayloadSchema allows empty content', () => {
    // Intentionally no .min(1) — users can send empty messages
    const result = UserInputPayloadSchema.parse({ content: '' })
    expect(result.content).toBe('')
  })
})

describe('CheckpointPayloadSchema', () => {
  test('accepts minimal checkpoint payload', () => {
    const payload = { agent_id: 'coder', prompt: 'Write tests' }
    expect(CheckpointPayloadSchema.parse(payload)).toEqual(payload)
  })

  test('accepts full checkpoint payload with optional fields', () => {
    const payload = {
      agent_id: 'coder',
      prompt: 'Write tests',
      step_index: 2,
      plan_goal: 'Implement feature X',
    }
    expect(CheckpointPayloadSchema.parse(payload)).toEqual(payload)
  })

  test('rejects empty prompt', () => {
    expect(() => CheckpointPayloadSchema.parse({ agent_id: 'a', prompt: '' })).toThrow()
  })

  test('rejects negative step_index', () => {
    expect(() =>
      CheckpointPayloadSchema.parse({ agent_id: 'a', prompt: 'p', step_index: -1 }),
    ).toThrow()
  })
})

describe('PlanContextSchema', () => {
  test('accepts valid plan context', () => {
    const context = { goal: 'Deploy app', step_index: 0, approved_remaining: false }
    expect(PlanContextSchema.parse(context)).toEqual(context)
  })

  test('rejects empty goal', () => {
    expect(() =>
      PlanContextSchema.parse({ goal: '', step_index: 0, approved_remaining: false }),
    ).toThrow()
  })

  test('rejects negative step_index', () => {
    expect(() =>
      PlanContextSchema.parse({ goal: 'g', step_index: -1, approved_remaining: false }),
    ).toThrow()
  })

  test('requires all fields (no optionals)', () => {
    expect(() => PlanContextSchema.parse({ goal: 'g', step_index: 0 })).toThrow()
    expect(() => PlanContextSchema.parse({ goal: 'g', approved_remaining: false })).toThrow()
  })
})

describe('TaskPayloadSchema with plan_context', () => {
  test('accepts task payload with plan_context', () => {
    const payload = {
      agent_id: 'coder',
      prompt: 'Write code',
      plan_context: {
        goal: 'Build feature',
        step_index: 1,
        approved_remaining: true,
      },
    }
    expect(TaskPayloadSchema.parse(payload)).toEqual(payload)
  })

  test('accepts task payload without plan_context', () => {
    const payload = { agent_id: 'coder', prompt: 'Write code' }
    expect(TaskPayloadSchema.parse(payload)).toEqual(payload)
  })
})

describe('SourceSchema', () => {
  test('accepts file source', () => {
    const source = { type: 'file' as const, ref: 'src/index.ts' }
    expect(SourceSchema.parse(source)).toEqual(source)
  })

  test('accepts url source', () => {
    const source = { type: 'url' as const, ref: 'https://example.com' }
    expect(SourceSchema.parse(source)).toEqual(source)
  })

  test('accepts artifact source', () => {
    const source = { type: 'artifact' as const, ref: 'output.json' }
    expect(SourceSchema.parse(source)).toEqual(source)
  })

  test('accepts optional fields', () => {
    const source = {
      type: 'file' as const,
      ref: 'src/index.ts',
      title: 'Main entry',
      excerpt: 'lines 1-10',
    }
    expect(SourceSchema.parse(source)).toEqual(source)
  })

  test('rejects invalid type', () => {
    expect(() => SourceSchema.parse({ type: 'invalid', ref: 'test' })).toThrow()
  })
})

describe('AnnotationSchema', () => {
  test('accepts note annotation', () => {
    const annotation = { type: 'note' as const, content: 'Important note' }
    expect(AnnotationSchema.parse(annotation)).toEqual(annotation)
  })

  test('accepts warning annotation', () => {
    const annotation = { type: 'warning' as const, content: 'Be careful' }
    expect(AnnotationSchema.parse(annotation)).toEqual(annotation)
  })

  test('accepts assumption annotation', () => {
    const annotation = { type: 'assumption' as const, content: 'Assuming X' }
    expect(AnnotationSchema.parse(annotation)).toEqual(annotation)
  })

  test('accepts caveat annotation', () => {
    const annotation = { type: 'caveat' as const, content: 'This may change' }
    expect(AnnotationSchema.parse(annotation)).toEqual(annotation)
  })

  test('rejects invalid type', () => {
    expect(() => AnnotationSchema.parse({ type: 'invalid', content: 'test' })).toThrow()
  })
})

describe('AnswerPayloadSchema with sources and annotations', () => {
  test('accepts answer with sources', () => {
    const payload = {
      agent_id: 'researcher',
      content: 'Found the answer',
      sources: [{ type: 'file' as const, ref: 'src/index.ts' }],
    }
    expect(AnswerPayloadSchema.parse(payload)).toEqual(payload)
  })

  test('accepts answer with annotations', () => {
    const payload = {
      agent_id: 'researcher',
      content: 'Found the answer',
      annotations: [{ type: 'note' as const, content: 'Verified' }],
    }
    expect(AnswerPayloadSchema.parse(payload)).toEqual(payload)
  })

  test('accepts answer with both sources and annotations', () => {
    const payload = {
      agent_id: 'researcher',
      content: 'Found the answer',
      sources: [{ type: 'file' as const, ref: 'src/index.ts', excerpt: 'lines 1-10' }],
      annotations: [
        { type: 'assumption' as const, content: 'Assuming latest version' },
        { type: 'warning' as const, content: 'May be deprecated' },
      ],
    }
    expect(AnswerPayloadSchema.parse(payload)).toEqual(payload)
  })

  test('accepts minimal answer without optional fields', () => {
    const payload = { agent_id: 'coder', content: 'Done' }
    expect(AnswerPayloadSchema.parse(payload)).toEqual(payload)
  })
})
