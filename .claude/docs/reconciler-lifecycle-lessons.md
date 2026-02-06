---
description: "Hard-won lessons about bot reconciliation, instance lifecycle, and deployment target behavior"
globs: ["apps/api/src/reconciler/**/*.ts", "packages/cloud-providers/**/*.ts", "apps/api/src/onboarding/**/*.ts"]
alwaysApply: false
---

# Reconciler & Instance Lifecycle — Hard-Won Lessons

Last updated: 2026-02-06

## Bot Status Semantics — Do NOT Overload

- **CREATING**: Brand new, never provisioned. Full provision (infra + configure + start + connect).
- **PENDING**: Needs reconciliation. Reconciler checks `lastReconcileAt`/`configHash` to decide provision vs update.
- **RUNNING / DEGRADED**: Normal operational states. Drift detection runs on these.
- **RECONCILING**: Actively being reconciled. Stuck detector catches after 10 minutes.
- **ERROR**: Failed. User retries via "Reconcile" button.
- **STOPPED**: Intentionally stopped. Resume sets to PENDING.

**Critical**: To trigger re-reconciliation, set status to **PENDING**, NOT CREATING. `isNewInstance()` decides full provision vs update. Full provisioning on existing infra causes AlreadyExistsException.

## Deployment Target Differences

| Operation | Docker | ECS EC2 |
|-----------|--------|---------|
| **Provision** | Creates container (fast, idempotent) | CloudFormation stack (5-10 min) |
| **Config update** | Gateway WS `config.apply` + disk | `config.apply` + Secrets Manager |
| **Re-provision** | Replaces container (works) | Must update stack, not create |
| **Credentials** | None | AWS creds required; empty creds hang on IMDS |

**Always test reconciler changes against ALL deployment types.** ECS timeouts can exceed stuck detector threshold.

## Config Persistence Across Restarts

`config.apply` only writes to gateway memory + local disk. For external config stores (ECS → Secrets Manager), you MUST also persist to the backing store. Otherwise container restart reverts to old config.

## Self-Healing Requirements

Every reconciler error path must:
1. Record error in `lastError` on BotInstance
2. Set status to ERROR for dashboard visibility
3. Use timeouts — never hang indefinitely
4. Be retryable from the web dashboard (no terminal access needed)
