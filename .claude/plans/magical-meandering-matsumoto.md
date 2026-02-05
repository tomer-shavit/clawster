# Persona Templates Implementation Plan - Parallel Iterative Approach

## Overview

Implement PersonaTemplates with **validation checkpoints** at each phase. Each phase has parallel workstreams where possible, with a clear "Definition of Done" before proceeding.

**Goal**: "Magic" experience - user picks a template, gets a fully configured specialized bot.

---

## Phase 0: Research (MANDATORY - Before Any Code)

### Tasks
1. **Verify OpenClaw Cron RPC Schemas**
   - Fetch exact schema from `https://github.com/openclaw/openclaw/blob/main/src/gateway/protocol/schema/cron.ts`
   - Document exact request/response types for `cron.add`, `cron.list`, `cron.remove`
   - Per CLAUDE.md: "Do not guess protocol shapes"

2. **Verify Config-Only Injection for SOUL.md/AGENTS.md**
   - Check if OpenClaw supports `agents.defaults.systemPrompt` for inline SOUL content
   - Check if `agents.defaults.operationalGuidelines` exists for AGENTS.md
   - If yes: Pure config injection (ideal)
   - If no: Document file write strategy per deployment target

3. **Document Findings**
   - Update `openclaw-templates-implementation.md` with verified schemas
   - Flag any blockers before proceeding

### Phase 0 Validation
- [x] Cron RPC schema documented with exact types
- [x] Config-only injection feasibility confirmed (PARTIAL - see below)
- [x] No blockers identified (mitigations planned)

### Phase 0 Research Results

**Cron RPC Schemas (VERIFIED):**
- `cron.add`: `{name, schedule: {kind: "at"|"every"|"cron", ...}, payload: {kind: "systemEvent"|"agentTurn", ...}, sessionTarget?, enabled?, ...}` → returns full CronJob
- `cron.list`: `{includeDisabled?: boolean}` → `{jobs: CronJob[]}`
- `cron.remove`: `{id: string}` or `{jobId: string}`

**Config Injection (PARTIAL):**
- **Identity: YES** - `agents.list[].identity` supports name, emoji, theme, avatar via `config.apply`
- **Personality/SOUL: NO** - OpenClaw has no inline systemPrompt config. SOUL.md files required.

**Mitigation for SOUL injection:**
- Use container exec (Docker exec, ECS Exec) to write SOUL.md files
- This is deployment-target specific but acceptable for MVP

---

## Phase 1.0: Type Definitions (Quick - 30 min)

**Why separate**: Phases 1B and 1C both depend on these types.

### Files to create/modify:
- `packages/core/src/persona-template.ts` (NEW)
- `packages/core/src/index.ts` (export)

### Tasks:
- Define `PersonaTemplateSchema` with Zod
- Define `CronJobTemplateSchema`, `IdentityConfigSchema`, `SecretRefSchema`
- Export all types

### Phase 1.0 Validation
```bash
pnpm --filter @clawster/core build
# Quick test: import { PersonaTemplateSchema } from '@clawster/core'
```

---

## Phase 1.1: Foundation (Parallel - 2 Workstreams after 1.0)

### Workstream 1A: GatewayClient Cron Methods
**Files to create/modify:**
- `packages/gateway-client/src/protocol.ts` (add cron types)
- `packages/gateway-client/src/interfaces/gateway-client.interface.ts` (add cron methods)
- `packages/gateway-client/src/client.ts` (implement cron methods)
- `packages/gateway-client/src/__tests__/client.test.ts` (add cron tests)

**Tasks:**
- Add `CronAddRequest`, `CronAddResult`, `CronListResult`, `CronRemoveResult` types
- Add `cronAdd()`, `cronList()`, `cronRemove()` to IGatewayClient
- Implement in GatewayClient using `request<T>()` pattern
- Write unit tests with mock WebSocket server

### Workstream 1B: Database Model
**Files to create/modify:**
- `packages/database/prisma/schema.prisma` (add PersonaTemplate model)
- `packages/database/src/interfaces/persona-template.repository.ts` (NEW)
- `packages/database/src/repositories/persona-template.repository.ts` (NEW)
- `packages/database/src/nestjs/tokens.ts` (add token)
- `packages/database/src/nestjs/database.module.ts` (register)

**Tasks:**
- Add `PersonaTemplate` model (id, name, version, identity, soul, skills, cronJobs, configPatches, requiredSecrets, etc.)
- Add `TemplateInjectionSnapshot` model for rollback
- Add `personaTemplateId`, `personaTemplateVersion`, `templateInjectedAt` to BotInstance
- Create repository interface and implementation following existing patterns

