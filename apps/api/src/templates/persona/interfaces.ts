import type { IdentityConfig, CronJobTemplate } from "@clawster/core";

// =============================================================================
// Config Injector Interface
// =============================================================================

export interface IConfigInjector {
  /**
   * Get the current config and its hash from a bot instance via Gateway RPC.
   */
  getConfig(instanceId: string): Promise<ConfigSnapshot>;

  /**
   * Apply a config patch to a bot instance via Gateway RPC.
   * Uses optimistic locking via baseHash.
   */
  applyPatch(
    instanceId: string,
    patch: Record<string, unknown>,
    baseHash: string,
  ): Promise<void>;

  /**
   * Inject identity configuration into a bot instance.
   * Maps to agents.list[].identity in OpenClaw config.
   */
  injectIdentity(instanceId: string, identity: IdentityConfig): Promise<void>;
}

export interface ConfigSnapshot {
  config: Record<string, unknown>;
  hash: string;
}

export const CONFIG_INJECTOR = Symbol("CONFIG_INJECTOR");

// =============================================================================
// Cron Injector Interface
// =============================================================================

export interface ICronInjector {
  /**
   * Add a cron job to a bot instance via Gateway RPC.
   * Returns the created job ID.
   */
  addJob(instanceId: string, job: CronJobTemplate): Promise<string>;

  /**
   * Remove a cron job from a bot instance via Gateway RPC.
   */
  removeJob(instanceId: string, jobId: string): Promise<void>;

  /**
   * List all cron jobs for a bot instance via Gateway RPC.
   */
  listJobs(instanceId: string): Promise<CronJobInfo[]>;
}

export interface CronJobInfo {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string;
  nextRunAt?: Date;
  lastRunAt?: Date;
  lastStatus?: "ok" | "error" | "skipped";
}

export const CRON_INJECTOR = Symbol("CRON_INJECTOR");

// =============================================================================
// Secret Resolver Interface
// =============================================================================

export interface ISecretResolver {
  /**
   * Resolve a secret reference to its value or environment variable reference.
   * For local deployment: returns `${ENV_VAR_NAME}` format
   * For cloud deployment: returns provider-specific reference format
   */
  resolveSecretRef(
    secretKey: string,
    secretValue: string,
    deploymentType: string,
  ): Promise<string>;

  /**
   * Store a secret in the appropriate secret store for the deployment type.
   * For local: no-op (user must set env vars)
   * For AWS: stores in Secrets Manager
   */
  storeSecret(
    instanceId: string,
    secretKey: string,
    secretValue: string,
    deploymentType: string,
  ): Promise<void>;
}

export const SECRET_RESOLVER = Symbol("SECRET_RESOLVER");
