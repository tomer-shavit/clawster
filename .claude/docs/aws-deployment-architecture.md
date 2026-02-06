---
description: "AWS ECS EC2 deployment architecture — speed, security, cost, reliability, and UX decisions"
globs: ["packages/cloud-providers/src/targets/ecs-ec2/**", "packages/adapters-aws/**"]
alwaysApply: false
---

# AWS ECS EC2 Deployment Architecture

Reference document for the ECS EC2 deployment target. Covers the current state, target architecture, security posture, deployment speed strategy, cost model, reliability controls, and UX design.

---

## 1. Current Architecture

### Stacks
- **Shared stack** (`clawster-shared-{region}`): VPC (10.0.0.0/16), 2 public + 2 private subnets, 9 VPC endpoints, IAM roles
- **Per-bot stack** (`clawster-bot-{profileName}`): ALB, ECS cluster, ASG (t3.small, DesiredCapacity=0), launch template, capacity provider, task def, ECS service (DesiredCount=0)

### Current Deploy Timeline
- **First bot (fresh region)**: 7-10 min total (install + start)
  - Shared infra CF: 3-5 min (8 interface VPC endpoints are the bottleneck)
  - Per-bot CF: 60-80s (ALB is slowest at 25-30s)
  - EC2 launch + user data (Sysbox install): 2-3 min
  - Container startup (`apt-get install + npm install -g openclaw`): 30-60s
  - Health check: 10s
- **Subsequent bot**: 3-5 min (per-bot CF + EC2 + container)

### Current Per-Bot Cost
~$34/mo: EC2 t3.small ($15) + ALB ($16) + EBS ($3)

### Key Files
- `packages/cloud-providers/src/targets/ecs-ec2/ecs-ec2-target.ts` — Main target (install/configure/start/stop/destroy)
- `packages/cloud-providers/src/targets/ecs-ec2/per-bot/per-bot-template.ts` — Per-bot CF template generator
- `packages/cloud-providers/src/targets/ecs-ec2/shared-infra/shared-infra-manager.ts` — Shared infra lifecycle
- `packages/cloud-providers/src/targets/ecs-ec2/shared-infra/templates/shared-vpc-endpoints-template.ts` — VPC endpoints
- `packages/cloud-providers/src/base/startup-script-builder.ts` — EC2 user data / Sysbox install
- `packages/adapters-aws/src/` — AWS SDK v3 adapter services

---

## 2. Target Architecture: Sub-3-Minute Deploys

### Core Change: NAT Gateway Replaces VPC Endpoints on Critical Path

**Problem**: 8 interface VPC endpoints take 3-5 min to create (AWS rate-limits per-VPC endpoint creation). This dominates first-deploy time.

**Solution**: Use a NAT Gateway (~60-90s to create) for initial connectivity from private subnets. Add VPC endpoints in the background after the bot is running. Traffic auto-migrates to endpoints when they exist (AWS routes through endpoints preferentially).

**Why not public subnets**: Two fatal problems:
1. **Security**: OpenClaw has 5 HIGH/CRITICAL CVEs in Jan-Feb 2026, 42K+ exposed instances found with 93.4% auth bypass. Official docs state "not hardened for public internet exposure." Private subnet isolation is non-negotiable.
2. **Technical**: ECS EC2 with `awsvpc` mode gives task ENIs no public IP — tasks in public subnets cannot reach the internet without VPC endpoints or NAT anyway.

