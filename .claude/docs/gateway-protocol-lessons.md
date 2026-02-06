---
description: "Hard-won lessons from debugging OpenClaw Gateway WebSocket protocol interactions"
globs: ["packages/gateway-client/**/*.ts", "apps/api/src/gateway/**/*.ts", "apps/api/src/reconciler/**/*.ts"]
alwaysApply: false
---

# OpenClaw Gateway Protocol — Hard-Won Lessons

These are protocol details discovered through debugging real gateway interactions. **Do not guess protocol shapes — always verify against the OpenClaw source at `src/gateway/protocol/schema/`.**

Last updated: 2026-02-06

## RPC Parameter Validation is Strict

OpenClaw uses TypeBox schemas with `additionalProperties: false`. Any unknown property in an RPC request causes an `INVALID_REQUEST` error. Always check the exact schema in `src/gateway/protocol/schema/` before adding or renaming fields.

## The `agent` RPC

- **Required fields**: `message` (not `prompt`), `idempotencyKey` (not optional)
- **Timeout field**: `timeout` (not `timeoutMs`) — integer in milliseconds
- **Session targeting**: Requires at least one of `agentId`, `to`, or `sessionId`. For default agent, use `agentId: "main"`.
- **Delivery control**: Set `deliver: false` to prevent delivery to a channel (useful for internal probes).
- **Full schema reference**: `src/gateway/protocol/schema/agent.ts` → `AgentParamsSchema`

## Two-Phase Agent Response Pattern

The `agent` RPC uses **two `res` frames with the same `id`**:

1. **Ack (immediate)**: `{ type: "res", id: "<req-id>", ok: true, payload: { runId: "<idempotencyKey>", status: "accepted", acceptedAt: <timestamp> } }`
2. **Completion (after LLM finishes)**: `{ type: "res", id: "<same-req-id>", ok: true, payload: { runId: "...", status: "ok", summary: "completed", result: { payloads: [{ text: "...", mediaUrl: null }], meta: {...} } } }`

**Critical: `summary` is NOT the agent output.** The actual text is in `result.payloads[0].text`. Do NOT use `summary` or `result` directly as the output string.

**Critical client detail**: After the first `res` frame resolves the pending handler, you must **re-register on the same message `id`** to catch the second `res` frame. Otherwise the completion is silently dropped.

## The `agent.identity.get` RPC

Returns `{ agentId, name, avatar }`. Often returns defaults (`{ name: "Assistant", avatar: "A" }`). Probing via the `agent` RPC is more reliable for getting real identity.

## Debugging Gateway Issues

1. **Check Docker logs**: `docker logs <container-name> --tail 50`
2. **Container naming**: `openclaw-<bot-name>` (e.g., `openclaw-test-l-1`)
3. **Error format**: `⇄ res ✗ <method> errorCode=<CODE> errorMessage=<msg>`
4. **Don't assume protocol shapes** — gateway validates at runtime with strict schemas. A build passing does NOT mean the wire protocol is correct.
