- We use the dedent library for TypeScript multiline string formatting, meaning leading spaces and line breaks are trimmed. Check for examples in the code.
- This is a PLUGIN, not a library. We don't need to maintain backwards API compatibility.
- Remove deprecated code instead of keeping aliases.
- Do not use barrel exports unless there is a reason.
- Comments should be for exceptional or confusing things...not normal code. Be sparing with them.

## TypeScript Best Practices

- Use `unknown` instead of `any`.
- Prefer `const` over `let`.
- Avoid casting (it's almost never necessary).
- Use Zod schemas for any types that may need to be validated at runtime, or produce schema information.
- When using Zod, define the schema as the source of truth and infer the type from it (always use PascalCase for schemas).
- Always export types with the same name as Zod schemas.
  - Example:
    ```typescript
    export const ExampleForAgents = z.object({ foo: z.string() });
    export type ExampleForAgents = z.infer<typeof Example>;
    ```
- Prefer inferred types when possible, unless there's a specific reason to use a type annotation.
- Prefer string literal union types over enums (unless using Zod enums, which are fine)