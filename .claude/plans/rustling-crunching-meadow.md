# Plan: Fix Loader, Fix Gateway Disconnect, Add LLM API Key Step

## Problem 1: Deployment Loader Stuck / Not Showing Step Progress

**Root Cause**: The `useProvisioningEvents` hook starts polling every 3s, but backend steps fire synchronously before the WebSocket connects. The first poll catches steps already completed. More critically, the `StepDeploying` component has a **parallel polling fallback** (every 5s) that checks `/onboarding/deploy/{id}/status` — when this returns `status: "RUNNING"`, `pollStatus` becomes `"RUNNING"` and `isComplete` becomes true, jumping straight to the success screen even if the provisioning events haven't finished streaming.

**Fix**: The 5s polling fallback in `step-deploying.tsx` short-circuits the progress display. When the bot instance status becomes `RUNNING` in the DB (which happens at the end of provisioning), the poll detects it and shows the success screen immediately — bypassing the animated step-by-step progress. Fix this by:

1. **Remove the aggressive poll-based completion detection** in `step-deploying.tsx`. The `pollStatus === "RUNNING"` check on line 69 causes the loader to jump to success as soon as the bot is running, before the provisioning events service has streamed all steps.
2. **Only use `progress?.status === "completed"` for completion** — this comes from the provisioning events system which properly marks all steps before marking completed.
3. **Keep the poll for error detection only** (the poll should still catch `ERROR` status to show failures).

| File | Change |
|------|--------|
| `apps/web/src/components/deploy-wizard/step-deploying.tsx` | Remove `pollStatus === "RUNNING"` from `isComplete` condition. Only use provisioning events for completion. Keep poll for error detection. |

---

## Problem 2: "disconnected (1008): pairing required" in OpenClaw Dashboard

**Root Cause**: This message in the OpenClaw Control UI iframe is **expected behavior** — it means the WhatsApp channel is configured but hasn't been QR-paired yet. This is NOT a gateway auth issue. The Control UI auto-connects to the gateway (the token is passed via `?token=` query param), but WhatsApp shows "pairing required" because the user hasn't scanned the QR code yet.

**Fix**: This is a UX problem, not a bug. The user expects channels to "just work" after selecting them in the wizard, but WhatsApp requires post-deployment QR pairing. Fix by:

1. **Add a post-deployment guidance banner** in `step-deploying.tsx` success screen that tells the user to complete WhatsApp QR pairing via the Dashboard tab.
2. **Add a note in the Dashboard tab** (in `bot-detail-client.tsx`) when WhatsApp is configured but not paired, explaining how to pair.

| File | Change |
|------|--------|
| `apps/web/src/components/deploy-wizard/step-deploying.tsx` | Add WhatsApp pairing guidance to success screen when WhatsApp channel is configured |
| `apps/web/src/app/bots/[id]/bot-detail-client.tsx` | Add info banner above iframe noting that WhatsApp QR pairing is done from the Dashboard > Channels section |

---

## Problem 3: Add LLM API Key Step to Deploy Wizard

**Goal**: Let users configure an LLM provider and API key during the wizard, so the bot can actually respond to messages.

**How OpenClaw handles this**:
- Model is set via `agents.defaults.model.primary` (format: `provider/model-id`, e.g. `"anthropic/claude-sonnet-4-5"`)
- API keys are loaded from environment variables: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`
- OpenClaw reads `~/.openclaw/.env` as a fallback (which maps to `/home/node/.openclaw/.env` in Docker)
- The config directory is already mounted as a volume: `configPath:/home/node/.openclaw`

**Implementation**:

### A. New wizard step: `step-model.tsx`

Add a new step between "Channels" (step 1) and "Name & Deploy" (step 2):

- **Provider selector**: Cards for Anthropic, OpenAI, Google (Gemini), Groq, OpenRouter
- **API key input**: Password field for the API key
- **Model selector**: Dropdown with popular models for the selected provider:
  - Anthropic: `claude-sonnet-4-5`, `claude-opus-4-5`, `claude-haiku-3-5`
  - OpenAI: `gpt-4o`, `gpt-4o-mini`, `o3-mini`
  - Google: `gemini-2.5-pro`, `gemini-2.5-flash`
  - Groq: `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`
  - OpenRouter: text input for any model ID
- **Skip option**: "Skip for now" button (bot won't be able to chat until configured later)

### B. Wire into deploy wizard

- Add the new step to `deploy-wizard.tsx` as step 2 (shifting Name & Deploy to step 3, Deploying to step 4)
- Update step indicators and navigation
- Pass model config to the deploy API call

### C. Backend: Accept model config in deploy DTO

- Add `modelConfig?: { provider: string; model: string; apiKey: string }` to the onboarding deploy DTO
- In `onboarding.service.ts`, set `agents.defaults.model.primary` to `${provider}/${model}`
- Store the API key env var name + value for the Docker target

### D. Write .env file in Docker target

- In `DockerContainerTarget.configure()`, if `config.environment` is provided, write a `.env` file to `configPath/.env`
- OpenClaw will automatically read `/home/node/.openclaw/.env` on startup
- Map provider to env var name: `{ anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", ... }`

### E. Pass environment through lifecycle manager

- In `lifecycle-manager.service.ts`, pass the environment dict to `target.configure()`

| File | Change |
|------|--------|
| `apps/web/src/components/deploy-wizard/step-model.tsx` | **NEW** — Provider/model/API key selection step |
| `apps/web/src/components/deploy-wizard/deploy-wizard.tsx` | Add step-model as step 2, shift later steps, pass model config |
| `apps/web/src/components/deploy-wizard/step-name-deploy.tsx` | Show selected model in summary |
| `apps/web/src/lib/api.ts` | Add `modelConfig` to `deployOnboarding` params |
| `apps/api/src/onboarding/onboarding.service.ts` | Accept `modelConfig`, set `agents.defaults.model.primary`, store env var |
| `apps/api/src/reconciler/lifecycle-manager.service.ts` | Pass environment to `target.configure()` |
| `packages/cloud-providers/src/targets/docker/docker-target.ts` | Write `.env` file from `config.environment` |

---

## Problem 4: Remove Debug Logs

Remove all `console.log` debug statements added during previous sessions.

| File | Change |
|------|--------|
| `packages/gateway-client/src/client.ts` | Remove debug console.log statements |
| `packages/cloud-providers/src/targets/docker/docker-target.ts` | Remove debug console.log statements |
| `apps/api/src/reconciler/lifecycle-manager.service.ts` | Remove debug console.log statements |

---

## Implementation Order

1. **Problem 4** (Remove debug logs) — independent, quick
2. **Problem 1** (Fix loader) — small change in step-deploying.tsx
3. **Problem 2** (Gateway disconnect UX) — add guidance banners
4. **Problem 3** (LLM API key step) — largest change, new wizard step + backend

Problems 1, 2, and 4 are independent and can be implemented in parallel.
Problem 3 depends on Problem 4 (docker-target.ts is modified in both).

---

## Verification

1. Deploy a new bot with WhatsApp + Telegram channels
2. Verify the loader shows step-by-step progress (not jumping to success)
3. Verify success screen includes WhatsApp pairing guidance
4. Verify the Dashboard tab includes pairing instructions
5. Deploy with an LLM API key (e.g., Anthropic)
6. Verify `.env` file is written to config directory with correct env var
7. Verify `agents.defaults.model.primary` is set in `openclaw.json`
8. Open OpenClaw Dashboard, go to Channels, pair WhatsApp via QR
9. Send a message and verify the bot responds using the configured model
10. `pnpm build` passes
