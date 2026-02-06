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
  - Per-bot CF: 60-90s (ALB is slowest at 30-60s)
  - EC2 launch + user data (Sysbox install from GitHub): **BROKEN** — `scr/install.sh` returns 404. Must be replaced with .deb binary extraction (see Section 2).
  - Container startup (`apt-get install + npm install -g openclaw`): 30-60s
  - Health check: 10s
- **Subsequent bot**: 3-5 min (per-bot CF + EC2 + container)

### Current Cost
- Per-bot: ~$42/mo (EC2 t3.small $15 + ALB $17 + ALB IPv4 $7.30 + EBS $2.40)
- Shared VPC endpoints: ~$117/mo (8 interface endpoints × 2 AZs × $0.01/hr × 730 hrs)
- **Total for 1 bot: ~$159/mo** (most of it is VPC endpoints)

### Key Files
- `ecs-ec2-target.ts` — Main target (install/configure/start/stop/destroy)
- `per-bot/per-bot-template.ts` — Per-bot CF template generator, uses `Fn::ImportValue` for shared refs
- `shared-infra/shared-infra-manager.ts` — Shared infra lifecycle
- `shared-infra/shared-infra-config.ts` — `SharedExportNames` for cross-stack references
- `shared-infra/templates/shared-production.ts` — Shared CF template composer
- `shared-infra/templates/shared-vpc-endpoints-template.ts` — VPC endpoints (to be removed)
- `../../base/startup-script-builder.ts` — EC2 user data / Sysbox install

---

## 2. Target Architecture

### Core Change: NAT Instance Replaces VPC Endpoints

**Problem**: 8 interface VPC endpoints take 3-5 min to create AND cost ~$117/mo. They dominate both first-deploy time and infrastructure cost.

**Solution**: NAT Instance (t4g.nano, ~$7/mo including EIP IPv4 charge) in a public subnet provides outbound internet for private subnets. All AWS API traffic (ECR image pull, CloudWatch logs, Secrets Manager) routes through NAT — standard HTTPS traffic, encrypted end-to-end.

**Why NAT Instance, not NAT Gateway**: NAT Gateway costs $33/mo + $3.65/mo IPv4 + $0.045/GB data processing = ~$37/mo before data. NAT Instance costs ~$7/mo (t4g.nano $3 + EIP IPv4 $3.65). For 1-10 bots, a t4g.nano handles all traffic comfortably (5 Gbps burst, 32 Mbps sustained baseline — see Section 4 for sizing details).

**Why not public subnets**: Two fatal problems:
1. **Security**: OpenClaw has 5 HIGH/CRITICAL CVEs (Jan-Feb 2026), 42K+ exposed instances with 93.4% auth bypass. Port 18789 exposes the full control plane. Private subnet isolation is non-negotiable.
2. **Technical**: ECS EC2 with `awsvpc` mode gives task ENIs no public IP — tasks in public subnets still can't reach the internet without NAT.