Sources: [OpenClaw Security Advisories](https://github.com/openclaw/openclaw/security), [CrowdStrike Analysis](https://www.crowdstrike.com/en-us/blog/what-security-teams-need-to-know-about-openclaw-ai-super-agent/), [42K Exposed Instances](https://maordayanofficial.medium.com/the-sovereign-ai-security-crisis-42-000-exposed-openclaw-instances), [AWS SEC05-BP01](https://docs.aws.amazon.com/wellarchitected/2023-10-03/framework/sec_network_protection_create_layers.html)

### Network Diagram

```
                    Internet
                       |
              +--------v--------+
              |  Public Subnets  |
              |  +-----+ +-----+|
              |  | ALB | | NAT ||  <-- NAT creates in ~60-90s
              |  +--+--+ +--+--+|
              +-----+-------+---+
              +-----v-------v---+
              | Private Subnets  |
              | +---------------+|
              | | EC2 (Sysbox)  ||  <-- No public IP, no inbound from internet
              | |  +- OpenClaw  ||
              | +---------------+|
              +---------+-------+
                        |
           (background) v
              VPC Endpoints added
              after bot is running
```

### Parallel Deploy Strategy

Split shared infra creation into fast-blocking (VPC+subnets, ~15s via SDK) and slow-parallel (NAT Gateway, ~60-90s alongside per-bot stack):

```
0:00  User clicks "Deploy"
      |
      +-- SDK: VPC + subnets + IGW ---- 15s (blocking)
      |
      +-- Then in parallel:
      |   +-- SDK: NAT Gateway ------- 60-90s -+
      |   +-- SDK: IAM roles ---------- 5-10s  | all running
      |   +-- CF: Per-bot stack ------- 60-90s -+ simultaneously
      |       +-- ALB (30s)
      |       +-- EC2 launch (60-90s)
      |
      +-- ~90s: NAT ready, EC2 boots, ECS agent connects
      +-- Container starts: 15-20s
      +-- Health check: 10s
      |
      +-- BOT RUNNING -- ~2.5 min total
```

### Deploy Time Targets

| Scenario | Current | Target |
|----------|---------|--------|
| First bot, new region | 7-10 min | **~2.5 min** |
| Subsequent bot, same region | 3-5 min | **~2 min** |
| With warm pool | N/A | **~1 min** |

### Pre-requisites for Speed

1. **Custom AMI** with Sysbox pre-installed (eliminates 30-60s user data install)
2. **Pre-built Docker image** with OpenClaw pre-installed in ECR (eliminates 30-60s `apt-get + npm install` on every container start)
3. **SDK for shared infra** (not CF — enables parallel NAT + per-bot creation)
4. **DesiredCount=1** in per-bot CF stack (overlaps EC2 launch with ALB provisioning)

### OpenClaw Feature Compatibility

NAT Gateway provides full outbound internet access from private subnets. All OpenClaw features work identically to local:

| Feature | How it works | Status |
|---------|-------------|--------|
| WhatsApp (Baileys) | Outbound WebSocket to WhatsApp servers | Works via NAT |
| Telegram (polling) | Outbound HTTP long-poll | Works via NAT |
| Telegram (webhook) | Inbound POST to ALB, forwarded to bot | Works via ALB |
| Discord / Slack / Signal | Outbound WebSocket/HTTP | Works via NAT |
| LLM APIs (Anthropic, OpenAI) | Outbound HTTPS | Works via NAT |
| Web browsing (Chromium) | Outbound HTTP/HTTPS | Works via NAT |
| Docker sandbox (Sysbox) | Docker-in-Docker, `network: none` | Works via Sysbox on EC2 |
| npm / git (skills) | Outbound HTTPS | Works via NAT |

ALB is actually **better** than local for webhooks — stable public URL without ngrok.

---

## 3. Security

### OpenClaw Threat Landscape (Feb 2026)

OpenClaw has a large attack surface and is actively targeted:

- **5 HIGH/CRITICAL CVEs** in Jan-Feb 2026 (1-click RCE, command injection, unauthenticated local RCE, file inclusion)
- **42,665+ exposed instances** found in internet-wide scanning, 93.4% with authentication bypass
- Port 18789 exposes the **full control plane**: `config.apply` (rewrite config), `agent` (execute LLM tasks), `node.invoke` (arbitrary commands)
- Prompt injection is the primary threat — OpenClaw processes untrusted content (messages, web pages, emails) with shell access
- Official docs: "intended for local use only — not hardened for public internet exposure"

Sources: [CVE-2026-25253](https://socradar.io/blog/cve-2026-25253-rce-openclaw-auth-token/), [Cisco Analysis](https://blogs.cisco.com/ai/personal-ai-agents-like-openclaw-are-a-security-nightmare), [JFrog Analysis](https://jfrog.com/blog/giving-openclaw-the-keys-to-your-kingdom-read-this-first/)

### Day-0 Security Controls (in place before bot is "running")

| Control | Implementation |
|---------|---------------|
| Private subnet | EC2 + tasks in private subnets, no public IP |
| NAT (outbound only) | NAT Gateway in public subnet, no inbound route |
| ALB as sole entry point | SG: inbound only 80/443 from allowed CIDRs |
| Task SG | Inbound only from ALB SG on gateway port |
| IMDSv2 enforced | `HttpTokens: required`, `HttpPutResponseHopLimit: 1` |
| IMDS blocked from containers | `ECS_AWSVPC_BLOCK_IMDS=true` |
| No SSH | No key pair in launch template |
| Gateway auth token | Generated, stored in Secrets Manager |
| Least-privilege task role | Empty role (no AWS permissions) |
| Sysbox runtime | Pre-installed in custom AMI for secure DinD |

### Background Hardening (added after bot is running, non-blocking)

| Control | Impact if deferred |
|---------|-------------------|
| VPC endpoints | AWS API traffic goes through NAT (encrypted HTTPS, slightly higher latency) |
| Read-only root filesystem | Writable root for first few minutes |
| Drop Linux capabilities | Default Docker caps for first few minutes |
| Container Insights | No resource metrics until enabled |
| CloudWatch alarms | No automated alerting |
| EBS encryption | Depends on account-level default setting |

### Security Hardening Backlog

**S1. IMDSv2 + IMDS blocking [CRITICAL]** — Add `MetadataOptions` to launch template, `ECS_AWSVPC_BLOCK_IMDS=true` + `ECS_DISABLE_PRIVILEGED=true` to ECS config.

**S2. Read-only root filesystem [HIGH]** — `readonlyRootFilesystem: true` in task def. Mount writable `/tmp` and `/home/node/.openclaw`.

**S3. Non-root user [HIGH]** — `user: "1000:1000"` in container definition.

**S4. Drop Linux capabilities [HIGH]** — `capabilities: { drop: ["ALL"] }`, `initProcessEnabled: true`.

**S5. EBS encryption [MEDIUM]** — `Encrypted: true` in `BlockDeviceMappings`.

**S6. ECR image security [MEDIUM]** — Scan on push, immutable tags, lifecycle policies, image digests.

**S7. Container Insights [MEDIUM]** — Enable on ECS cluster (Security Hub ECS.12).

**S8. VPC endpoint policies [MEDIUM]** — Restrict ECR/S3 endpoint access to own account.

**S9. CloudWatch log encryption [LOW]** — KMS CMK on log groups.

**S10. GuardDuty Runtime Monitoring [RECOMMENDED]** — Detects container escapes, credential theft, cryptomining.

---

## 4. Cost

### Networking Tiers

Two networking tiers based on usage scale:

| Tier | NAT | ALB | Best for | Shared infra cost |
|------|-----|-----|----------|-------------------|
| **Starter** (default) | NAT Instance (t4g.nano, $3/mo) | Dedicated per bot | 1-4 bots, solo users | ~$3/mo |
| **Production** | NAT Gateway ($33/mo) | Shared across bots | 5+ bots, teams, uptime-critical | ~$33/mo |

Starter is the default for new regions. Production is offered as a **suggestion** (never automatic or mandatory) — see "Production Migration" below.

### Per-Bot Cost Model

| Config | Monthly | Notes |
|--------|---------|-------|
| Starter (t3.small + dedicated ALB) | ~$35 | Default for new users |
| Production (t3.small + shared ALB) | ~$18 | After migration |
| Graviton t4g.small + shared ALB | ~$15 | Phase 4 |
| Graviton + shared ALB + multi-bot instance | ~$5-8 | Phase 5 |

### Total Monthly Cost (what the user actually pays AWS)

| Bots | Starter tier | Production tier | Savings |
|------|-------------|----------------|---------|
| 1 | **$38/mo** | $68/mo | Starter cheaper |
| 3 | **$108/mo** | $87/mo | Production cheaper |
| 5 | $178/mo | **$123/mo** | -$55/mo |
| 10 | $353/mo | **$213/mo** | -$140/mo |

Starter is cheaper below ~3 bots. Production breaks even at ~3 bots and saves significantly after that.

### Production Migration (suggestion, not mandatory)

When a user deploys their 3rd+ bot in a region, the UI shows a non-blocking suggestion:

```
┌──────────────────────────────────────────────────┐
│  Upgrade to Production networking?               │
│                                                  │
│  You're running {n} bots in {region}.            │
│  Upgrading consolidates your load balancers      │
│  and improves reliability.                       │
│                                                  │
│  Current:  ${current}/mo                         │
│  After:    ${after}/mo                           │
│                                                  │
│  ✓ Saves ~${savings}/month                       │
│  ✓ AWS-managed NAT (no single point of failure)  │
│  ✓ ~30 seconds downtime during migration         │
│                                                  │
│  [ Migrate now ]          [ Maybe later ]        │
│                                                  │
│  Your bot will deploy either way.                │
└──────────────────────────────────────────────────┘
```

**Rules**:
- Suggestion appears in the main UI (not a modal/popup that blocks flow)
- User can dismiss it permanently ("Don't show again")
- Bot deploys regardless of whether user migrates
- Migration can be triggered later from settings at any time
- Never automatic, never mandatory

**What migration does** (~2 min total):
1. Create NAT Gateway in public subnet, update route (replaces NAT Instance) — ~90s
2. Create shared ALB with host-based listener rules per bot — ~30s
3. Re-register each bot's target group to shared ALB — ~10s each
4. Delete per-bot ALBs + old NAT Instance — background cleanup

### VPC Endpoints: Not Recommended

VPC endpoints cost $0.01/hr per AZ per endpoint. With 8 interface endpoints in 2 AZs: **~$117/mo**. This exceeds NAT data processing costs for any reasonable bot traffic. Skip entirely — NAT alone handles all connectivity. Only reconsider at 50+ bots with measurable data transfer costs.

### Cost Optimization Backlog

**C1. Graviton (t4g)** — 20% cheaper, requires multi-arch Docker image + ARM64 AMI.

**C2. Shared ALBs** — Part of Production tier migration. 1 ALB with listener rules per bot instead of 1 ALB per bot. Saves ~$14/mo/bot after first.

**C3. Multi-bot per instance** — Pack 3-8 bots per larger instance. Requires shared ECS cluster + port management.

**C5. Spot instances** — 60-70% savings for non-critical/dev bots. Mixed capacity provider strategy.

**C7. t4g.micro tier** — $6/mo for light bots (<50 messages/day). Add as `light` resource tier.

---

## 5. Reliability

**R1. Deployment circuit breaker [HIGH]** — `deploymentCircuitBreaker: { enable: true, rollback: true }`. Prevents bad deployments from hanging.

**R3. Managed instance draining [HIGH]** — `managedDraining: ENABLED`, `managedTerminationProtection: ENABLED`. Graceful task drain before instance termination.

**R4. CF stack recovery [MEDIUM]** — Use `ContinueUpdateRollback` with `ResourcesToSkip` for UPDATE_ROLLBACK_FAILED, avoiding full delete-recreate.

**R6. EC2 auto-recovery [MEDIUM]** — CloudWatch alarm on `StatusCheckFailed_System` with `ec2:recover` action.

**R7. CloudWatch alarms [MEDIUM]** — CPU >80%, Memory >80%, 5XX count >0, cluster reservation >80%.

**R5. Health checks [DONE]** — Already tuned: 5s interval, 3s timeout, 2 healthy / 3 unhealthy threshold.

---

## 6. Deploy UX

### Design Principles

1. **No hidden side effects** — Never create AWS resources before the user explicitly clicks "Deploy"
2. **Transparent progress** — Show every step with real-time status and time estimates
3. **No orphaned resources** — If deploy fails, clean up. If user cancels, nothing was created
4. **First bot = subsequent bot** — Same experience regardless of whether shared infra exists

### Progress UI

First bot in a new region:
```
Deploying "my-support-bot" to AWS (us-east-1)
First deployment in this region -- setting up networking (one-time)

[================----------] 60%

  Network created                              5s
  Security roles created                       8s
> NAT Gateway provisioning...                 45s remaining
> Load balancer provisioning...               20s remaining
> Server launching...                         55s remaining
  Starting OpenClaw
  Health check

Estimated: ~2 minutes remaining
```

Subsequent bot in the same region:
```
Deploying "my-devops-bot" to AWS (us-east-1)

[=========-----------------] 40%

  Network ready (shared)                       instant
> Load balancer provisioning...               20s remaining
> Server launching...                         55s remaining
  Starting OpenClaw
  Health check

Estimated: ~1.5 minutes remaining
```

### Full User Journey Timeline

```
0:00  git clone + pnpm install              ~2 min (one-time setup)
2:00  pnpm dev (start API + Web)            ~15s
2:15  Create account in web UI              ~30s
2:45  Bot creation wizard:
      - Pick AWS, enter credentials         ~30s
      - Bot name, model provider, API key   ~30s
      - Channels (optional)                 ~30s
      - Review, click Deploy                ~15s
4:30  Deploy (transparent progress):
      - VPC + subnets (SDK)                 ~15s
      - NAT + ALB + EC2 (parallel)          ~90s
      - Container + health check            ~30s
7:00  BOT IS RUNNING
```

**Total: ~7 min from git clone to running bot.**
**Perceived idle wait: ~2.5 min** (the rest is active interaction).

---

## 7. Implementation Changes Required

### Shared Infra Changes

1. **Replace VPC endpoints with NAT Gateway** in the shared infra template
   - Remove `shared-vpc-endpoints-template.ts` from critical path
   - Add NAT Gateway + EIP to shared VPC template
   - Create VPC endpoints as a separate background stack after bot is running

2. **Use SDK for shared infra creation** (not CloudFormation)
   - Create VPC + subnets + IGW via SDK (~15s, blocking)
   - Start NAT Gateway creation via SDK (async, ~60-90s)
   - Start IAM role creation via SDK (async, ~5-10s)
   - Return VPC/subnet IDs immediately for per-bot stack to use
   - Wait for NAT + IAM in parallel with per-bot stack

3. **Store shared infra state** — Since SDK-created resources aren't in a CF stack, persist resource IDs (VPC, subnets, NAT, IGW, IAM ARNs) in the database or a lightweight tracking mechanism

### Per-Bot Stack Changes

4. **Set DesiredCount=1** in `per-bot-template.ts` (currently 0)
   - EC2 launches during CF stack creation, overlapping with ALB provisioning
   - Remove separate `start()` call from reconciler for initial deploy

5. **Add security controls to launch template**:
   - `MetadataOptions`: IMDSv2 enforced, hop limit 1
   - No key pair

6. **Add security controls to task definition**:
   - `readonlyRootFilesystem: true` with writable `/tmp` + `/home/node/.openclaw`
   - `user: "1000:1000"`
   - `capabilities: { drop: ["ALL"] }`, `initProcessEnabled: true`

### Image & AMI Changes

7. **Custom AMI** (EC2 Image Builder):
   - Base: ECS-optimized Amazon Linux 2023
   - Pre-install: Sysbox runtime
   - User data shrinks to 4 lines (ECS cluster config only)

8. **Pre-built Docker image** (ECR):
   - Base: `node:22-slim`
   - Pre-install: `git`, `docker.io`, `openclaw@latest`
   - Container command: `exec openclaw gateway --port {port} --allow-unconfigured`
   - Push to ECR as part of shared infra (or public ECR)

### Background Hardening

9. **Background VPC endpoint creation** — After bot is running, create VPC endpoints as a separate async operation. Once endpoints exist, AWS automatically routes traffic through them instead of NAT.

10. **Background security hardening** — Apply Container Insights, CloudWatch alarms, EBS encryption, log encryption as a post-deploy hardening step.

---

## 8. Implementation Phases

### Phase 1: Security Hardening (no architecture change)
- S1: IMDSv2 + IMDS blocking in launch template
- S2: Read-only root filesystem
- S3: Non-root user
- S4: Drop Linux capabilities
- R1: Deployment circuit breaker

### Phase 2: Speed — NAT Gateway + Parallel Deploy
- Replace VPC endpoints with NAT Gateway on critical path
- SDK-based shared infra creation
- DesiredCount=1 in per-bot stack
- Background VPC endpoint creation
- Deploy progress UI

### Phase 3: Speed — Custom AMI + Pre-built Image
- EC2 Image Builder pipeline for Sysbox AMI
- ECR image with OpenClaw pre-installed
- Minimal user data (4 lines)

### Phase 4: Cost Optimization
- C1: Graviton (t4g) instances
- C2: Shared ALBs across bots
- C7: Light tier (t4g.micro)

### Phase 5: Advanced
- C3: Multi-bot per instance
- C5: Spot instances
- D1: ASG warm pools
- R3: Managed instance draining
- S10: GuardDuty Runtime Monitoring