### Phase 1.1 Validation Checkpoint
```bash
# 1. Build passes
pnpm build

# 2. GatewayClient cron tests pass (against mock WebSocket)
pnpm --filter @clawster/gateway-client test

# 3. Database migration runs and is reversible
pnpm --filter @clawster/database prisma:migrate
pnpm --filter @clawster/database prisma:migrate:reset  # Verify rollback works

# 4. Verify cron RPC types match Phase 0 research
# Manual: Compare types in protocol.ts with documented OpenClaw schema
```

---

## Phase 2: Injection Services (Parallel - 3 Workstreams)

**Depends on:** Phase 1 complete

### Workstream 2A: ConfigInjectorService
**Files to create/modify:**
- `apps/api/src/templates/persona/interfaces.ts` (NEW - IConfigInjector)
- `apps/api/src/templates/persona/config-injector.service.ts` (NEW)

**Tasks:**
- Implement `IConfigInjector` interface (getConfig, applyPatch)
- Use existing GatewayClient's `configGet()` and `configApply()`
- Add secret reference resolution (walk config tree, replace `${secret:key}`)
- Support identity injection via `agents.defaults.identity`

**Reuse:**
- `GatewayConnectionService` (apps/api/src/gateway/gateway-connection.service.ts)
- `deepMerge` from existing `config-generator.ts`

### Workstream 2B: CronInjectorService
**Files to create/modify:**
- `apps/api/src/templates/persona/interfaces.ts` (add ICronInjector)
- `apps/api/src/templates/persona/cron-injector.service.ts` (NEW)

**Tasks:**
- Implement `ICronInjector` interface (addJob, removeJob, listJobs)
- Use GatewayClient's new `cronAdd()`, `cronList()`, `cronRemove()`
- Map `CronJobTemplate` to Gateway RPC params

### Workstream 2C: Secret Resolution Integration
**Files to create/modify:**
- `apps/api/src/templates/persona/secret-resolver.factory.ts` (NEW)
- Extend existing adapters if needed

**Tasks:**
- Create `ISecretResolver` interface
- Create `SecretResolverFactory` that returns resolver based on deploymentTarget
- Integrate with existing vault adapters (AWS Secrets Manager, etc.)
- For MVP: Focus on LocalSecretResolver (env vars) and AwsSecretResolver

### Phase 2 Validation Checkpoint
```bash
# 1. Build passes
pnpm build

# 2. Integration test: Config injection to running Docker bot
# - Start a local OpenClaw bot (or use existing test instance)
# - Call ConfigInjector.applyPatch() with identity
# - Verify via agent probe that identity changed
# - Verify existing bot functionality not broken

# 3. Integration test: Cron injection to running Docker bot
# - Call CronInjector.addJob() with a test job
# - Call CronInjector.listJobs() and verify it exists
# - Call CronInjector.removeJob() and verify cleanup

# 4. Integration test: Secret resolution
# - Verify LocalSecretResolver returns ${ENV_VAR} format
# - Verify AwsSecretResolver returns ${aws:secretsmanager:...} format
```

---

## Phase 3: Orchestrator (Sequential)

**Depends on:** Phase 2 complete

### Workstream 3: TemplateOrchestratorService
**Files to create/modify:**
- `apps/api/src/templates/persona/interfaces.ts` (add ITemplateOrchestrator)
- `apps/api/src/templates/persona/template-orchestrator.service.ts` (NEW)
- `apps/api/src/templates/persona/persona-template.repository.ts` (in-memory builtins + DB)

**Tasks:**
- Implement `inject(instanceId, templateId, options)` method:
  1. Resolve template (builtin or DB)
  2. Validate required secrets provided
  3. **Validate required skills available** (new: check bundled skills)
  4. Create snapshot for rollback
  5. Store secrets in vault
  6. Apply config patches (identity, soul, skills) via ConfigInjector
  7. Create cron jobs via CronInjector
  8. **Post-injection verification** (new: verify identity, health check)
  9. Update BotInstance record
- Implement `rollback(instanceId, snapshotId)` method
- Implement `getInjectionStatus(instanceId)` method
- Emit events for progress tracking via EventEmitter2

**Snapshot Structure (for rollback):**
```typescript
interface SnapshotData {
  configHash: string;         // Hash before injection
  configRaw: string;          // Full config JSON before injection
  cronJobIds: string[];       // Job IDs created (for removal on rollback)
  injectedAt: Date;
}
```