Sources: [OpenClaw Security Advisories](https://github.com/openclaw/openclaw/security), [42K Exposed Instances](https://maordayanofficial.medium.com/the-sovereign-ai-security-crisis-42-000-exposed-openclaw-instances)

### Network Diagram

```
                    Internet
                       |
              +--------v--------+
              |  Public Subnets  |
              |  +-----+  +----+|
              |  | ALB |  |NAT ||  ← t4g.nano, ~$7/mo (incl EIP IPv4), iptables masquerade
              |  +--+--+  +--+-+|
              +-----+------+-+--+
              +-----v------v----+
              | Private Subnets  |
              | +---------------+|
              | | EC2 (ECS)     ||  ← No public IP, no inbound from internet
              | |  +- OpenClaw  ||
              | +---------------+|
              +-----------------+
```

### Infrastructure Approach: CloudFormation for Both Stacks

Shared infra and per-bot resources are BOTH managed via CloudFormation:

- **Shared stack**: VPC, subnets, NAT Instance, IAM roles. Created once per region. Exports values via `Fn::Export`.
- **Per-bot stack**: Consumes shared exports via `Fn::ImportValue`. Contains ALB, ECS cluster, ASG, task def, service.

**Why CF (not SDK) for shared infra**: `Fn::ImportValue` in per-bot stacks can ONLY reference values exported by another CF stack's `Outputs` section. SDK-created resources produce no CF exports — `Fn::ImportValue` would fail with "No export named X found." Keeping shared infra in CF preserves the cross-stack reference pattern and gives lifecycle management, rollback, and drift detection for free.

**Why DesiredCount=0 in per-bot CF stack**: Setting DesiredCount=1 during stack creation would cause ECS to schedule tasks immediately. If the NAT Instance route isn't active yet (possible during first deploy when shared stack just completed), the ECS agent on the new EC2 instance can't register with the cluster, and image pulls fail with `CannotPullContainerError`. The circuit breaker triggers after 3 failures and stalls the deployment with no rollback target (first deployment = no previous good state). Keeping DesiredCount=0 in CF and activating via `UpdateService(DesiredCount=1)` after verifying NAT readiness eliminates this race condition entirely. **This is the current code behavior and it is correct.**

### Deploy Flow (First Bot in Region)

```
0:00  User clicks "Deploy"
      │
      ├── CF: Create shared stack (first bot in region only)
      │   ├── VPC + subnets + IGW + route tables     ~15-30s
      │   ├── NAT Instance + EIP + route              ~60-90s  ─┐
      │   ├── IAM roles + instance profile            ~120-180s ─┤ parallel in CF
      │   ├── Security groups                         ~10-15s  ─┘
      │   └── Stack complete: ~2.5-3.5 min (IAM InstanceProfile is CF bottleneck)
      │
~3:00 CF: Create per-bot stack (sequential — needs shared exports)
      │   ├── ALB + Target Group + Listener           ~30-60s
      │   ├── ASG + Launch Template (DesiredCap=0)    ~15-30s
      │   ├── ECS Cluster + Task Def + Service (DC=0) ~15-30s
      │   ├── SecretsManager + CloudWatch Logs        ~5-10s
      │   └── Stack complete: ~60-90s
      │
~4:00 Validate NAT readiness (describe route table, confirm 0.0.0.0/0 active)
      │
~4:00 SDK: UpdateService(DesiredCount=1)
      │   ├── ASG scales up → EC2 instance launches   ~30-45s
      │   ├── OS boot + Sysbox install (UserData)     ~30-45s
      │   ├── ECS agent registers with cluster        ~15-20s
      │   ├── Image pull (Docker Hub, ~500MB)         ~15-30s
      │   ├── Container start (apt-get + npm install + openclaw gateway) ~30-60s
      │   ├── ALB health check passes                 ~10s
      │   └── Total: ~2-3 min
      │
~6:00-7:00  BOT RUNNING
```

### Deploy Flow (Subsequent Bot, Shared Infra Exists)

```
0:00  User clicks "Deploy"
      │
      ├── Shared infra check: stack exists, exports valid   ~2s
      │
0:00  CF: Create per-bot stack            ~60-90s
      │
~1:00 SDK: UpdateService(DesiredCount=1)  ~2-3 min
      │
~3:00-4:00  BOT RUNNING
```

### Deploy Time Summary

| Scenario | Current (broken) | Phase 1 | Phase 2 (custom AMI + ECR image) |
|----------|-----------------|---------|----------------------------------|
| First bot, new region | 7-10 min (Sysbox install broken) | **~6 min** | **~4.5 min** |
| Subsequent bot | 3-5 min | **~3.5 min** | **~2 min** |

Phase 1 improvement: VPC endpoints removed (saves $117/mo, saves ~1 min on shared stack), Sysbox install fixed (binary extraction ~10s vs broken script). Phase 2: custom AMI + pre-built image eliminates Sysbox install entirely and apt-get/npm (30-60s).

### Why CF IAM InstanceProfile is the New Bottleneck

CloudFormation's IAM InstanceProfile resource takes ~2-3 min to create, even though the underlying API call is instant. This is a known CF behavior ([AWS re:Post report](https://repost.aws/questions/QUoU5UybeUR2S2iYNEJiStiQ/)). Within the shared stack, CF creates VPC resources (~30s) and IAM resources (~2.5 min) in parallel — so IAM is the critical path at ~2.5-3 min. This replaces VPC endpoints (3-5 min) as the bottleneck, which is still an improvement.

Further optimization (Phase 4): create IAM via SDK (instant) and pass ARNs as CF Parameters to per-bot stacks. This drops shared stack to ~1.5 min but requires changing per-bot template from `Fn::ImportValue` to Parameters.

### OOTB Compatibility

Clawster is open-source. Everything must work when the end user runs the install script, without pre-built AMIs or Docker images:

- **NAT Instance AMI**: Amazon Linux 2023 arm64 (standard, every region via SSM: `/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64`). NAT configured via iptables UserData (~15s boot).
- **ECS EC2 AMI**: ECS-optimized Amazon Linux 2023 x86_64 (standard, every region via SSM: `/aws/service/ecs/optimized-ami/amazon-linux-2023/recommended/image_id`). Sysbox v0.6.7 installed from GitHub `.deb` in UserData (~10s — see Sysbox Install Approach below). **Phase 1 uses x86_64 (t3.small)** for maximum OOTB compatibility — Chromium (needed for OpenClaw web browsing sandbox) has no official arm64 Linux build. Phase 3 migrates to arm64 (t4g.small, 18% cheaper).
- **Container image**: Docker Hub `node:22-slim`. OpenClaw installed via `npm install -g openclaw` in container command (~30-60s per container start). **Docker CLI (`docker.io`) is NOT needed** — OpenClaw uses Docker REST API via the mounted socket. Container startup command: `apt-get install -y git && npm install -g openclaw@latest` (not `docker.io`).
- **No pre-built AMIs or ECR images needed.** These are Phase 2 optimizations.

### NAT Instance Specification

| Property | Value |
|----------|-------|
| Type | `AWS::EC2::Instance` |
| Instance type | t4g.nano (2 vCPU, 0.5 GB RAM, 5 Gbps burst / 32 Mbps sustained baseline) |
| AMI | Amazon Linux 2023 arm64 (via `AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>`) |
| Subnet | PublicSubnet1 |
| SourceDestCheck | `false` (required for NAT packet forwarding) |
| EIP | `AWS::EC2::EIP` with `InstanceId` property directly (no EIPAssociation needed) |
| DisableApiTermination | `true` |
| Security group | Inbound: TCP 80/443 from VPC CIDR (10.0.0.0/16). Outbound: all traffic. |
| Route | `AWS::EC2::Route`: PrivateRouteTable, 0.0.0.0/0 → InstanceId |

UserData (~15s at boot):
```bash
#!/bin/bash
set -euo pipefail

# Install iptables (AL2023 uses nftables backend via iptables-nft)
yum install -y iptables-services
systemctl enable iptables
systemctl start iptables

# Enable IP forwarding (persists across reboots)
echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/nat.conf
sysctl -p /etc/sysctl.d/nat.conf

# Detect primary network interface (robust — works regardless of ip route output format)
# On t4g.nano (Nitro): interface is ens5. On older Xen: eth0. On some Nitro: enX0.
IFACE=$(ip route get 1.1.1.1 | grep -oP 'dev \K\S+')

# Configure NAT masquerade
iptables -t nat -A POSTROUTING -o "$IFACE" -j MASQUERADE

# CRITICAL: Explicitly set FORWARD policy to ACCEPT before flushing.
# Default policy on fresh AL2023 is ACCEPT, but future AMIs or hardened configs
# could default to DROP. Without this, NAT silently fails.
iptables -P FORWARD ACCEPT
iptables -F FORWARD

# Save rules to persist across reboots
service iptables save
```

Source: [AWS — Create a NAT AMI](https://docs.aws.amazon.com/vpc/latest/userguide/work-with-nat-instances.html#create-nat-ami)

**Verified against AWS docs**: The script matches the [official AWS NAT instance setup](https://docs.aws.amazon.com/vpc/latest/userguide/work-with-nat-instances.html) with three improvements: (1) `set -euo pipefail` for error handling, (2) `grep -oP` for robust interface detection across Nitro/Xen instance types, (3) explicit `iptables -P FORWARD ACCEPT` to prevent silent failure on hardened AMIs.

### OpenClaw Feature Compatibility

NAT Instance provides full outbound internet from private subnets. All OpenClaw features work:

| Feature | Mechanism | Status |
|---------|-----------|--------|
| WhatsApp (Baileys) | Outbound WebSocket | Works via NAT |
| Telegram (polling/webhook) | Outbound long-poll / Inbound POST to ALB | Works via NAT / ALB |
| Discord / Slack / Signal | Outbound WebSocket/HTTP | Works via NAT |
| LLM APIs (Anthropic, OpenAI) | Outbound HTTPS | Works via NAT |
| Web browsing (Chromium) | Outbound HTTP/HTTPS | Works via NAT |
| Docker sandbox (Sysbox) | Docker-in-Docker, `network: none` | Works via Sysbox on EC2 |
| npm / git (skills) | Outbound HTTPS | Works via NAT |

**Docker Hub rate limit**: All bots behind the NAT share one public IP → 100 anonymous pulls/6hrs. For 5+ bots restarting frequently, this could be hit. Phase 2 (ECR image) eliminates this concern.

**NAT SG port restriction**: The NAT Instance SG allows inbound TCP 80/443 from VPC CIDR only. Security groups **DO apply to forwarded/NATed traffic** (SourceDestCheck=false doesn't bypass SGs). This means ECS tasks can only reach the internet on ports 80 and 443. This is sufficient for all standard OpenClaw channels (all use HTTPS/WSS on port 443), Docker Hub, npm, GitHub, and LLM APIs. DNS (UDP 53) bypasses NAT via VPC resolver (link-local 169.254.169.253). NTP uses Amazon Time Sync (link-local 169.254.169.123). **Limitation**: SMTP (ports 25/587/465) and git:// protocol (port 9418) are blocked. Email channels would require expanding the NAT SG. Modern git defaults to HTTPS.

### Spike Test Results (2026-02-06) — Verified on Live AWS

Tested on ECS-optimized AL2023 AMI (ami-05f38d849db4be11d), t3.small, us-east-1a, kernel 6.1.159.

| Test | Result | Key Finding |
|------|--------|-------------|
| Sysbox .deb on ECS-optimized AL2023 | **PASS** (with fixes) | Needs `yum install -y binutils rsync fuse` + systemd path copy |
| Sysbox-runc container execution | **PASS** | `docker run --runtime=sysbox-runc --network=none alpine uname -a` → SUCCESS |
| ID-mapped mounts (kernel 6.1) | **PASS** | sysbox-mgr confirms "ID-mapped mounts supported: yes", "Overlayfs on ID-mapped mounts: yes" |
| OpenClaw GET / | **200 OK** | Returns Control UI HTML (841 bytes) — NO auth required |
| OpenClaw GET /health | **200 OK** | Dedicated health endpoint — NO auth required |
| veth kernel module | **NOT AVAILABLE** | Expected on ECS-optimized AMI. Sandbox uses `network: none` (default). Non-issue. |

Full spike results: `memory/ecs-ec2-spike-results.md`

### OOTB Risks (must verify before implementation)

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Sysbox install script is broken** | The current code downloads `scr/install.sh` from GitHub — **this file returns HTTP 404**. Sysbox does NOT provide an install script or RPM packages. Only `.deb` packages are released. | **Fix**: Extract statically-linked binaries directly from the v0.6.7 `.deb` release asset (see Sysbox install approach below). **Requires `yum install -y binutils rsync fuse`** first (NOT pre-installed on ECS-optimized AMI). Also requires copying systemd unit files to `/etc/systemd/system/` (`.deb` extracts to `/lib/systemd/system/` which ECS-optimized AMI doesn't scan). **SPIKE VERIFIED 2026-02-06.** |
| **Sysbox .deb supply chain** | UserData downloads `.deb` from GitHub releases without checksum verification. GitHub outage or repo compromise = broken/malicious deploy. | Pin to exact release version (v0.6.7) + verify SHA256 checksum before extraction. |
| **Container startup `apt-get + npm install`** | Every container start downloads ~200MB from package registries. Non-deterministic, slow (30-60s), depends on external services being up. | Acceptable for Phase 1 OOTB. Phase 2 pre-built Docker image eliminates this. |
| **Docker Hub image tag mutability** | Using `node:22-slim` by tag means Docker Hub could push a different image to the same tag. | Acceptable for Phase 1. Phase 2 pins to digest or uses ECR. |
| **Secrets Manager ARN suffix** | ECS task definition `Secrets` field requires the FULL ARN including the 6-character random suffix (e.g., `-AbCdEf`). The `OPENCLAW_CONFIG` secret is created via SDK before the CF stack, so its full ARN is unknown at template generation time. Using `Fn::Sub` to construct an ARN without the suffix will cause `ResourceInitializationError` at task launch. | **Fix**: After creating the secret via SDK (`ensureSecret()`), call `describeSecret` to get the full ARN. Pass it to `generatePerBotTemplate()` as a new `openclawConfigSecretArn` parameter. Use the full ARN directly in `ValueFrom` instead of `Fn::Sub`. The `GatewayTokenSecret` (CF resource) is fine — `Ref` returns the full ARN with suffix. |
| **Sysbox systemd unit dependencies unknown** | The `.deb` packages include systemd unit files for `sysbox-mgr.service` and `sysbox-fs.service`, but the unit file contents are not public (Nestybox keeps packaging code private). If the services have `After=docker.service`, `systemctl start --no-block` is safe (systemd defers start). If they don't and require Docker functionally, they could fail silently. **Spike note**: On ECS-optimized AMI, unit files extract to `/lib/systemd/system/` which systemd doesn't scan — must copy to `/etc/systemd/system/`. | **Mitigation**: (1) Copy unit files: `cp /lib/systemd/system/sysbox*.service /etc/systemd/system/`. (2) `systemctl enable` ensures services start on every boot. (3) `--no-block` prevents cloud-init deadlock. (4) Belt-and-suspenders background polling fallback: `(while ! systemctl is-active docker; do sleep 1; done; systemctl start sysbox-mgr sysbox-fs) &`. Sysbox only needs to be running when OpenClaw creates a sandbox container (~30-60s after task start). **All verified in spike test.** |
| **Bot name length limit** | ALB and Target Group names have a **32-character maximum**. With prefix `clawster-${botName}-tg`, botName > 20 characters will fail CloudFormation deployment with an unhelpful error. | **Fix**: Validate botName ≤ 20 characters at the API layer (onboarding wizard). Display clear error: "Bot name must be 20 characters or fewer." Alternatively, use hash-based truncation for resource names, but validation is simpler and more user-friendly. |

### Sysbox Install Approach (replaces broken `scr/install.sh`) — SPIKE VERIFIED 2026-02-06

Sysbox v0.6.7 publishes `.deb` packages with statically-linked binaries (~10 MB) for both amd64 and arm64. No compilation needed. v0.6.7 (May 2025) fixes a critical bug for "containers with many image layers on kernels without idmapping or shiftfs" — which is exactly the AL2023 scenario (no shiftfs, kernel 6.1). The UserData extracts binaries and configures systemd:

```bash
# REQUIRED PACKAGES — NOT pre-installed on ECS-optimized AL2023 AMI (spike-verified)
# - binutils: provides `ar` command for .deb extraction
# - rsync: sysbox-mgr preflight check requires it (fatal error without)
# - fuse: provides `fusermount` binary for sysbox-fs FUSE mount
yum install -y binutils rsync fuse

# Download and extract Sysbox from .deb (statically linked x86_64 binaries)
# Phase 1 uses amd64; Phase 3 (Graviton) switches to arm64
SYSBOX_VERSION="0.6.7"
cd /tmp
curl -fsSL -o sysbox.deb \
  "https://github.com/nestybox/sysbox/releases/download/v${SYSBOX_VERSION}/sysbox-ce_${SYSBOX_VERSION}.linux_amd64.deb"
ar x sysbox.deb
tar xf data.tar.* -C /

# FIX SYSTEMD PATH — .deb extracts unit files to /lib/systemd/system/ but on
# ECS-optimized AL2023, /lib is NOT a symlink to /usr/lib (unlike standard AL2023).
# systemd only scans /usr/lib/systemd/system/ and /etc/systemd/system/.
cp /lib/systemd/system/sysbox*.service /etc/systemd/system/

# Create sysbox user and mountpoint
useradd -r -s /bin/false sysbox || true
mkdir -p /var/lib/sysboxfs

# Apply sysctl settings required by Sysbox
cat > /etc/sysctl.d/99-sysbox.conf <<'SYSCTL'
fs.inotify.max_queued_events=1048576
fs.inotify.max_user_watches=1048576
fs.inotify.max_user_instances=1048576
kernel.keys.maxkeys=20000
kernel.keys.maxbytes=400000
SYSCTL
sysctl --system

# Register sysbox-runc as Docker runtime in daemon.json
# IMPORTANT: On ECS-optimized AMI, Docker has NOT started yet when UserData runs.
# Boot order: UserData → cloud-init completes → Docker starts → ECS agent starts.
# We write daemon.json BEFORE Docker first starts — no restart needed.
mkdir -p /etc/docker
python3 -c "
import json, os
p = '/etc/docker/daemon.json'
d = json.load(open(p)) if os.path.exists(p) else {}
d.setdefault('runtimes', {})['sysbox-runc'] = {'path': '/usr/bin/sysbox-runc'}
json.dump(d, open(p, 'w'), indent=2)
"

# Enable Sysbox systemd services with --no-block to avoid cloud-init deadlock.
# Services will start after Docker starts. Sysbox only needs to be running
# when OpenClaw creates a sandbox container (30-60s after task starts).
systemctl daemon-reload
systemctl enable sysbox-mgr sysbox-fs
systemctl start sysbox-mgr sysbox-fs --no-block

# Belt-and-suspenders: background polling ensures Sysbox starts after Docker.
# Sysbox systemd unit dependencies are unknown (private packaging code).
# This is a no-op if --no-block already started them successfully.
(while ! systemctl is-active --quiet docker; do sleep 2; done
 systemctl start sysbox-mgr sysbox-fs 2>/dev/null || true) &

# DO NOT restart Docker here. On ECS-optimized AMI, Docker hasn't started yet.
# Docker will read daemon.json (with sysbox-runc) on first start after cloud-init completes.
# Calling `systemctl restart docker` here would cause a systemd deadlock:
# Docker.service waits for cloud-final → cloud-final waits for UserData → UserData blocked on Docker.
# See: https://github.com/aws/amazon-ecs-agent/issues/1707
```

**Why this works OOTB**: The three Sysbox binaries (`sysbox-runc`, `sysbox-fs`, `sysbox-mgr`) are statically linked ELF x86_64 executables with zero library dependencies. They work on any Linux x86_64 kernel >= 5.5 (AL2023 uses 6.1). The `.deb` package is just a container for the binaries + systemd unit files. **Three packages must be installed first**: `binutils` (provides `ar` for .deb extraction), `rsync` (sysbox-mgr preflight requirement), and `fuse` (sysbox-fs FUSE mount). `tar` and `python3` (3.9) are pre-installed on all AL2023 variants. **Additionally**, the `.deb` extracts systemd unit files to `/lib/systemd/system/`, but on ECS-optimized AL2023, `/lib` is NOT a symlink to `/usr/lib` — files must be copied to `/etc/systemd/system/`. Install time: **~15 seconds** (yum install ~5s + download ~10MB + extract + configure). **All verified on live ECS-optimized AL2023 AMI (ami-05f38d849db4be11d) on 2026-02-06.**

**ECS-optimized AMI boot order**: UserData runs BEFORE Docker and ECS agent start. The sequence is: (1) cloud-init executes UserData, (2) cloud-init completes, (3) Docker starts (reads daemon.json with sysbox-runc), (4) ECS agent starts (reads /etc/ecs/ecs.config). This means daemon.json is written before Docker's first boot — no Docker restart required. Source: [AWS ECS Agent Configuration](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/bootstrap_container_instance.html), [systemd deadlock issue](https://github.com/aws/amazon-ecs-agent/issues/1707).

**Note on official support**: Sysbox's [distro-compat.md](https://github.com/nestybox/sysbox/blob/master/docs/distro-compat.md) lists AL2023 as "Build from Source" only — no pre-built RPM packages exist. However, the `.deb` extraction approach works because the binaries are statically linked (no library dependencies). This is an unsupported but verified installation method. Sysbox is maintained by Docker Inc. (acquired Nestybox in 2022) as a community open-source project.

**ECS runtime note**: ECS task definitions cannot specify `--runtime=sysbox-runc` ([containers-roadmap#1072](https://github.com/aws/containers-roadmap/issues/1072)). This is fine — the ECS task runs OpenClaw with the default `runc` runtime. OpenClaw creates sandbox containers via the Docker API (over the mounted Docker socket at `/var/run/docker.sock`), specifying `--runtime=sysbox-runc`. OpenClaw does NOT need the Docker CLI binary — it communicates with the Docker daemon directly via REST API over the Unix socket. The ECS task itself does not need Sysbox.

**Docker socket mount**: The ECS task definition must mount `/var/run/docker.sock` from the host for OpenClaw sandbox mode to work. This is configured via `volumes` (host bind) and `mountPoints` in the task definition. This is a known security trade-off (see Section 3, Known Security Limitations).

Source: [Sysbox v0.6.7 Release](https://github.com/nestybox/sysbox/releases/tag/v0.6.7), [Sysbox Distro Compatibility](https://github.com/nestybox/sysbox/blob/master/docs/distro-compat.md)

---

## 3. Security

### OpenClaw Threat Landscape (Feb 2026)

- **5 HIGH/CRITICAL CVEs** in Jan-Feb 2026 (1-click RCE, command injection, unauthenticated local RCE, file inclusion)
- **42,665+ exposed instances**, 93.4% with authentication bypass
- Port 18789 exposes the **full control plane**: config rewrite, agent execution, arbitrary commands
- Prompt injection is the primary threat — OpenClaw processes untrusted content with shell access
- Official docs: "intended for local use only — not hardened for public internet exposure"

Sources: [CVE-2026-25253](https://socradar.io/blog/cve-2026-25253-rce-openclaw-auth-token/), [Cisco Analysis](https://blogs.cisco.com/ai/personal-ai-agents-like-openclaw-are-a-security-nightmare), [JFrog Analysis](https://jfrog.com/blog/giving-openclaw-the-keys-to-your-kingdom-read-this-first/)

### Security Controls (all implemented at launch)

| Control | Implementation | Notes |
|---------|---------------|-------|
| Private subnet | EC2 + tasks in private subnets, no public IP | Non-negotiable given threat landscape |
| NAT (outbound only) | NAT Instance in public subnet, no inbound route to bots | Bots cannot be reached directly from internet |
| ALB as sole entry point | ALB SG: inbound 80/443 | Only path to reach bots |
| Task security group | Inbound only from ALB SG on gateway port | No other inbound traffic reaches tasks |
| IMDSv2 enforced | `MetadataOptions: { HttpTokens: required, HttpPutResponseHopLimit: 2 }` | Enforces IMDSv2 (disables v1). Hop limit 2 allows ECS agent to reach IMDS through container networking. |
| IMDS blocked for tasks | `ECS_AWSVPC_BLOCK_IMDS=true` in ECS agent config | **Primary IMDS defense for awsvpc mode.** In awsvpc, hop limit alone does NOT block tasks (ENI is directly attached to instance, still 1 hop). This ECS agent setting is the only effective mechanism. |
| No SSH access | No key pair in launch template | SSM Session Manager available if debugging needed |
| Gateway auth token | Generated per-bot, stored in Secrets Manager, injected as env var | Prevents unauthorized gateway access |
| Least-privilege task role | Empty IAM role (zero AWS permissions) | Compromised task can't call any AWS API |
| Sysbox runtime | Installed via UserData for secure Docker-in-Docker | Sandbox containers get isolated user namespaces |
| EBS encryption | `Encrypted: true` in BlockDeviceMappings | Data at rest encrypted |
| Deployment circuit breaker | `deploymentCircuitBreaker: { enable: true, rollback: true }` | Auto-rollback on 3 consecutive failures |
| Container Insights | `containerInsights: enabled` on cluster | Resource metrics and monitoring |
| NAT Instance hardened | DisableApiTermination, no SSH, minimal SG, no key pair | Minimal attack surface |
| VPC Flow Logs | `AWS::EC2::FlowLog` on VPC, REJECT-only, to CloudWatch Logs | Forensics for untrusted AI agent traffic. Detects anomalous outbound connections. |

### Known Security Limitations

| Limitation | Risk | Mitigation |
|-----------|------|------------|
| Docker socket mount | OpenClaw container mounts host Docker socket for sandbox mode. If compromised, attacker can create containers on host. | Sysbox isolates sandbox containers. Private subnet prevents direct attack. ALB auth token required for access. |
| Root user in container | OpenClaw runs as root (needs Docker socket access). | Sysbox containers run root inside an unprivileged user namespace — host root is NOT exposed. |
| NAT Instance is user-managed | Unlike NAT Gateway, the OS could theoretically be compromised. | AL2023 has automatic security updates. No SSH. DisableApiTermination. All traffic through NAT is HTTPS (encrypted end-to-end, NAT only sees IPs/SNI, not payloads). |
| Shared execution role wildcard | In shared-infra mode, the Task Execution Role has `clawster/*` Secrets Manager access. A container that escapes via Docker socket could read other bots' secrets. | Per-bot mode scopes to `clawster/${botName}/*`. In shared mode, the Task Role (runtime) has zero permissions — escape requires Docker socket exploitation. ECS control plane only fetches secrets referenced in the task definition. |

### Security Hardening Backlog (post-launch improvements)

| Item | Priority | Description |
|------|----------|-------------|
| Read-only root filesystem | HIGH | `readonlyRootFilesystem: true` + writable `/tmp` and `/home/node/.openclaw`. Requires testing that OpenClaw works with read-only root. |
| Drop Linux capabilities | HIGH | `capabilities: { drop: ["ALL"] }`, `initProcessEnabled: true`. Requires testing with Docker socket operations. |
| Non-root user | MEDIUM | `user: "1000:1000"`. Blocked by Docker socket permission — needs socket group config or socket proxy. |
| CloudWatch log encryption | LOW | KMS CMK on log groups. Adds ~$1/mo per key. |
| GuardDuty Runtime | RECOMMENDED | Detects container escapes, credential theft, cryptomining. Separate AWS account-level enablement. |

---

## 4. Cost

### What a User Actually Pays AWS

**Important**: Since February 1, 2024, AWS charges **$0.005/hr ($3.65/mo) for every public IPv4 address**, including EIPs and ALB IPs. This affects NAT Instance EIP and ALB public IPs. Source: [AWS Public IPv4 Address Charge](https://aws.amazon.com/blogs/aws/new-aws-public-ipv4-address-charge-public-ip-insights/).

| Component | Monthly | Notes |
|-----------|---------|-------|
| NAT Instance (shared) | **$3** | t4g.nano ($0.0042/hr × 730 hrs), shared across all bots in region |
| NAT EIP IPv4 (shared) | **$3.65** | $0.005/hr × 730 hrs. Since Feb 2024, all public IPv4 addresses are charged. |
| EC2 per bot | $15 | t3.small ($0.0208/hr × 730 hrs, 2 vCPU, 2 GB RAM) |
| ALB per bot | $17 | Application Load Balancer ($0.0225/hr × 730 = $16.43) + minimal LCU (~$0.50) |
| ALB IPv4 per bot | $7.30 | 2 public IPs (1 per AZ) × $0.005/hr × 730 hrs |
| EBS per bot | $2.40 | 30 GB gp3 ($0.08/GB-month), includes 3000 IOPS + 125 MB/s baseline |
| **Per-bot total** | **$42** | |
| **Shared total** | **$7** | NAT Instance + EIP. Amortized across all bots. |

| Bots | Monthly total | Per-bot average |
|------|--------------|-----------------|
| 1 | **$49** | $49 |
| 2 | **$91** | $45.50 |
| 3 | **$133** | $44.33 |
| 5 | **$217** | $43.40 |
| 10 | **$427** | $42.70 |

**Note**: Container Insights (if enabled) adds ~$5/mo per cluster. Enabled by default for monitoring but can be disabled to save cost. VPC Flow Logs add ~$0.25/mo (negligible).

### Shared ALB Migration (optional, suggested at 3+ bots)

Consolidating per-bot ALBs into one shared ALB saves ~$24/bot/mo (ALB hourly + IPv4):

| Bots | Dedicated ALBs | Shared ALB | Savings |
|------|---------------|------------|---------|
| 3 | $133/mo | $85/mo | $48/mo |
| 5 | $217/mo | $120/mo | $97/mo |
| 10 | $427/mo | $214/mo | $213/mo |

Migration is a **non-blocking suggestion** in the UI at 3+ bots. Never automatic, never mandatory. See Section 6 for UX.

**What migration does** (~2 min, ~30s downtime):
1. Create shared ALB with host-based listener rules per bot (~30s)
2. Re-register each bot's target group to shared ALB (~10s each)
3. Delete per-bot ALBs (background cleanup)

### VPC Endpoints: Not Used

VPC endpoints cost $0.01/hr per AZ per endpoint + $0.01/GB data processing. With 8 interface endpoints × 2 AZs × $0.01/hr × 730 hrs: **~$117/mo** (before data charges). This is ~17x the NAT Instance + EIP cost ($7/mo). Skip entirely — NAT handles all connectivity. All traffic through NAT is HTTPS (encrypted end-to-end).

### Cost Optimization Backlog

| Item | Savings | Effort | Phase |
|------|---------|--------|-------|
| Shared ALBs | ~$24/bot/mo (ALB + IPv4) | Medium | 3 |
| Graviton t4g.small | ~$3/bot/mo | Medium (AMI + Sysbox .deb swap; `node:22-slim` already multi-arch) | 3 |
| t4g.micro tier | ~$9/bot/mo | Low (light bots <50 msg/day) | 3 |
| Multi-bot per instance | ~$10-12/bot/mo | High | 4 |
| Spot instances | ~$9/bot/mo (60-70%) | Medium | 4 |

---

## 5. Reliability

### Deployment Reliability

| Control | Implementation | Why |
|---------|---------------|-----|
| Circuit breaker | `DeploymentCircuitBreaker: { Enable: true, Rollback: true }` | Auto-rolls back after 3 consecutive task failures. Threshold: `min(max(3, ceil(0.5 * desiredCount)), 200)` = 3 for DC=1. |
| Managed draining | `managedDraining: ENABLED`, `managedTerminationProtection: ENABLED` | Graceful task drain before instance termination. |
| DesiredCount=0 install | Per-bot CF creates service with DC=0; `start()` activates later. | Eliminates race condition: NAT must be ready before tasks try to pull images. |
| NAT readiness check | Before `start()`, verify `describeRouteTables` shows 0.0.0.0/0 → active | Prevents `CannotPullContainerError` from tasks scheduled before NAT is routable. |
| Health check tuning | 5s interval, 3s timeout, 2 healthy / 3 unhealthy threshold | Fast detection. First registered target needs only 1 successful check (~5-10s). |

### NAT Instance Reliability

| Concern | Solution |
|---------|---------|
| Hardware failure | CloudWatch auto-recovery alarm: `StatusCheckFailed_System` → `arn:aws:automate:${region}:ec2:recover`. Same instance ID, IP, and ENI preserved. Recovery: ~5-10 min. Requires: EBS-backed (yes), not in ASG (yes), not on Dedicated Host (yes). T4g family is explicitly supported. |
| Accidental termination | `DisableApiTermination: true`. CF stack protection. |
| OS crash/freeze | Instance status check fails → CloudWatch alarm → auto-recovery. |
| Throughput | t4g.nano: 5 Gbps burst / **32 Mbps sustained baseline**. Bot traffic is bursty API calls (LLM, webhooks), well under 32 Mbps sustained. Image pulls (~500MB) complete within burst window. For 1-10 bots, this is sufficient. If sustained throughput is needed, upgrade to t4g.micro (64 Mbps baseline, ~$6/mo) or t4g.small (128 Mbps baseline, ~$12/mo). |

**Single point of failure**: NAT Instance is one instance in one AZ. If that AZ goes down, bots lose outbound internet (ALB inbound may still work across AZs). For production workloads needing multi-AZ NAT, upgrade to NAT Instance per AZ or NAT Gateway ($33/mo). This is a Phase 4 consideration.

### Stack Recovery

| State | Recovery |
|-------|---------|
| CREATE_FAILED | Delete stack, re-create. CF cleans up created resources. |
| UPDATE_ROLLBACK_FAILED | `ContinueUpdateRollback` with `ResourcesToSkip` for stuck resources. |
| DELETE_FAILED | `DeleteStack` with `ResourcesToSkip`, then manually delete stuck resources. |
| Shared stack delete blocked | CF prevents deletion if per-bot stacks consume its exports via `Fn::ImportValue`. Delete all per-bot stacks first, then shared stack. Use `listImports` to find consuming stacks. |

---

## 6. Deploy UX

### Design Principles

1. **No hidden side effects** — Never create AWS resources before the user clicks "Deploy"
2. **Transparent progress** — Show every step with real-time status
3. **No orphaned resources** — If deploy fails, clean up. If user cancels, nothing was created
4. **First bot = subsequent bot** — Same UX regardless of whether shared infra exists

### Progress UI

First bot in a new region:
```
Deploying "my-support-bot" to AWS (us-east-1)
First deployment in this region — setting up networking (one-time, ~3 min)

[================----------] 60%

  ✓ VPC + subnets created                           8s
  ✓ Security roles created                          15s
  > NAT instance starting...                        45s remaining
  > IAM profiles provisioning...                    90s remaining
    Load balancer
    Server
    Starting OpenClaw
    Health check

Estimated: ~4 minutes remaining
```

Subsequent bot:
```
Deploying "my-devops-bot" to AWS (us-east-1)

[==========-----------------] 35%

  ✓ Network ready (shared)                          instant
  > Load balancer provisioning...                   30s remaining
  > Server launching...                             60s remaining
    Starting OpenClaw
    Health check

Estimated: ~3 minutes remaining
```

### Shared ALB Suggestion (3+ bots)

```
┌──────────────────────────────────────────────────┐
│  Save on load balancers?                         │
│                                                  │
│  You're running {n} bots in {region}.            │
│  Consolidating to a shared load balancer         │
│  saves ~${savings}/month.                        │
│                                                  │
│  Current:  ${current}/mo                         │
│  After:    ${after}/mo                           │
│                                                  │
│  ~30 seconds downtime during migration.          │
│                                                  │
│  [ Consolidate ]          [ Maybe later ]        │
│                                                  │
│  Your bot will deploy either way.                │
└──────────────────────────────────────────────────┘
```

Rules:
- Banner in the main UI, not a modal
- Dismissible permanently ("Don't show again")
- Bot deploys regardless of choice
- Migration available later from settings
- Never automatic, never mandatory

### Full User Journey

```
0:00  git clone + pnpm install              ~2 min (one-time)
2:00  pnpm dev (start API + Web)            ~15s
2:15  Create account in web UI              ~30s
2:45  Bot creation wizard                   ~2 min
      - Pick AWS, enter credentials
      - Bot name, model provider, API key
      - Channels (optional)
      - Review, click Deploy
4:45  Deploy (first bot):
      - Shared infra CF stack              ~3 min
      - Per-bot CF stack                   ~1 min
      - EC2 + container startup            ~2 min
10:45 BOT IS RUNNING (first bot)
```

**Total: ~11 min from git clone to running bot (first time).**
**Active interaction: ~4.5 min. Idle wait: ~6 min.**
**Second bot onward: ~3.5 min deploy (no shared infra step).**

---

## 7. Implementation Changes Required

### Shared Infra Stack Changes

1. **Remove VPC endpoints** from `shared-production.ts`
   - Remove `buildSharedVpcEndpointResources()` import and spread
   - Remove `VpcEndpointSecurityGroup` resource from VPC endpoint template
   - Remove `VpcEndpointSecurityGroupId` from `SharedExportNames` and `SharedInfraOutputs`
   - Saves ~$117/mo and ~1-2 min on first deploy

2. **Add NAT Instance resources** to a new `shared-nat-template.ts`
   - `AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>` parameter for AL2023 arm64 AMI
   - `AWS::EC2::SecurityGroup` — inbound TCP 80/443 from VPC CIDR, outbound all
   - `AWS::EC2::Instance` — t4g.nano, `SourceDestCheck: false`, `DisableApiTermination: true`, iptables UserData
   - `AWS::EC2::EIP` with `InstanceId: !Ref NatInstance` (no EIPAssociation needed)
   - `AWS::EC2::Route` on PrivateRouteTable — `0.0.0.0/0` → `InstanceId: !Ref NatInstance`
   - `AWS::CloudWatch::Alarm` — `StatusCheckFailed_System`, action: `arn:aws:automate:${region}:ec2:recover`, Period: 60, EvaluationPeriods: 2
   - Add to `shared-production.ts`: `...buildSharedNatResources()`

3. **Update shared exports** in `shared-outputs-template.ts`
   - Remove `VpcEndpointSecurityGroupId` export
   - Add `NatInstanceId` export (for monitoring/reference)

4. **Update `shared-infra-config.ts`**
   - Remove `vpcEndpointSecurityGroupId` from `SharedInfraOutputs` interface
   - Remove `VpcEndpointSecurityGroupId` from `SharedExportNames`
   - Add `NatInstanceId` to both

### Per-Bot Stack Changes

5. **Keep DesiredCount=0** (no change needed — current behavior is correct)
   - `start()` in `ecs-ec2-target.ts` calls `UpdateService(DesiredCount=1)` — this is the right pattern
   - Avoids the NAT readiness race condition

6. **Add security controls to launch template** in `per-bot-template.ts`:
   - `MetadataOptions: { HttpTokens: "required", HttpPutResponseHopLimit: 2, HttpEndpoint: "enabled" }` (hop limit 2 allows ECS agent through container networking; actual IMDS blocking for awsvpc tasks is via ECS_AWSVPC_BLOCK_IMDS)
   - Remove any key pair reference
   - `BlockDeviceMappings: [{ DeviceName: "/dev/xvda", Ebs: { Encrypted: true, VolumeType: "gp3", VolumeSize: 30 } }]`

7. **Add ECS agent config and Sysbox install to per-bot UserData** — SPIKE VERIFIED 2026-02-06:
   - **Install required packages first**: `yum install -y binutils rsync fuse` (NOT pre-installed on ECS-optimized AMI)
   - Write to `/etc/ecs/ecs.config` (read by ECS agent on first start):
     - `ECS_CLUSTER={clusterName}`
     - `ECS_AWSVPC_BLOCK_IMDS=true`
     - `ECS_DISABLE_PRIVILEGED=true`
   - Run Sysbox install (see Sysbox Install Approach above) — extract .deb, **copy systemd units to `/etc/systemd/system/`**, write daemon.json, enable services with `--no-block`
   - **Systemd path fix**: `.deb` extracts unit files to `/lib/systemd/system/` but ECS-optimized AL2023 does NOT have `/lib` → `/usr/lib` symlink. Must `cp /lib/systemd/system/sysbox*.service /etc/systemd/system/` after extraction.
   - **Boot order**: UserData runs BEFORE Docker and ECS agent start on ECS-optimized AMI. Docker reads daemon.json (with sysbox-runc) on first boot. ECS agent reads ecs.config on first boot. No Docker restart needed.
   - **CRITICAL**: Use `--no-block` for all `systemctl start/restart` commands to avoid systemd deadlock with cloud-init. See [aws/amazon-ecs-agent#1707](https://github.com/aws/amazon-ecs-agent/issues/1707).

8. **Add deployment reliability to ECS service**:
   - `DeploymentConfiguration: { DeploymentCircuitBreaker: { Enable: true, Rollback: true } }`
   - Capacity provider: `ManagedDraining: ENABLED`, `ManagedTerminationProtection: ENABLED`, `ManagedScaling: { Status: ENABLED }` (ManagedTerminationProtection requires ManagedScaling — without it, termination protection silently does nothing)

9. **Enable Container Insights** on ECS cluster (optional, adds ~$5/mo per cluster):
   - `ClusterSettings: [{ Name: "containerInsights", Value: "enabled" }]`
   - Publishes ~16 custom CloudWatch metrics per cluster at $0.30/metric/mo
   - Can be disabled to save cost; recommend enabling for initial deploys to debug issues

10. **Remove VPC endpoint SG reference** from per-bot template if present
    - Any `importShared(SharedExportNames.VpcEndpointSecurityGroupId)` reference must be removed

10b. **Add VPC Flow Logs** to shared VPC template:
    - `AWS::EC2::FlowLog` on VPC, `TrafficType: REJECT`, `LogDestinationType: cloud-watch-logs`
    - `AWS::Logs::LogGroup` with 30-day retention (forensics for untrusted AI agent traffic)
    - `AWS::IAM::Role` for flow log delivery to CloudWatch Logs (`DeliverLogsPermissionArn` is **required** for `cloud-watch-logs` destination type)

10c. **Set ALB idle timeout to 120 seconds**:
    - Default ALB idle timeout is 60 seconds. OpenClaw gateway heartbeat is ~60 seconds — borderline.
    - Set `idle_timeout.timeout_seconds: 120` on the ALB to prevent WebSocket disconnections.
    - ALB natively supports WebSocket (`Upgrade: websocket` header), no special config needed beyond idle timeout.

10d. **Configure OpenClaw for ALB** — SPIKE VERIFIED 2026-02-06:
    - Set `gateway.mode: "local"` (**required** — gateway refuses to start without it: "Missing config. Run `openclaw setup` or set gateway.mode=local")
    - Set `gateway.bind: "lan"` (binds to `0.0.0.0` so ALB can reach the container)
    - Set `gateway.trustedProxies` with VPC CIDR so `X-Forwarded-For` headers from ALB are trusted
    - Health check: Use `GET /health` on the gateway port (18789). **Both `/` and `/health` return HTTP 200 without authentication** (spike-verified with `auth.mode: "token"` enabled). `/` returns the Control UI HTML (841 bytes, text/html). `/health` is a dedicated health endpoint. **Recommend `/health`** as it's purpose-built and less likely to change behavior in future versions. Standard ALB matcher `200` works — the broad `200-499` range is not needed.

10e. **Mount Docker socket in ECS task definition** (required for OpenClaw sandbox mode):
    - Volume: `{ name: "docker-socket", host: { sourcePath: "/var/run/docker.sock" } }`
    - MountPoint: `{ sourceVolume: "docker-socket", containerPath: "/var/run/docker.sock", readOnly: false }`
    - OpenClaw communicates with Docker daemon via REST API over the Unix socket (does NOT need Docker CLI binary)
    - OpenClaw creates sandbox containers with `--runtime=sysbox-runc` through the Docker API
    - Sandbox containers use `debian:bookworm-slim` base (auto-selects correct arch), `network: none` by default, resource-limited (1 CPU, 1GB RAM)
    - **Spike-verified**: `veth` kernel module is NOT available on ECS-optimized AL2023 AMI (`modprobe veth` → "Module not found"). Docker bridge networking does NOT work. This is expected — ECS uses `awsvpc` mode. Sandbox containers **MUST** use `network: none` (which is OpenClaw's default). This is a non-issue but important to document.
    - Security: Docker socket mount is the primary trade-off for sandbox support (see Section 3, Known Security Limitations)

10f. **HTTPS/TLS on ALB** (progressive):
    - Phase 1: ALB supports both HTTP (port 80) and HTTPS (port 443). `certificateArn` is optional in config.
    - If user provides ACM certificate ARN: HTTPS listener on 443, HTTP→HTTPS redirect on 80.
    - If no certificate: HTTP listener on 80 only. UI displays warning: "Gateway token is sent in plaintext. Set up HTTPS for production use."
    - ACM certificates are free. User needs: custom domain + DNS validation (CNAME record, one-time).
    - Clawster can offer ACM certificate creation in onboarding wizard (calls `RequestCertificate` API, user validates DNS).
    - **Why not require HTTPS**: OOTB friction. Many users don't have a custom domain set up. HTTP-only works for local testing / initial setup. Channels using outbound connections (WhatsApp, Discord, Slack) don't need HTTPS. Only Telegram webhook mode requires HTTPS.
    - **Why strongly recommend HTTPS**: Gateway auth token sent during WebSocket handshake is plaintext over HTTP. Given OpenClaw's CVE history, this is a significant risk for production use.

### Start Flow Changes

11. **Validate NAT readiness before `start()`**: Before `UpdateService(DesiredCount=1)`, call `describeRouteTables` for the private route table and confirm the `0.0.0.0/0` route is `active` with a target. If not ready, wait with exponential backoff (max ~30s). This prevents `CannotPullContainerError` on first deploy.

### Bug Fixes Required (found in 4th audit)

12. **Fix Secrets Manager ARN in task definition** (CRITICAL — deployment will fail without this):
    - The `OPENCLAW_CONFIG` secret is created via SDK in `install()` before the CF stack. Its full ARN includes a random 6-character suffix (e.g., `arn:aws:secretsmanager:us-east-1:123:secret:clawster/bot/config-AbCdEf`).
    - The current template uses `Fn::Sub` to construct the ARN **without** this suffix — ECS will fail with `ResourceInitializationError`.
    - **Fix**: After `ensureSecret()`, call `describeSecret()` to get the full ARN. Add `openclawConfigSecretArn: string` parameter to `PerBotTemplateParams` and `EcsResourceOptions`. Use the full ARN directly in `ValueFrom`.
    - The `GatewayTokenSecret` (CF resource) is fine — `Ref` returns the full ARN with suffix.

13. **Fix health check path from `/` to `/health`** (RECOMMENDED — both work, `/health` is better):
    - **Spike-verified (2026-02-06)**: Both `GET /` (200, HTML) and `GET /health` (200) respond **without authentication**, even with `auth.mode: "token"` enabled. The original concern about auth blocking health checks was wrong.
    - **Still recommend `/health`**: It's a dedicated health endpoint, less likely to change behavior in future OpenClaw versions. Using `/` works but returns the full Control UI HTML (841 bytes) on every health check — wasteful.
    - **Fix**: Change `HealthCheckPath` from `"/"` to `"/health"` in both `per-bot-template.ts` and `ecs-template.ts`. Use standard ALB matcher `200` (not `200-499`).

14. **Remove `docker.io` from container startup command** (saves ~30s + ~100MB per container start):
    - OpenClaw communicates with Docker daemon via REST API over the Unix socket. It does NOT use the Docker CLI binary.
    - No `dockerode`, `docker-modem`, or other Docker client libraries in OpenClaw's `package.json`.
    - **Fix**: Change `apt-get install -y git docker.io` to `apt-get install -y git` in the container command.
    - Keep `chmod 660 /var/run/docker.sock` — it's harmless and useful if socket permissions need adjustment.

15. **Validate bot name length** (max 20 characters):
    - ALB and Target Group names have a 32-character maximum. With `clawster-${botName}-tg` (12 chars prefix+suffix), botName > 20 chars fails CF deploy.
    - **Fix**: Add validation in the onboarding API: `botName.length <= 20`, alphanumeric + hyphens only, no leading/trailing hyphens.

16. **Separate instance and task security groups**:
    - Current code uses `TaskSecurityGroup` for both the EC2 instance primary ENI (via Launch Template) and the task ENI (via ECS Service NetworkConfiguration).
    - The instance's primary ENI doesn't need inbound on the gateway port — only the task ENI does.
    - **Fix**: Create `InstanceSecurityGroup` with outbound-all only (no inbound rules). Use it in Launch Template `SecurityGroupIds`. Keep `TaskSecurityGroup` for ECS Service NetworkConfiguration only.

17. **Add Sysbox systemd fallback** to per-bot UserData:
    - Sysbox systemd unit file dependencies are unknown (private packaging code). As belt-and-suspenders:
    - After `systemctl enable sysbox-mgr sysbox-fs` and `systemctl start --no-block`, add background polling:
    ```bash
    # Fallback: ensure Sysbox services start after Docker
    (while ! systemctl is-active --quiet docker; do sleep 2; done
     systemctl start sysbox-mgr sysbox-fs 2>/dev/null || true) &
    ```
    - This is a no-op if services already started successfully via `--no-block`.

---

## 8. Implementation Phases

### Phase 1: Secure Working Deploy (OOTB)

Everything needed for a working, secure deploy. No pre-built AMIs or images — works immediately after install.

**Items**: 1-17 from Section 7 (all changes above, including bug fixes 12-17).

**Result:**
- First bot: **~6 min** | Subsequent: **~3.5 min**
- Cost: **~$49/mo** for first bot ($7 shared NAT + $42 per bot). Subsequent bots: ~$42/mo each.
- Security: all critical controls at launch (see Section 3)
- OOTB: standard AWS AMIs, no pre-built resources

### Phase 2: Speed — Custom AMI + Pre-built Image

Eliminate runtime installations that run on every deploy.

- EC2 Image Builder pipeline: ECS-optimized AL2023 + Sysbox pre-installed → custom AMI
- Pre-built Docker image pushed to user's ECR: `node:22-slim` + `git` + `openclaw@latest` (Docker CLI not needed — OpenClaw uses Docker API via socket)
- Container command: `openclaw gateway --port {port}` (no apt-get/npm)
- UserData: 4 lines (ECS cluster config only, no Sysbox install)
- Triggered by a one-time `clawster optimize` command or during first deploy as a background task

**Result:**
- First bot: **~4.5 min** | Subsequent: **~2 min**
- Eliminates Docker Hub rate limit concern (images from user's ECR)

### Phase 3: Cost — Shared ALBs + Graviton

- Shared ALB with host-based routing (1 ALB for all bots in region)
- Graviton migration: t3.small (x86_64, $15/mo) → t4g.small (arm64, $12.26/mo, 18% cheaper)
  - Switch AMI SSM path from `/recommended/image_id` to `/arm64/recommended/image_id`
  - Switch Sysbox .deb from `linux_amd64.deb` to `linux_arm64.deb`
  - `node:22-slim` and `debian:bookworm-slim` (sandbox) both auto-select arm64 variant — no image changes needed
  - Chromium for web browsing sandbox: use Playwright arm64 builds (available since 2024)
- Light tier: t4g.micro for bots with <50 messages/day ($6.14/mo, 64 Mbps baseline)

**Result:** Per-bot cost drops from ~$42 to ~$17-20 (shared ALB eliminates $24/bot in ALB + IPv4 charges, Graviton saves ~$3/bot)

### Phase 4: Advanced

- **SDK parallel deploy**: Create VPC + IAM via SDK (instant, bypasses CF IAM InstanceProfile 2-3 min delay), run NAT creation + per-bot CF in parallel. First bot drops to **~3 min**.
- **Multi-AZ NAT**: NAT Instance per AZ for AZ failure resilience
- **Multi-bot per instance**: Pack 3-8 bots on larger instance
- **Spot instances**: 60-70% savings (user opt-in — Spot instances can be interrupted by AWS with 2 min notice, causing brief bot downtime while the instance recovers)
- **ASG warm pools**: Pre-initialized EC2 instances, service start drops to ~30-60s
- **GuardDuty Runtime Monitoring**: Container escape detection
