import { Injectable, Logger } from "@nestjs/common";
import type { ProvisioningEventsGateway } from "./provisioning-events.gateway";
import { AdapterRegistry, DeploymentTargetType } from "@clawster/cloud-providers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProvisioningStep {
  id: string;
  name: string;
  status: "pending" | "in_progress" | "completed" | "error" | "skipped";
  message?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface ProvisioningProgress {
  instanceId: string;
  status: "in_progress" | "completed" | "error" | "timeout";
  currentStep: string;
  steps: ProvisioningStep[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface ProvisioningLogEntry {
  instanceId: string;
  stepId: string;
  stream: "stdout" | "stderr";
  line: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const PROVISIONING_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_LOG_LINES = 500;

@Injectable()
export class ProvisioningEventsService {
  private readonly logger = new Logger(ProvisioningEventsService.name);
  private readonly progress = new Map<string, ProvisioningProgress>();
  private readonly logs = new Map<string, ProvisioningLogEntry[]>();
  private readonly timeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private gateway: ProvisioningEventsGateway | null = null;

  setGateway(gateway: ProvisioningEventsGateway): void {
    this.gateway = gateway;
  }

  startProvisioning(instanceId: string, deploymentType: string): void {
    // Get steps from the adapter registry
    const registrySteps = this.getRegistryProvisioningSteps(deploymentType);

    if (registrySteps.length === 0) {
      throw new Error(
        `No provisioning steps found for deployment type "${deploymentType}". ` +
        `Ensure the adapter is registered with the AdapterRegistry.`
      );
    }

    const steps: ProvisioningStep[] = registrySteps.map((step) => ({
      id: step.id,
      name: step.name,
      status: "pending" as const,
    }));

    const progress: ProvisioningProgress = {
      instanceId,
      status: "in_progress",
      currentStep: steps[0]?.id ?? "",
      steps,
      startedAt: new Date().toISOString(),
    };

    this.progress.set(instanceId, progress);
    this.emit(instanceId, progress);

    const timeout = setTimeout(() => {
      this.timeoutProvisioning(instanceId);
    }, PROVISIONING_TIMEOUT_MS);
    this.timeouts.set(instanceId, timeout);

    this.logger.log(
      `Provisioning started for ${instanceId} (${deploymentType}, ${steps.length} steps)`,
    );
  }

  /**
   * Start tracking a resource update operation.
   * Uses steps from the adapter registry. Falls back to universal steps
   * if the adapter doesn't define resource update steps.
   */
  startResourceUpdate(instanceId: string, deploymentType: string): void {
    // Get resource update steps from the adapter registry
    const registrySteps = this.getRegistryResourceUpdateSteps(deploymentType);

    // Use registry steps, or universal steps if adapter doesn't define them
    const steps: ProvisioningStep[] = registrySteps.length > 0
      ? registrySteps.map((step) => ({
          id: step.id,
          name: step.name,
          status: "pending" as const,
        }))
      : [
          { id: "validate_resources", name: "Validate resource configuration", status: "pending" as const },
          { id: "apply_changes", name: "Apply resource changes", status: "pending" as const },
          { id: "verify_completion", name: "Verify completion", status: "pending" as const },
        ];

    const progress: ProvisioningProgress = {
      instanceId,
      status: "in_progress",
      currentStep: steps[0]?.id ?? "",
      steps,
      startedAt: new Date().toISOString(),
    };

    this.progress.set(instanceId, progress);
    this.emit(instanceId, progress);

    const timeout = setTimeout(() => {
      this.timeoutProvisioning(instanceId);
    }, PROVISIONING_TIMEOUT_MS);
    this.timeouts.set(instanceId, timeout);

    this.logger.log(
      `Resource update started for ${instanceId} (${deploymentType}, ${steps.length} steps)`,
    );
  }

  updateStep(
    instanceId: string,
    stepId: string,
    status: ProvisioningStep["status"],
    message?: string,
  ): void {
    const progress = this.progress.get(instanceId);
    if (!progress) return;

    const step = progress.steps.find((s) => s.id === stepId);
    if (!step) return;

    const now = new Date().toISOString();
    step.status = status;
    if (message) step.message = message;

    if (status === "in_progress" && !step.startedAt) {
      step.startedAt = now;
    }
    if (status === "completed" || status === "error" || status === "skipped") {
      step.completedAt = now;
    }
    if (status === "error" && message) {
      step.error = message;
    }

    if (status === "in_progress") {
      progress.currentStep = stepId;
    } else if (status === "completed") {
      const nextPending = progress.steps.find((s) => s.status === "pending");
      if (nextPending) {
        progress.currentStep = nextPending.id;
      }
    }

    this.emit(instanceId, progress);
  }

  completeProvisioning(instanceId: string): void {
    const progress = this.progress.get(instanceId);
    if (!progress) return;

    progress.status = "completed";
    progress.completedAt = new Date().toISOString();

    for (const step of progress.steps) {
      if (step.status === "pending") {
        step.status = "skipped";
      }
    }

    this.clearTimeout(instanceId);
    this.emit(instanceId, progress);
    this.logger.log(`Provisioning completed for ${instanceId}`);

    setTimeout(() => {
      this.progress.delete(instanceId);
      this.logs.delete(instanceId);
    }, 60_000);
  }

  failProvisioning(instanceId: string, error: string): void {
    const progress = this.progress.get(instanceId);
    if (!progress) return;

    progress.status = "error";
    progress.error = error;
    progress.completedAt = new Date().toISOString();

    for (const step of progress.steps) {
      if (step.status === "in_progress") {
        step.status = "error";
        step.error = error;
        step.completedAt = new Date().toISOString();
      }
    }

    this.clearTimeout(instanceId);
    this.emit(instanceId, progress);
    this.logger.warn(`Provisioning failed for ${instanceId}: ${error}`);

    setTimeout(() => {
      this.progress.delete(instanceId);
      this.logs.delete(instanceId);
    }, 5 * 60_000);
  }

  emitLog(
    instanceId: string,
    stepId: string,
    stream: "stdout" | "stderr",
    line: string,
  ): void {
    const entry: ProvisioningLogEntry = {
      instanceId,
      stepId,
      stream,
      line,
      timestamp: new Date().toISOString(),
    };

    let buffer = this.logs.get(instanceId);
    if (!buffer) {
      buffer = [];
      this.logs.set(instanceId, buffer);
    }
    buffer.push(entry);
    if (buffer.length > MAX_LOG_LINES) {
      buffer.splice(0, buffer.length - MAX_LOG_LINES);
    }

    this.gateway?.emitLog(instanceId, entry);
  }

  getRecentLogs(instanceId: string): ProvisioningLogEntry[] {
    return this.logs.get(instanceId) ?? [];
  }

  getProgress(instanceId: string): ProvisioningProgress | null {
    return this.progress.get(instanceId) ?? null;
  }

  // ---- Private ----

  private timeoutProvisioning(instanceId: string): void {
    const progress = this.progress.get(instanceId);
    if (!progress || progress.status !== "in_progress") return;

    progress.status = "timeout";
    progress.error = "Provisioning timed out after 5 minutes";
    progress.completedAt = new Date().toISOString();

    this.emit(instanceId, progress);
    this.logger.warn(`Provisioning timed out for ${instanceId}`);

    setTimeout(() => {
      this.progress.delete(instanceId);
      this.logs.delete(instanceId);
    }, 5 * 60_000);
  }

  private clearTimeout(instanceId: string): void {
    const timeout = this.timeouts.get(instanceId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(instanceId);
    }
  }

  private emit(instanceId: string, progress: ProvisioningProgress): void {
    if (this.gateway) {
      this.gateway.emitProgress(instanceId, progress);
    }
  }

  // ---- Registry helpers ----

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

  /**
   * Get provisioning steps from the adapter registry.
   */
  private getRegistryProvisioningSteps(deploymentType: string): Array<{ id: string; name: string }> {
    const typeEnum = this.stringToDeploymentTargetType(deploymentType);
    if (!typeEnum) return [];

    const registry = AdapterRegistry.getInstance();
    const steps = registry.getProvisioningSteps(typeEnum);
    return steps.map((step) => ({ id: step.id, name: step.name }));
  }

  /**
   * Get resource update steps from the adapter registry.
   */
  private getRegistryResourceUpdateSteps(deploymentType: string): Array<{ id: string; name: string }> {
    const typeEnum = this.stringToDeploymentTargetType(deploymentType);
    if (!typeEnum) return [];

    const registry = AdapterRegistry.getInstance();
    const steps = registry.getResourceUpdateSteps(typeEnum);
    return steps.map((step) => ({ id: step.id, name: step.name }));
  }
}
