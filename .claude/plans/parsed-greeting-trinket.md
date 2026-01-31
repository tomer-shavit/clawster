# Molthub OOTB: Everything Works From One Command

## Goal
`bash scripts/setup.sh` on any machine (Linux/macOS/WSL2) with Docker + Node → full working Molthub: wizard, deployments, monitoring, the complete flow.

## Key Discovery
**OpenClaw Gateway is a real, existing npm package** (`npm install -g openclaw@latest`, 126k GitHub stars). It has:
- A CLI: `openclaw gateway --port 18789`
- A Docker image: `ghcr.io/openclaw/openclaw:latest`
- Molthub's deployment targets already know how to use both

**No mock needed.** The setup script just needs to ensure OpenClaw is available and the error handling needs to surface failures.

## What Currently Breaks
1. **Docker not running** → Can't start PostgreSQL or OpenClaw containers
2. **Reconciliation errors are silent** → Frontend shows "deploying..." forever when anything fails
3. **No OpenClaw in dev stack** → Docker target pulls image at deploy time; if Docker isn't available, deploy fails silently
4. **Setup script doesn't install OpenClaw** → Users don't know they need it

## Solution: 3 Phases

| Phase | What | Why |
|-------|------|-----|
| **1. Setup Script** | Install OpenClaw, add to docker-compose, auto-detect targets | One command OOTB |
| **2. Error Handling** | Surface reconciler errors, staleness detection, frontend fixes | No more infinite spinner |
| **3. Default Dev Target** | Default to Docker target for dev, auto-configure | Wizard just works |

---

## Phase 1: Setup Script + Docker Compose (the foundation)

### 1a. Add OpenClaw Gateway to docker-compose.yml

**File**: `docker-compose.yml`

Add a `gateway` service so the dev stack includes a running OpenClaw Gateway:

```yaml
gateway:
  image: ghcr.io/openclaw/openclaw:latest
  ports:
    - "18789:18789"
  environment:
    - OPENCLAW_CONFIG_PATH=/app/config/config.json
  volumes:
    - gateway-config:/app/config
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "node", "-e", "const ws=require('ws');const c=new ws('ws://localhost:18789');c.on('open',()=>{process.exit(0)});setTimeout(()=>process.exit(1),3000)"]
    interval: 10s
    timeout: 5s
    retries: 3
```

Add `gateway-config` to the volumes section.

### 1b. Update setup.sh to start the gateway

**File**: `scripts/setup.sh`

In `start_postgres()` (rename to `start_docker_services()` or add a new function):
- Run `docker compose up -d postgres gateway` (add gateway alongside postgres)
- Wait for gateway to be healthy (TCP check on port 18789, similar to pg_isready loop)

In `check_prerequisites()`:
- Docker is already checked (required for postgres)
- No additional prereqs needed — gateway runs in Docker

In `cmd_doctor()`, add a new check:
- Check if port 18789 is in use
- Try a WebSocket connect to verify the gateway is responding
- Show gateway status (healthy/unreachable)

In `setup_env_files()`:
- Set `DEFAULT_DEPLOYMENT_TARGET=docker` in `apps/api/.env`

### 1c. Install OpenClaw CLI (optional, for local target)

In `check_prerequisites()` or after `install_deps()`:
- Check if `openclaw` is in PATH
- If not, and Docker is available: skip (Docker target doesn't need the CLI)
- If not, and Docker is NOT available: suggest `npm install -g openclaw@latest`

---

## Phase 2: Error Handling (independent of Phase 1)

### 2a. Surface reconciliation errors in deploy status

**File**: `apps/api/src/onboarding/onboarding.service.ts`

In `getDeployStatus()`:
- If `instance.status === "ERROR"`, include `instance.lastError` in the response `error` field
- Add staleness detection: if status is `CREATING` or `RECONCILING` for >3 minutes, return:
  ```json
  { "status": "ERROR", "error": "Deployment timed out. Check API logs." }
  ```

### 2b. Frontend error display

**File**: `apps/web/src/components/deploy-wizard/` (the deploying step component)

- Add a polling fallback: `useEffect` that polls `GET /onboarding/deploy/{id}/status` every 5 seconds
- If polled status shows `ERROR` or `error` field is non-empty → display the error message
- If status is `CREATING` for >2 minutes → show warning: "Taking longer than expected..."
- Show a "Retry" button when error is displayed

### 2c. Reconciler error capture

**File**: `apps/api/src/reconciler/reconciler.service.ts`

Verify that the `.catch()` on `reconcile()` writes `lastError` to the DB. If it only logs, add:
```typescript
await this.prisma.botInstance.update({
  where: { id: instanceId },
  data: { status: 'ERROR', lastError: error.message }
});
```

---

## Phase 3: Default Dev Deployment Target

### 3a. Add DEFAULT_DEPLOYMENT_TARGET config

**File**: `apps/api/src/config/validation.ts`

Add to Joi schema:
```typescript
DEFAULT_DEPLOYMENT_TARGET: Joi.string()
  .valid('docker', 'local', 'kubernetes', 'ecs-fargate')
  .default('docker')
```

### 3b. Use default target in OnboardingService

**File**: `apps/api/src/onboarding/onboarding.service.ts`

In `deploy()`, when determining deployment type:
- If the deploy DTO doesn't specify a target type, use `process.env.DEFAULT_DEPLOYMENT_TARGET || 'docker'`
- For Docker target, auto-configure:
  - `imageName`: `ghcr.io/openclaw/openclaw:latest`
  - `gatewayPort`: auto-assign starting from 18789 (check for conflicts)
  - `configPath`: `/tmp/molthub/gateways/{instanceId}/`

### 3c. Auto-configure gateway port assignment

**File**: `apps/api/src/onboarding/onboarding.service.ts` (or a new helper)

Add a simple port allocator:
- Query existing BotInstances for their `gatewayPort` values
- Assign next available port starting from 18789, incrementing by 20 (OpenClaw reserves port ranges)
- Store the assigned port in the BotInstance record

---

## Files Summary

### Modified
| File | Change |
|------|--------|
| `docker-compose.yml` | Add `gateway` service with OpenClaw image |
| `scripts/setup.sh` | Start gateway in Docker, add gateway doctor check, install openclaw CLI hint |
| `apps/api/src/onboarding/onboarding.service.ts` | Default deployment target, error surfacing, staleness detection, port allocation |
| `apps/api/src/config/validation.ts` | Add `DEFAULT_DEPLOYMENT_TARGET` env var |
| `apps/api/.env.example` | Add `DEFAULT_DEPLOYMENT_TARGET=docker` |
| `apps/web/src/components/deploy-wizard/` (deploying step) | Polling fallback, error display, retry button |
| `apps/api/src/reconciler/reconciler.service.ts` | Verify error capture writes to DB |

### No New Packages Needed
The real OpenClaw Gateway handles everything — no mock, no simulated target, no new packages.

---

## Implementation Order

```
Phase 1 (Setup + Docker)  ──→  Phase 3 (Default Target)
Phase 2 (Error Handling)  ──→  (independent, can run in parallel with Phase 1)
```

---

## Verification

1. `docker compose up -d` → postgres + gateway both start and pass health checks
2. `bash scripts/setup.sh` on fresh clone → completes without errors
3. `bash scripts/setup.sh doctor` → all checks green including gateway
4. Open wizard → select template → deploy → status progresses to RUNNING
5. `bash scripts/setup.sh deploy` → CLI deploy completes with RUNNING status
6. Kill gateway mid-deploy → frontend shows error message (not infinite spinner)
7. `pnpm build` → monorepo builds
8. `pnpm test` → existing tests pass
