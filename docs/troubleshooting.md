# Troubleshooting

Common issues and solutions for the opencode-orca plugin.

## Installation Issues

**Plugin not found**: Verify `opencode.jsonc` includes `"@ex-machina/opencode-orca"` in the `plugin` array.

**orca.json invalid**: JSON syntax error. Common issues: trailing commas, missing quotes. Validate with `jq . .opencode/orca.json`.

**Permission denied**: Check file permissions: `chmod 755 .opencode && chmod 644 .opencode/orca.json`

## Configuration Issues

**Schema validation errors**: Zod provides detailed paths. Example:
```
Invalid .opencode/orca.json:
  - agents.researcher.temperature: Number must be less than or equal to 2
```
Each line shows `path: message`. Fix the value at the specified path.

**Unknown fields rejected**: Root config uses `strictObject` - only `agents` and `settings` are valid. Remove unrecognized fields.

**Type mismatches**: Common errors include `"0.7"` instead of `0.7` (temperature), `"true"` instead of `true` (disable), and invalid enums like `"sub-agent"` instead of `"subagent"`.

## Runtime Issues

**Agent not responding**: Check for `disable: true` in config. Verify model exists and you have quota.

**Validation failures**: If responses fail format validation, increase `settings.validation.maxRetries` (default: 3, max: 10) or enable `wrapPlainText: true`.

**Agent returns wrong format**: Verify `responseTypes` array includes all message types the agent should produce.

**Empty response**: Model returned empty completion, agent hit max steps, or tool loop consumed output.

## Supervision Issues

**Checkpoint not appearing**: Verify `supervised: true` on the agent. Check that `plan_context.approved_remaining` is not `true`.

**Stuck in approval loop**: Use Ctrl+C to interrupt, then restart the conversation.

**approved_remaining not working**: Ensure the dispatching agent passes the full `plan_context` object in the dispatch payload.

## Error Codes

| Code | Meaning |
|------|---------|
| `VALIDATION_ERROR` | Message format invalid - failed schema validation |
| `UNKNOWN_AGENT` | Agent ID not registered in configuration |
| `SESSION_NOT_FOUND` | Requested session does not exist |
| `AGENT_ERROR` | Agent execution failed (model error, tool failure) |
| `TIMEOUT` | Request exceeded time limit |

## Debugging Tips

1. **Check version compatibility**: Requires `@opencode-ai/plugin` ^1.0.0
2. **Validate JSON first**: Use `jq . .opencode/orca.json` before checking schema
3. **Isolate with minimal config**: Start with empty `{}` and add fields incrementally
4. **Check model availability**: Verify model name and API quota in provider dashboard

## FAQ

**How do I reset to defaults?**
Delete `orca.json` and run `bunx @ex-machina/opencode-orca@latest install` to regenerate from template.

**Can I use multiple orchestrators?**
No. Orca is the primary orchestrator and manages all specialist agents.

**How do I disable an agent?**
Set `disable: true` in the agent configuration:
```json
{ "agents": { "researcher": { "disable": true } } }
```
