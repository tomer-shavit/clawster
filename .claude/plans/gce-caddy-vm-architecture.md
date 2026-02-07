# Plan: Rewrite GCP Architecture Doc — Comprehensive Caddy-on-VM Reference

## Context

The current GCP deployment architecture doc describes a shared External Application Load Balancer architecture (~$42/bot) with private subnets and Cloud NAT. A CLI spike test (2026-02-07) proved this wrong on multiple fronts:

1. Cloud Armor WAF cannot inspect WebSocket frames (OpenClaw's attack surface)
2. e2-small (2GB) OOMs during npm install — e2-medium (4GB) required
3. gcloud CLI NOT pre-installed on GCE Ubuntu
4. Sysbox v0.6.7 changed its .deb filename pattern
5. OpenClaw has no HTTP /health — SPA catch-all returns 200 for all paths

The doc must be **completely rewritten** as a Caddy-on-VM architecture (~$26/bot) following the Azure doc pattern but incorporating ALL spike-validated findings so there are zero bald spots.

## File

`/home/tomer_shavit/clawster-gce-caddy/.claude/docs/gce-deployment-architecture.md`

Copy from master, then rewrite. Target: ~600-700 lines.

## Doc Structure (14 sections, mirroring Azure doc)

### Section 1: Context (~15 lines)
- Problem: Current doc uses External LB (7 resources, $18+/mo, complex)
- Cost goal: ~$26/bot/mo
- Core one-liner: "Caddy reverse proxy on VM, MIG for auto-healing, ephemeral public IP, no LB/NAT"
- Spike-validated date: 2026-02-07

### Section 2: Research — Why MIG + Caddy? (~40 lines)
- **Eliminated Options table**: Cloud Run (no Docker), GKE Autopilot (no privileged), GKE Standard ($72/mo control plane), External LB ($18+/mo per bot), TCP/UDP NLB ($18+/mo L4 only), Cloud Armor (requires LB)
- **AWS/Azure → GCE Mapping table**: ALB→Caddy($0), NAT→not needed, ASG→MIG, UserData→startup-script, Secrets Manager→Secret Manager REST API, etc.

### Section 3: Architecture (~45 lines)
- **ASCII diagram**: Internet → Firewall → VM Public IP → Caddy → 127.0.0.1:18789 → OpenClaw (Sysbox)
- **Critical: Docker Port Binding** (H3): `-p 127.0.0.1:18789:18789`, `bind: "lan"`, Caddy reverse_proxy, firewall blocks 18789
- **Critical: Docker DNS on GCE** (H3): 169.254.169.254 breaks container DNS, fix with `{"dns":["8.8.8.8","8.8.4.4"]}`
- **Critical: Secret Manager Without gcloud** (H3): Metadata token + REST API via curl, include code snippet

### Section 4: Infrastructure (~40 lines)
- **Shared (per region, ~$0/mo)**: VPC, Subnet, Firewall (80/443 + SSH via IAP), Service Account, IAM binding — all free
- **Per-Bot (~$26/mo)**: MIG + Instance Template ($24.46 e2-medium), Boot disk 30GB ($2.04), Ephemeral IP (free), Secret ($0.12)

### Section 5: Cost Breakdown (~40 lines)
- **Tier table**: Only "Standard" tier (e2-medium 4GB) — no light tier, 2GB OOMs
- **Why e2-medium is mandatory**: Pre-build npm install needs 4GB, runtime uses ~1.5GB
- **Multi-bot scaling table**: 1/5/10 bots with GCE vs AWS vs Azure columns
- **Why cheapest**: No LB ($0 vs $24 AWS), no NAT ($0 vs $7 AWS), ephemeral IP free

### Section 6: Security Model (~55 lines)
- **Defense in Depth (8 layers)**: Firewall, localhost binding, TLS (Caddy), proxy (Caddy), auth (gateway token), container (Sysbox), access (no SSH), identity (SA)
- **Honest Comparison table**: What you lose vs External LB — WAF (Medium risk), DDoS (Low), separate boundary (Low), managed SSL (None), anycast (None)
- **Known Limitations**: Docker socket mount, root in container, ephemeral IP changes

### Section 7: Reliability Model (~40 lines)
- **MIG Auto-Healing**: Failure/recovery table (container crash→5s, app hang→3min, host failure→5min, OS corruption→3min)
- **MIG Config**: maxSize=1, minSize=0, health check HTTP /health via Caddy, grace period 600s
- **Data Persistence**: Phase 1 = Secret Manager (config survives, WhatsApp creds lost). Phase 2 = persistent disk
- **Health check explanation**: /health returns 200 via SPA catch-all, this is a LIVENESS check not true health

### Section 8: Startup Script (~100 lines)
- **Platform comparison table**: AL2023 vs Ubuntu 24.04 vs Ubuntu 22.04 across 7 dimensions
- **14 numbered steps** (proven spike order):
  1. apt install docker.io jq curl
  2. Docker DNS fix (8.8.8.8)
  3. systemctl enable --now docker
  4. Download Sysbox .deb (SHA256 verify) — **filename gotcha**: v0.6.7 = no `-0`
  5. dpkg -i + apt -f install
  6. Merge sysbox-runc into daemon.json (preserve DNS config)
  7. systemctl restart docker
  8. Install Caddy via Cloudsmith apt repo
  9. Write Caddyfile (`:80 { reverse_proxy 127.0.0.1:18789 }`)
  10. systemctl enable --now caddy
  11. Fetch config from Secret Manager (metadata token + REST API)
  12. Write config to `/opt/openclaw-data/.openclaw/openclaw.json`
  13. Pre-build image: `FROM node:22` (full, NOT slim) + `npm install -g openclaw@latest`
  14. docker run with sysbox-runc, localhost binding, config mount, GATEWAY_TOKEN env
- **Resilience bullets**: apt retry, build timeout+fallback, secret fetch retry with backoff, sysbox failure = degraded mode, config at /opt (not /tmp)

### Section 9: OpenClaw Config Transform (~25 lines)
- **Valid config JSON**: `{gateway:{mode,bind,port,auth,trustedProxies}}`
- **TypeScript transform code**: `getTransformOptions()` with customTransforms
- **Gotchas**: bind:lan=0.0.0.0, non-loopback requires token, --allow-unconfigured only bypasses mode check, invalid keys rejected by Zod, trustedProxies for Docker bridge

### Section 10: Deployment Flow (~40 lines)
- **First Bot (~3 min)**: Timeline from install() to health check passing
- **Subsequent Bot (~2.5 min)**: Shared infra exists, skip VPC/firewall
- **Bot Restart (~30s)**: Docker auto-restart + Caddy systemd
- **Auto-Repair (~3 min)**: MIG recreates instance, startup script re-runs, Secret Manager has config
- **Critical: IP change on replacement**: Ephemeral IP changes, Phase 2 = static regional IP

### Section 11: Implementation Steps (~80 lines)
8 steps with specific files and code patterns:
1. Rewrite startup-script-builder.ts — new GCE sections (DNS fix, Secret Manager REST, Caddy, pre-build)
2. Delete load balancer manager + interface (2 files)
3. Replace standalone VM with MIG + Instance Template in compute manager
4. Update GceTarget lifecycle (install/configure/start/stop/getEndpoint/destroy)
5. Update GceConfig (remove LB fields, change defaults to e2-medium/30GB/Ubuntu 22.04)
6. Update tier specs (standard only, no light tier)
7. Update provisioning steps metadata (11 steps, no LB)
8. Tests (unit + integration)

### Section 12: Files to Modify (~25 lines)
Single table: 13 files with change description. 2 files deleted (LB manager + interface).

### Section 13: Verification (~20 lines)
8-step checklist: build, tests, deploy test bot, auto-restart, MIG auto-repair, firewall security, DNS fix

### Section 14: Future Improvements (~20 lines)
Custom VM image, persistent disk, static IP, GKE at 10+ bots, Spot VMs, reserved commitments

## Key Spike Findings to Embed (zero bald spots)

Each finding gets embedded in the relevant section, NOT in a separate "gotchas" section:

| Finding | Where in doc |
|---------|-------------|
| e2-medium mandatory (2GB OOMs) | Sections 4, 5, 8 (step 13) |
| Docker DNS 8.8.8.8 | Sections 3 (Critical callout), 8 (step 2) |
| Sysbox filename no `-0` | Sections 8 (step 4), 11 (step 1) |
| gcloud not installed | Sections 3 (Critical callout), 8 (step 11) |
| node:22 full not slim | Sections 8 (step 13), 9 (gotchas) |
| No HTTP /health | Sections 7 (health check explanation), 8 (step 14) |
| trustedProxies needed | Sections 9 (config + gotchas), 8 (step 12) |
| Config at /opt not /tmp | Sections 8 (step 12, resilience), 3 (architecture) |
| Pre-build mandatory | Sections 5 (why e2-medium), 8 (step 13) |
| SPA catch-all returns 200 | Sections 7 (health check), 13 (verification) |
| --allow-unconfigured | Section 9 (gotchas) |
| bind:lan = 0.0.0.0 | Section 9 (gotchas) |
| Non-loopback requires token | Section 9 (gotchas) |
| Metadata accessible from host | Section 3 (Secret Manager callout) |
| ~20s startup with pre-build | Section 10 (deployment flow) |

## Reusable Azure Caddy Patterns

Reference these from `clawster-azure-caddy` branch (don't copy code, just describe the pattern):
- `buildSysboxDebSection()` — cloud-agnostic .deb install
- `buildCaddySection()` — cloud-agnostic Caddy install + Caddyfile
- `buildOpenClawContainerSection()` — cloud-agnostic Docker run with localhost binding
- Integration test pattern: guard → install → configure → start → status → endpoint → stop → destroy

## Verification

After writing:
1. Read the full doc end-to-end
2. Cross-check every spike finding from memory/gce-spike-results.md is present
3. Verify the Azure doc structure is followed (14 sections)
4. Ensure no references to External LB, Cloud NAT, Cloud Router, private subnet remain
5. Ensure cost figures are consistent ($26/bot throughout)