**Post-Injection Verification:**
```typescript
async verifyInjection(instanceId: string, template: PersonaTemplate): Promise<void> {
  // 1. Verify identity changed via agent.identity.get
  // 2. Verify cron jobs exist via cron.list
  // 3. Health check via gateway health RPC
}
```

**Builtin Templates to create:**
- `builtin/marketer` - Marketing assistant with social media skills
- `builtin/devops` - DevOps bot with CI/CD skills
- `builtin/support` - Customer support with helpdesk skills

### Phase 3 Validation Checkpoint
```bash
# 1. Build passes
pnpm build

# 2. End-to-end test: Full injection flow
# - Have a RUNNING Docker bot instance
# - Call orchestrator.inject(instanceId, 'builtin/marketer', { secrets: {...} })
# - Verify:
#   - Identity changed (probe via agent RPC)
#   - Cron jobs created (list via Gateway)
#   - BotInstance updated with templateId

# 3. Rollback test
# - Call orchestrator.rollback(instanceId, snapshotId)
# - Verify original state restored
```

---

## Phase 4: API & Integration (Parallel - 2 Workstreams)

**Depends on:** Phase 3 complete

### Workstream 4A: API Endpoints
**Files to create/modify:**
- `apps/api/src/templates/persona/persona-templates.controller.ts` (NEW)
- `apps/api/src/templates/persona/persona-templates.dto.ts` (NEW)
- `apps/api/src/templates/persona/persona-templates.module.ts` (NEW)
- `apps/api/src/app.module.ts` (register module)

**Endpoints (MVP - lean core):**
- `GET /persona-templates` - List all templates (builtin + custom)
- `GET /persona-templates/:id` - Get single template
- `POST /persona-templates` - Create custom template
- `POST /persona-templates/:templateId/inject/:instanceId` - Inject template
- `POST /persona-templates/instances/:instanceId/rollback/:snapshotId` - Rollback
- `GET /persona-templates/instances/:instanceId/status` - Injection status

### Workstream 4B: Integration Tests
**Files to create/modify:**
- `apps/api/src/templates/persona/__tests__/persona-templates.e2e.spec.ts` (NEW)

**Tests:**
- List templates returns builtins
- Create custom template persists to DB
- Inject template modifies running bot
- Rollback restores original state
- Injection status reflects current state

### Phase 4 Validation Checkpoint
```bash
# 1. Build passes
pnpm build

# 2. API tests pass
pnpm --filter api test:e2e --grep "persona-templates"

# 3. Manual validation via curl
curl http://localhost:4000/persona-templates
curl -X POST http://localhost:4000/persona-templates/builtin%2Fmarketer/inject/INSTANCE_ID \
  -H "Content-Type: application/json" \
  -d '{"secrets": {"bufferApiKey": "test-key"}}'
```

---

## Phase 5: Web UI (Parallel - 3 Workstreams)

**Depends on:** Phase 4 complete

### Workstream 5A: Sidebar Templates Section
**Files to create/modify:**
- `apps/web/src/components/sidebar/templates-section.tsx` (NEW)
- `apps/web/src/components/templates/template-list.tsx` (NEW)
- `apps/web/src/components/templates/create-template-dialog.tsx` (NEW)
- `apps/web/src/hooks/use-persona-templates.ts` (NEW)

**Tasks:**
- Add "Templates" section to sidebar navigation
- List all templates (builtin + custom) with icons
- "Create Template" button opens dialog
- Create template form: name, description, identity, soul, skills, cron jobs, required secrets

### Workstream 5B: Template Gallery (for wizard)
**Files to create/modify:**
- `apps/web/src/components/templates/persona-template-gallery.tsx` (NEW)
- `apps/web/src/components/templates/persona-template-card.tsx` (NEW)

**Tasks:**
- Create gallery component showing all persona templates
- Cards show: name, description, tags, required secrets
- Click to select for bot creation

### Workstream 5C: Wizard Integration
**Files to create/modify:**
- `apps/web/src/components/deploy-wizard/steps/template-step.tsx` (modify or create)
- `apps/web/src/components/deploy-wizard/steps/secrets-step.tsx` (modify)
- `apps/web/src/stores/deploy-wizard.store.ts` (add personaTemplateId)

**Tasks:**
- Add "Select Persona" step to wizard (after deployment target)
- Show persona template gallery
- Collect required secrets for selected template
- Pass templateId to bot creation flow

