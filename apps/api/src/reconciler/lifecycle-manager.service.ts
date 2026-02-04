import * as path from "path";
import { Injectable, Inject, Logger } from "@nestjs/common";
import {
  BotInstance,
  BOT_INSTANCE_REPOSITORY,
  IBotInstanceRepository,
  PRISMA_CLIENT,
} from "@clawster/database";
import type { PrismaClient } from "@clawster/database";
import type { OpenClawManifest, OpenClawFullConfig } from "@clawster/core";
import {
  GatewayManager,
  GatewayClient,
} from "@clawster/gateway-client";
import type { GatewayConnectionOptions } from "@clawster/gateway-client";
import {
  DeploymentTargetFactory,
  DeploymentTargetType,
  AdapterRegistry,
} from "@clawster/cloud-providers";
import type {
  DeploymentTarget,
  DeploymentTargetConfig,
  TargetStatus,
  GatewayEndpoint,
  SelfDescribingDeploymentTarget,
} from "@clawster/cloud-providers";
import { ConfigGeneratorService } from "./config-generator.service";
import { ProvisioningEventsService } from "../provisioning/provisioning-events.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProvisionResult {
  success: boolean;
  message: string;
  gatewayHost?: string;
  gatewayPort?: number;
}

export interface UpdateResult {
  success: boolean;
  message: string;
  method: "apply" | "patch" | "none";
  configHash?: string;
}

export interface StatusResult {
  infraState: string;
  gatewayConnected: boolean;
  gatewayHealth?: { ok: boolean; uptime: number };
  configHash?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * LifecycleManagerService — orchestrates full instance lifecycle operations
 * (provision, update, restart, destroy) across deployment targets and the
 * OpenClaw Gateway WebSocket protocol.
 */
@Injectable()
export class LifecycleManagerService {
  private readonly logger = new Logger(LifecycleManagerService.name);
  private readonly gatewayManager = new GatewayManager();

  constructor(
    @Inject(BOT_INSTANCE_REPOSITORY) private readonly botInstanceRepo: IBotInstanceRepository,
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    private readonly configGenerator: ConfigGeneratorService,
    private readonly provisioningEvents: ProvisioningEventsService,
  ) {}

  // ------------------------------------------------------------------
  // Provision — full new instance setup
  // ------------------------------------------------------------------

