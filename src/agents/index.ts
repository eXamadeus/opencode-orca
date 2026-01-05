/**
 * Agent definitions for the Orca orchestration system
 *
 * Each agent is a simple config object with mode, description, prompt, and color.
 * The protocol injection is appended by src/plugin/agents.ts when constructing DEFAULT_AGENTS.
 */

export { orca } from './orca'
export { strategist } from './strategist'
export { coder } from './coder'
export { tester } from './tester'
export { reviewer } from './reviewer'
export { researcher } from './researcher'
export { documentWriter } from './document-writer'
export { architect } from './architect'