### Phase 5 Validation Checkpoint
```bash
# 1. Build passes
pnpm build

# 2. Manual E2E test
# - Open wizard in browser
# - Select deployment target (Docker)
# - Select persona template (Marketer)
# - Provide secrets
# - Deploy
# - Verify bot runs with marketer personality
```

---

## Implementation Order Summary

```
Phase 0 (Research) - MANDATORY
└── Verify OpenClaw cron RPC + config-only injection ── CHECKPOINT 0

Phase 1.0 (Types) - Quick
└── Core type definitions                            ── (no checkpoint, immediate)

Phase 1.1 (Foundation) - Parallel
├── 1A: GatewayClient Cron  ──┐
└── 1B: Database Model      ──┴── CHECKPOINT 1

Phase 2 (Injection) - Parallel
├── 2A: ConfigInjector      ──┐
├── 2B: CronInjector        ──┼── CHECKPOINT 2
└── 2C: Secret Resolution   ──┘

Phase 3 (Orchestrator) - Sequential
└── Orchestrator + Verification ── CHECKPOINT 3

Phase 4 (API) - Sequential (tests follow endpoints)
├── 4A: API Endpoints + SSE  ──┐
└── 4B: Integration Tests    ──┴── CHECKPOINT 4

Phase 5 (UI) - Parallel
├── 5A: Sidebar Templates   ──┐
├── 5B: Template Gallery    ──┼── CHECKPOINT 5 (DONE!)
└── 5C: Wizard Integration  ──┘
```

---

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Cron RPC schema mismatch** | HIGH | Phase 0 research - verify exact schema before coding |
| **SOUL.md requires file write** | MEDIUM | Phase 0 research - if no config alternative, document per-deployment strategy |
| **ECS Exec not enabled** | HIGH | For file writes on ECS, require IAM setup in docs |
| **Rollback leaves orphan cron jobs** | MEDIUM | Store job IDs in snapshot, verify cleanup |
| **Concurrent injection race** | MEDIUM | Add mutex per instance in orchestrator |
| **Gateway unreachable during injection** | MEDIUM | Timeout + automatic rollback on failure |

---

## Design Decisions (No Backwards Compatibility)

Since backwards compatibility is NOT required:
- PersonaTemplate is a **new, clean schema** - no migration from existing templates
- BotInstance gets **new fields** (personaTemplateId, etc.) - no migration needed
- API endpoints are **new routes** under `/persona-templates`
- No need to support v1 manifest format in PersonaTemplates

---

## Critical Files Reference

### Existing Files to Reuse
| File | What to Reuse |
|------|---------------|
| `packages/gateway-client/src/client.ts` | `request<T>()` pattern for RPC |
| `apps/api/src/templates/config-generator.ts` | `deepMerge()`, `setNestedValue()` |
| `apps/api/src/gateway/gateway-connection.service.ts` | `getGatewayClient(instance)` |
| `packages/database/src/repositories/*.ts` | Repository pattern |
| `apps/api/src/templates/builtin-templates.ts` | Template definition pattern |

### New Files to Create
| Phase | File |
|-------|------|
| 1.0 | `packages/core/src/persona-template.ts` |
| 1.1A | `packages/gateway-client/src/protocol.ts` (extend) |
| 1.1B | `packages/database/prisma/schema.prisma` (extend) |
| 1.1B | `packages/database/src/interfaces/persona-template.repository.ts` |
| 2A | `apps/api/src/templates/persona/config-injector.service.ts` |
| 2B | `apps/api/src/templates/persona/cron-injector.service.ts` |
| 2C | `apps/api/src/templates/persona/secret-resolver.factory.ts` |
| 3 | `apps/api/src/templates/persona/template-orchestrator.service.ts` |
| 4A | `apps/api/src/templates/persona/persona-templates.controller.ts` |
| 5A | `apps/web/src/components/sidebar/templates-section.tsx` |
| 5A | `apps/web/src/components/templates/create-template-dialog.tsx` |
| 5B | `apps/web/src/components/templates/persona-template-gallery.tsx` |

---

## Verification Commands

```bash
# After each phase, run:
pnpm build                              # Ensure everything compiles
pnpm test                               # Run unit tests
pnpm --filter api test:e2e              # Run API integration tests

# For manual validation with a running bot:
docker ps | grep openclaw               # Find running bot
curl http://localhost:4000/bots         # Get bot instances
# Then use the API endpoints to test injection
```
