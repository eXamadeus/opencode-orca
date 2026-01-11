/**
 * OpenCode Orca Plugin
 *
 * Provides the Orca + Specialists agent orchestration system.
 *
 * @packageDocumentation
 */

// =============================================================================
// IMPORTANT: OpenCode Plugin Export Rules
// =============================================================================
//
// OpenCode's plugin loader iterates ALL exports and calls each as a function:
//
//   for (const [_name, fn] of Object.entries(mod)) {
//     const init = await fn(input)  // <-- Calls EVERY export!
//   }
//
// Therefore:
// - DO NOT export functions (except the default plugin)
// - DO NOT export objects, schemas, or constants
// - This is a PLUGIN, not a library - there are no external consumers
//
// =============================================================================

/**
 * Default plugin instance for OpenCode registration
 * Add to your opencode.jsonc: "plugin": ["@ex-machina/opencode-orca"]
 */
export { default } from './plugin'