  /**
   * Provision a brand-new OpenClaw instance:
   *  1. Resolve deployment target from DB or manifest
   *  2. Install OpenClaw via the deployment target
   *  3. Write configuration
   *  4. Start the service
   *  5. Establish gateway WS connection
   *  6. Update DB records (BotInstance, GatewayConnection, OpenClawProfile)
   */
  async provision(
    instance: BotInstance,
    manifest: OpenClawManifest,
  ): Promise<ProvisionResult> {
    this.logger.log(`Provisioning instance ${instance.id} (${instance.name})`);

    const deploymentType = this.resolveDeploymentType(instance);
    this.provisioningEvents.startProvisioning(instance.id, deploymentType);

    // Track the current step for log attribution
    let currentStepId = "validate_config";

    try {
      this.provisioningEvents.updateStep(instance.id, "validate_config", "in_progress");
      const target = await this.resolveTarget(instance);

      // Wire streaming log callback if the target supports it
      if (target.setLogCallback) {
        target.setLogCallback((line, stream) => {
          this.provisioningEvents.emitLog(instance.id, currentStepId, stream, line);
        });
      }

      // 2. Generate config
      const config = this.configGenerator.generateOpenClawConfig(manifest);
      const configHash = this.configGenerator.generateConfigHash(config);
      const profileName = instance.profileName ?? manifest.metadata.name;
      const gatewayPort = instance.gatewayPort ?? config.gateway?.port ?? 18789;
      this.provisioningEvents.updateStep(instance.id, "validate_config", "completed");
      currentStepId = "security_audit";
      this.provisioningEvents.updateStep(instance.id, "security_audit", "in_progress");
      this.provisioningEvents.updateStep(instance.id, "security_audit", "completed");
      // Extract container environment variables and auth token from instance metadata
      const instanceMeta = (typeof instance.metadata === "string" ? JSON.parse(instance.metadata) : instance.metadata) as Record<string, unknown> | null;
      const containerEnv = (instanceMeta?.containerEnv as Record<string, string>) || undefined;
      const gatewayAuthToken = (instanceMeta?.gatewayAuthToken as string) ?? undefined;

      const installStepId = this.getInstallStepId(deploymentType);
      currentStepId = installStepId;
      this.provisioningEvents.updateStep(instance.id, installStepId, "in_progress");
      const installResult = await target.install({
        profileName,
        openclawVersion: instance.openclawVersion ?? undefined,
        port: gatewayPort,
        gatewayAuthToken,
        containerEnv,
      });

      if (!installResult.success) {
        this.provisioningEvents.updateStep(instance.id, installStepId, "error", installResult.message);
        throw new Error(`Install failed: ${installResult.message}`);
      }
      this.provisioningEvents.updateStep(instance.id, installStepId, "completed");
      currentStepId = "create_container";
      this.provisioningEvents.updateStep(instance.id, "create_container", "in_progress");
      this.provisioningEvents.updateStep(instance.id, "create_container", "completed");
      currentStepId = "write_config";
      this.provisioningEvents.updateStep(instance.id, "write_config", "in_progress");

      const configureResult = await target.configure({
        profileName,
        gatewayPort,
        config: config as unknown as Record<string, unknown>,
        environment: containerEnv,
      });

      if (!configureResult.success) {
        this.provisioningEvents.updateStep(instance.id, "write_config", "error", configureResult.message);
        throw new Error(`Configure failed: ${configureResult.message}`);
      }
      this.provisioningEvents.updateStep(instance.id, "write_config", "completed");
      const startStepId = this.getStartStepId(deploymentType);
      currentStepId = startStepId;
      this.provisioningEvents.updateStep(instance.id, startStepId, "in_progress");
      await target.start();
      this.provisioningEvents.updateStep(instance.id, startStepId, "completed");

      // 6.
      currentStepId = "wait_for_gateway";
      this.provisioningEvents.updateStep(instance.id, "wait_for_gateway", "in_progress");
      const endpoint = await target.getEndpoint();
      const authToken = config.gateway?.auth?.token;
      const client = await this.connectGateway(instance.id, endpoint, authToken);
      this.provisioningEvents.updateStep(instance.id, "wait_for_gateway", "completed");

      currentStepId = "health_check";
      this.provisioningEvents.updateStep(instance.id, "health_check", "in_progress");
      const health = await client.health();
      this.provisioningEvents.updateStep(instance.id, "health_check", "completed");

      // 8. Update DB
      await this.botInstanceRepo.update(instance.id, {
        status: "RUNNING",
        runningSince: new Date(),
        health: health.ok ? "HEALTHY" : "DEGRADED",
        gatewayPort,
        profileName,
        configHash,
        lastReconcileAt: new Date(),
        lastHealthCheckAt: new Date(),
        lastError: null,
        errorCount: 0,
      });

      // Upsert GatewayConnection record (persist auth token for health poller)
      await this.upsertGatewayConnection(instance.id, endpoint, configHash, authToken);

      // Upsert OpenClawProfile record
      await this.upsertOpenClawProfile(instance.id, profileName, gatewayPort);
      this.provisioningEvents.completeProvisioning(instance.id);

      this.logger.log(`Instance ${instance.id} provisioned successfully`);

      return {
        success: true,
        message: `Provisioned and started on ${endpoint.host}:${endpoint.port}`,
        gatewayHost: endpoint.host,
        gatewayPort: endpoint.port,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Provision failed for ${instance.id}: ${message}`);
      this.provisioningEvents.failProvisioning(instance.id, message);

      await this.botInstanceRepo.update(instance.id, {
        status: "ERROR",
        runningSince: null,
        health: "UNKNOWN",
        lastError: message,
        errorCount: { increment: 1 },
      });

      return { success: false, message };
    }
  }

  // ------------------------------------------------------------------
  // Update — config change via Gateway WS
  // ------------------------------------------------------------------

  /**
   * Push an updated configuration to a running instance via the Gateway
   * WebSocket protocol.  If the config hash has not changed, this is a no-op.
   */
  async update(
    instance: BotInstance,
    manifest: OpenClawManifest,
  ): Promise<UpdateResult> {
    this.logger.log(`Updating config for instance ${instance.id}`);

    try {
      const config = this.configGenerator.generateOpenClawConfig(manifest);
      const desiredHash = this.configGenerator.generateConfigHash(config);

      // Fast-path: nothing to do if hashes match
      if (instance.configHash === desiredHash) {
        this.logger.debug(`Instance ${instance.id} config already up-to-date`);
        return { success: true, message: "Config already up-to-date", method: "none", configHash: desiredHash };
      }

      // Connect (or reuse) to gateway
      const client = await this.getGatewayClient(instance);

      // Get current remote config + hash
      const remote = await client.configGet();

      if (remote.hash === desiredHash) {
        // DB was stale — update local record and return
        await this.botInstanceRepo.update(instance.id, {
          configHash: desiredHash,
        });
        return { success: true, message: "Remote config already matches", method: "none", configHash: desiredHash };
      }

      // Full apply with the new config
      const raw = JSON.stringify(config);
      this.logger.debug(`config.apply sending ${raw.length} bytes (baseHash=${remote.hash?.slice(0, 12)})`);
      const applyResult = await client.configApply({
        raw,
        baseHash: remote.hash,
      });
      this.logger.debug(`config.apply response: ${JSON.stringify(applyResult)}`);

      // The gateway returns { ok: true } on success, not { success: true }
      const applied = applyResult.ok ?? applyResult.success;
      if (!applied) {
        const errors = applyResult.validationErrors?.join("; ") ?? "Unknown validation error";
        throw new Error(`config.apply rejected: ${errors}`);
      }

      // Persist config to the deployment target's backing store (e.g., Secrets
      // Manager for ECS, disk for Docker) so config survives restarts.
      try {
        const target = await this.resolveTarget(instance);
        const profileName = instance.profileName ?? manifest.metadata.name;
        const gatewayPort = instance.gatewayPort ?? (config as Record<string, unknown> & { gateway?: { port?: number } }).gateway?.port ?? 18789;
        await target.configure({
          profileName,
          gatewayPort,
          config: config as unknown as Record<string, unknown>,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to persist config to deployment target for ${instance.id}: ${msg}`);
        // Non-fatal: the gateway already has the new config in memory
      }

      // Persist new hash
      await this.botInstanceRepo.update(instance.id, {
        configHash: desiredHash,
        lastReconcileAt: new Date(),
        lastError: null,
      });

      // Update GatewayConnection hash
      await this.botInstanceRepo.upsertGatewayConnection(instance.id, {
        configHash: desiredHash,
      });

      this.logger.log(`Instance ${instance.id} config applied (hash=${desiredHash.slice(0, 12)})`);

      return { success: true, message: "Config applied via gateway", method: "apply", configHash: desiredHash };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Config update failed for ${instance.id}: ${message}`);

      await this.botInstanceRepo.update(instance.id, {
        lastError: message,
        errorCount: { increment: 1 },
      });

      return { success: false, message, method: "apply" };
    }
  }

  // ------------------------------------------------------------------
  // Restart — full restart via deployment target
  // ------------------------------------------------------------------

  async restart(instance: BotInstance): Promise<void> {
    this.logger.log(`Restarting instance ${instance.id}`);

    const target = await this.resolveTarget(instance);
    await target.restart();

    await this.botInstanceRepo.update(instance.id, {
      status: "RUNNING",
      runningSince: new Date(),
      restartCount: { increment: 1 },
      lastReconcileAt: new Date(),
    });
  }

  // ------------------------------------------------------------------
  // Hybrid reload — SIGUSR1 for config-only changes
  // ------------------------------------------------------------------

  /**
   * Trigger a lightweight reload on the OpenClaw process.
   * The deployment target sends SIGUSR1, which causes the gateway to
   * re-read its config from disk without a full process restart.
   */
  async hybridReload(instance: BotInstance): Promise<void> {
    this.logger.log(`Hybrid-reloading instance ${instance.id}`);

    try {
      // Attempt to restart via deployment target which may issue SIGUSR1
      const target = await this.resolveTarget(instance);
      await target.restart();

      await this.botInstanceRepo.update(instance.id, {
        lastReconcileAt: new Date(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Hybrid reload failed for ${instance.id}, falling back to WS apply: ${message}`);
      // Fallback is handled by the reconciler calling update() after this
    }
  }

  // ------------------------------------------------------------------
  // Destroy — teardown via deployment target
  // ------------------------------------------------------------------

  async destroy(instance: BotInstance): Promise<void> {
    this.logger.log(`Destroying instance ${instance.id}`);

    try {
      // Disconnect gateway client first
      this.gatewayManager.removeClient(instance.id);

      // Tear down via deployment target
      const target = await this.resolveTarget(instance);

      // Wire streaming log callback if the target supports it
      if (target.setLogCallback) {
        target.setLogCallback((line, stream) => {
          // Use a generic "destroy" step for log attribution
          this.provisioningEvents.emitLog(instance.id, "destroy", stream, line);
        });
      }

      await target.destroy();
    } catch (error) {
      this.logger.warn(`Deployment target teardown error for ${instance.id}: ${error}`);
      // Continue to clean up DB even if target teardown fails
    }

    // Clean up DB records
    await this.botInstanceRepo.deleteGatewayConnection(instance.id);
    await this.prisma.openClawProfile.deleteMany({
      where: { instanceId: instance.id },
    });
    await this.prisma.healthSnapshot.deleteMany({
      where: { instanceId: instance.id },
    });

    await this.botInstanceRepo.update(instance.id, {
      status: "DELETING",
      runningSince: null,
      health: "UNKNOWN",
    });
  }

  // ------------------------------------------------------------------
  // Status — combined infra + gateway status
  // ------------------------------------------------------------------

  async getStatus(instance: BotInstance): Promise<StatusResult> {
    const result: StatusResult = {
      infraState: "unknown",
      gatewayConnected: false,
    };

    // Infrastructure status
    try {
      const target = await this.resolveTarget(instance);
      const targetStatus = await target.getStatus();
      result.infraState = targetStatus.state;
    } catch {
      result.infraState = "error";
    }

    // Gateway WS status
    try {
      const client = await this.getGatewayClient(instance);
      result.gatewayConnected = true;

      const health = await client.health();
      result.gatewayHealth = { ok: health.ok, uptime: health.uptime };

      const status = await client.status();
      result.configHash = status.configHash;
    } catch {
      result.gatewayConnected = false;
    }

    return result;
  }

  // ------------------------------------------------------------------
  // Resource updates — CPU, memory, disk size changes
  // ------------------------------------------------------------------

  /**
   * Update resource allocation for a running instance.
   * Delegates to the deployment target's updateResources() method.
   */
  async updateResources(
    instance: BotInstance,
    spec: { cpu: number; memory: number; dataDiskSizeGb?: number },
  ): Promise<{ success: boolean; message: string; requiresRestart: boolean }> {
    this.logger.log(`Updating resources for instance ${instance.id}: cpu=${spec.cpu}, memory=${spec.memory}, disk=${spec.dataDiskSizeGb ?? "unchanged"}`);

    const deploymentType = this.resolveDeploymentType(instance);

    // Start resource update tracking with step progress
    this.provisioningEvents.startResourceUpdate(instance.id, deploymentType);

    // Track current step for log attribution
    let currentStepId = "validate_resources";

    try {
      this.provisioningEvents.updateStep(instance.id, "validate_resources", "in_progress");
      const target = await this.resolveTarget(instance);

      // Check if the target supports resource updates
      if (!target.updateResources) {
        this.provisioningEvents.updateStep(instance.id, "validate_resources", "error", `Deployment type "${instance.deploymentType}" does not support resource updates`);
        this.provisioningEvents.failProvisioning(instance.id, `Deployment target type "${instance.deploymentType}" does not support resource updates`);
        return {
          success: false,
          message: `Deployment target type "${instance.deploymentType}" does not support resource updates`,
          requiresRestart: false,
        };
      }

      // Wire streaming log callback if the target supports it
      if (target.setLogCallback) {
        target.setLogCallback((line, stream) => {
          this.provisioningEvents.emitLog(instance.id, currentStepId, stream, line);
        });
      }

      this.provisioningEvents.updateStep(instance.id, "validate_resources", "completed");

      // Step 2: Apply resource changes (universal step - logs show detailed provider progress)
      currentStepId = "apply_changes";
      this.provisioningEvents.updateStep(instance.id, "apply_changes", "in_progress");

      const result = await target.updateResources(spec);

      if (result.success) {
        this.provisioningEvents.updateStep(instance.id, "apply_changes", "completed");

        // Step 3: Verify completion
        currentStepId = "verify_completion";
        this.provisioningEvents.updateStep(instance.id, "verify_completion", "in_progress");
        this.provisioningEvents.updateStep(instance.id, "verify_completion", "completed");

        // Mark provisioning complete
        this.provisioningEvents.completeProvisioning(instance.id);
        this.logger.log(
          `Resource update completed for ${instance.id}: ${result.message}` +
            (result.requiresRestart ? ` (restart required, ~${result.estimatedDowntime}s downtime)` : "")
        );
      } else {
        this.provisioningEvents.updateStep(instance.id, "apply_changes", "error", result.message);
        this.provisioningEvents.failProvisioning(instance.id, result.message);
        this.logger.error(`Resource update failed for ${instance.id}: ${result.message}`);
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.provisioningEvents.failProvisioning(instance.id, message);
      this.logger.error(`Resource update failed for ${instance.id}: ${message}`);
      return {
        success: false,
        message,
        requiresRestart: false,
      };
    }
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  /**
   * Resolve the DeploymentTarget implementation for a given BotInstance.
   * Uses the DeploymentTarget DB record if present, otherwise falls back
   * to a `local` target.
   */
  private resolveDeploymentType(instance: BotInstance): string {
    const typeStr = instance.deploymentType ?? "LOCAL";
    const typeMap: Record<string, string> = { LOCAL: "local", DOCKER: "docker", ECS_EC2: "ecs-ec2", GCE: "gce", AZURE_VM: "azure-vm" };
    return typeMap[typeStr] ?? "docker";
  }

  /**
   * Get the install step ID from the adapter registry.
   */
  private getInstallStepId(deploymentType: string): string {
    const typeEnum = this.stringToDeploymentTargetType(deploymentType);
    if (!typeEnum) {
      throw new Error(`Unknown deployment type: ${deploymentType}`);
    }

    const stepId = AdapterRegistry.getInstance().getOperationStepId(typeEnum, "install");
    if (!stepId) {
      throw new Error(
        `No install step ID found for deployment type "${deploymentType}". ` +
        `Ensure the adapter's getMetadata() defines operationSteps.install.`
      );
    }

    return stepId;
  }

  /**
   * Get the start step ID from the adapter registry.
   */
  private getStartStepId(deploymentType: string): string {
    const typeEnum = this.stringToDeploymentTargetType(deploymentType);
    if (!typeEnum) {
      throw new Error(`Unknown deployment type: ${deploymentType}`);
    }

    const stepId = AdapterRegistry.getInstance().getOperationStepId(typeEnum, "start");
    if (!stepId) {
      throw new Error(
        `No start step ID found for deployment type "${deploymentType}". ` +
        `Ensure the adapter's getMetadata() defines operationSteps.start.`
      );
    }

    return stepId;
  }

  /**
   * Convert string deployment type to DeploymentTargetType enum.
   */
  private stringToDeploymentTargetType(type: string): DeploymentTargetType | undefined {
    const typeMap: Record<string, DeploymentTargetType> = {
      local: DeploymentTargetType.LOCAL,
      docker: DeploymentTargetType.DOCKER,
      "ecs-ec2": DeploymentTargetType.ECS_EC2,
      gce: DeploymentTargetType.GCE,
      "azure-vm": DeploymentTargetType.AZURE_VM,
    };
    return typeMap[type];
  }

  private async resolveTarget(instance: BotInstance): Promise<DeploymentTarget> {
    if (instance.deploymentTargetId) {
      const dbTarget = await this.prisma.deploymentTarget.findUnique({
        where: { id: instance.deploymentTargetId },
      });

      if (dbTarget) {
        const targetConfig = this.mapDbTargetToConfig(dbTarget, instance);
        return DeploymentTargetFactory.create(targetConfig);
      }
    }

    // Fallback: derive from deploymentType enum
    const typeStr = instance.deploymentType ?? "LOCAL";
    const instanceMeta = (typeof instance.metadata === "string" ? JSON.parse(instance.metadata) : instance.metadata) as Record<string, unknown> | null;
    const configMap: Record<string, DeploymentTargetConfig> = {
      LOCAL: { type: "local" },
      DOCKER: {
        type: "docker",
        docker: {
          containerName: `openclaw-${instance.name}`,
          imageName: "openclaw:local",
          dockerfilePath: path.join(__dirname, "../../../../../docker/openclaw"),
          configPath: `/var/openclaw/${instance.name}`,
          gatewayPort: instance.gatewayPort ?? 18789,
        },
      },
      ECS_EC2: {
        type: "ecs-ec2",
        ecs: {
          region: (instanceMeta?.region as string) ?? (instanceMeta?.awsRegion as string) ?? "us-east-1",
          accessKeyId: (instanceMeta?.accessKeyId as string) ?? (instanceMeta?.awsAccessKeyId as string) ?? "",
          secretAccessKey: (instanceMeta?.secretAccessKey as string) ?? (instanceMeta?.awsSecretAccessKey as string) ?? "",
          certificateArn: instanceMeta?.certificateArn as string | undefined,
          cpu: instanceMeta?.cpu as number | undefined,
          memory: instanceMeta?.memory as number | undefined,
          image: instanceMeta?.image as string | undefined,
          profileName: instance.profileName ?? instance.name,
        },
      },
      GCE: {
        type: "gce",
        gce: {
          projectId: (instanceMeta?.projectId as string) ?? (instanceMeta?.gcpProjectId as string) ?? "",
          zone: (instanceMeta?.zone as string) ?? (instanceMeta?.gcpZone as string) ?? "us-central1-a",
          keyFilePath: instanceMeta?.keyFilePath as string | undefined,
          machineType: instanceMeta?.machineType as string | undefined,
          image: instanceMeta?.image as string | undefined,
          profileName: instance.profileName ?? instance.name,
        },
      },
      AZURE_VM: {
        type: "azure-vm",
        azureVm: {
          subscriptionId: (instanceMeta?.subscriptionId as string) ?? (instanceMeta?.azureSubscriptionId as string) ?? "",
          resourceGroup: (instanceMeta?.resourceGroup as string) ?? (instanceMeta?.azureResourceGroup as string) ?? "",
          region: (instanceMeta?.region as string) ?? (instanceMeta?.azureRegion as string) ?? "eastus",
          clientId: instanceMeta?.clientId as string | undefined,
          clientSecret: instanceMeta?.clientSecret as string | undefined,
          tenantId: instanceMeta?.tenantId as string | undefined,
          keyVaultName: instanceMeta?.keyVaultName as string | undefined,
          logAnalyticsWorkspaceId: instanceMeta?.logAnalyticsWorkspaceId as string | undefined,
          logAnalyticsWorkspaceKey: instanceMeta?.logAnalyticsWorkspaceKey as string | undefined,
          vmSize: instanceMeta?.vmSize as string | undefined,
          image: instanceMeta?.image as string | undefined,
          profileName: instance.profileName ?? instance.name,
        },
      },
    };

    const config = configMap[typeStr] ?? { type: "local" as const };
    return DeploymentTargetFactory.create(config);
  }

  /**
   * Map a Prisma DeploymentTarget row to the typed config union that the
   * factory expects.
   */
  private mapDbTargetToConfig(
    dbTarget: { type: string; config: unknown },
    instance?: BotInstance,
  ): DeploymentTargetConfig {
    const cfg = (typeof dbTarget.config === "string" ? JSON.parse(dbTarget.config) : dbTarget.config ?? {}) as Record<string, unknown>;

    switch (dbTarget.type) {
      case "LOCAL":
        return { type: "local" };
      case "DOCKER":
        return {
          type: "docker",
          docker: {
            containerName: (cfg.containerName as string) ?? "openclaw",
            imageName: (cfg.imageName as string) ?? "openclaw:local",
            dockerfilePath: (cfg.dockerfilePath as string) ?? path.join(__dirname, "../../../../../docker/openclaw"),
            configPath: (cfg.configPath as string) ?? "/var/openclaw",
            gatewayPort: (cfg.gatewayPort as number) ?? 18789,
            networkName: cfg.networkName as string | undefined,
          },
        };
      case "ECS_EC2":
        return {
          type: "ecs-ec2",
          ecs: {
            region: (cfg.region as string) ?? "us-east-1",
            accessKeyId: (cfg.accessKeyId as string) ?? "",
            secretAccessKey: (cfg.secretAccessKey as string) ?? "",
            certificateArn: cfg.certificateArn as string | undefined,
            cpu: cfg.cpu as number | undefined,
            memory: cfg.memory as number | undefined,
            image: cfg.image as string | undefined,
            profileName: instance?.profileName ?? instance?.name,
          },
        };
      case "GCE":
        return {
          type: "gce",
          gce: {
            projectId: (cfg.projectId as string) ?? "",
            zone: (cfg.zone as string) ?? "us-central1-a",
            keyFilePath: cfg.keyFilePath as string | undefined,
            machineType: cfg.machineType as string | undefined,
            image: cfg.image as string | undefined,
            profileName: instance?.profileName ?? instance?.name,
          },
        };
      case "AZURE_VM":
        return {
          type: "azure-vm",
          azureVm: {
            subscriptionId: (cfg.subscriptionId as string) ?? "",
            resourceGroup: (cfg.resourceGroup as string) ?? "",
            region: (cfg.region as string) ?? "eastus",
            clientId: cfg.clientId as string | undefined,
            clientSecret: cfg.clientSecret as string | undefined,
            tenantId: cfg.tenantId as string | undefined,
            keyVaultName: cfg.keyVaultName as string | undefined,
            logAnalyticsWorkspaceId: cfg.logAnalyticsWorkspaceId as string | undefined,
            logAnalyticsWorkspaceKey: cfg.logAnalyticsWorkspaceKey as string | undefined,
            vmSize: cfg.vmSize as string | undefined,
            image: cfg.image as string | undefined,
            profileName: instance?.profileName ?? instance?.name,
          },
        };
      default:
        return { type: "local" };
    }
  }

  /**
   * Build GatewayConnectionOptions from a BotInstance + optional endpoint
   * override, then obtain a connected client from the GatewayManager pool.
   */
  private async getGatewayClient(instance: BotInstance): Promise<GatewayClient> {
    // Look up stored connection info
    const gwConn = await this.botInstanceRepo.getGatewayConnection(instance.id);

    const host = gwConn?.host ?? "localhost";
    const port = gwConn?.port ?? instance.gatewayPort ?? 18789;
    const token = gwConn?.authToken ?? undefined;

    const options: GatewayConnectionOptions = {
      host,
      port,
      auth: token ? { mode: "token", token } : { mode: "token", token: "clawster" },
    };

    return this.gatewayManager.getClient(instance.id, options);
  }

  private async connectGateway(
    instanceId: string,
    endpoint: GatewayEndpoint,
    authToken?: string,
  ): Promise<GatewayClient> {
    const options: GatewayConnectionOptions = {
      host: endpoint.host,
      port: endpoint.port,
      auth: { mode: "token", token: authToken ?? "" },
    };

    const maxAttempts = 30;
    const baseDelayMs = 5_000;
    const maxDelayMs = 15_000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const client = await this.gatewayManager.getClient(instanceId, options);
        return client;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        if (attempt === maxAttempts) {
          this.logger.error(
            `Gateway connection failed for ${instanceId} after ${maxAttempts} attempts: ${errMsg}`,
          );
          throw error;
        }
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
        this.logger.debug(
          `Gateway connection attempt ${attempt}/${maxAttempts} failed for ${instanceId}, retrying in ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Unreachable, but satisfies TypeScript
    throw new Error("Gateway connection failed");
  }

  private async upsertGatewayConnection(
    instanceId: string,
    endpoint: GatewayEndpoint,
    configHash: string,
    authToken?: string,
  ): Promise<void> {
    await this.botInstanceRepo.upsertGatewayConnection(instanceId, {
      host: endpoint.host,
      port: endpoint.port,
      status: "CONNECTED",
      configHash,
      lastHeartbeat: new Date(),
      ...(authToken ? { authToken } : {}),
    });
  }

  private async upsertOpenClawProfile(
    instanceId: string,
    profileName: string,
    basePort: number,
  ): Promise<void> {
    const configPath = `~/.openclaw/profiles/${profileName}/openclaw.json`;
    const stateDir = `~/.openclaw/profiles/${profileName}/state/`;
    const workspace = `~/openclaw/${profileName}/`;

    await this.prisma.openClawProfile.upsert({
      where: { instanceId },
      create: {
        instanceId,
        profileName,
        configPath,
        stateDir,
        workspace,
        basePort,
      },
      update: {
        profileName,
        configPath,
        stateDir,
        workspace,
        basePort,
      },
    });
  }
}
