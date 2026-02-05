/**
 * GCP Compute Service (Facade)
 *
 * Provides a unified interface for GCP Compute Engine operations.
 * Delegates to specialized sub-services following SOLID principles.
 */

import {
  InstancesClient,
  DisksClient,
} from "@google-cloud/compute";
import type { IComputeService } from "@clawster/adapters-common";
import type { InstanceConfig, InstanceResult, InstanceStatus } from "@clawster/adapters-common/dist/types/compute";

import { VmLifecycleService, VmInstanceConfig } from "./services/vm-lifecycle-service";
import { VmStatusService, VmStatus } from "./services/vm-status-service";
import { DiskService } from "./services/disk-service";
import { waitForZoneOperation } from "../utils/operation-utils";

// Re-export types for backward compatibility
export type { VmInstanceConfig, VmStatus };

export interface ComputeServiceConfig {
  projectId: string;
  zone: string;
  keyFilename?: string;
  credentials?: {
    client_email: string;
    private_key: string;
  };
}

/**
 * GCP Compute Service (Facade) for VM and Disk operations.
 * Implements IComputeService interface.
 */
export class ComputeService implements IComputeService {
  private readonly lifecycleService: VmLifecycleService;
  private readonly statusService: VmStatusService;
  private readonly diskService: DiskService;
  private readonly instancesClient: InstancesClient;
  private readonly projectId: string;
  private readonly zone: string;

  constructor(config: ComputeServiceConfig) {
    const clientOptions: { projectId: string; keyFilename?: string; credentials?: { client_email: string; private_key: string } } = {
      projectId: config.projectId,
    };

    if (config.keyFilename) {
      clientOptions.keyFilename = config.keyFilename;
    } else if (config.credentials) {
      clientOptions.credentials = config.credentials;
    }

    this.instancesClient = new InstancesClient(clientOptions);
    const disksClient = new DisksClient(clientOptions);
    this.projectId = config.projectId;
    this.zone = config.zone;

    this.lifecycleService = new VmLifecycleService(this.instancesClient, config.projectId, config.zone);
    this.statusService = new VmStatusService(this.instancesClient, config.projectId, config.zone);
    this.diskService = new DiskService(disksClient, config.projectId, config.zone);
  }

  /**
   * Create with pre-constructed sub-services (for testing/DI).
   */
  static fromServices(
    lifecycleService: VmLifecycleService,
    statusService: VmStatusService,
    diskService: DiskService,
    instancesClient: InstancesClient,
    projectId: string,
    zone: string
  ): ComputeService {
    const instance = Object.create(ComputeService.prototype);
    instance.lifecycleService = lifecycleService;
    instance.statusService = statusService;
    instance.diskService = diskService;
    instance.instancesClient = instancesClient;
    instance.projectId = projectId;
    instance.zone = zone;
    return instance;
  }

  // ------------------------------------------------------------------
  // IInstanceLifecycle implementation (delegated to VmLifecycleService)
  // ------------------------------------------------------------------

  async createInstance(name: string, config: InstanceConfig): Promise<InstanceResult> {
    return this.lifecycleService.createInstance(name, config);
  }

  async deleteInstance(name: string): Promise<void> {
    return this.lifecycleService.deleteInstance(name);
  }

  async startInstance(name: string): Promise<void> {
    return this.lifecycleService.startInstance(name);
  }

  async stopInstance(name: string): Promise<void> {
    return this.lifecycleService.stopInstance(name);
  }

  async restartInstance(name: string): Promise<void> {
    return this.lifecycleService.restartInstance(name);
  }

  // ------------------------------------------------------------------
  // IInstanceStatusProvider implementation (delegated to VmStatusService)
  // ------------------------------------------------------------------

  async getInstanceStatus(name: string): Promise<InstanceStatus> {
    return this.statusService.getInstanceStatus(name);
  }

  // ------------------------------------------------------------------
  // IInstanceCommandExecutor implementation
  // ------------------------------------------------------------------

  /**
   * Run commands on a compute instance.
   * Uses GCP metadata startup-script mechanism.
   */
  async runCommand(name: string, commands: string[]): Promise<string> {
    const command = commands.join("\n");

    const [instance] = await this.instancesClient.get({
      project: this.projectId,
      zone: this.zone,
      instance: name,
    });

    const currentItems = instance.metadata?.items ?? [];
    const newItems = currentItems.filter((item) => item.key !== "startup-script");
    newItems.push({ key: "startup-script", value: command });

    const [operation] = await this.instancesClient.setMetadata({
      project: this.projectId,
      zone: this.zone,
      instance: name,
      metadataResource: {
        fingerprint: instance.metadata?.fingerprint,
        items: newItems,
      },
    });

    await waitForZoneOperation(this.projectId, this.zone, operation.latestResponse?.name);

    // GCP doesn't return command output directly through metadata
    // The output would be in Cloud Logging
    return "";
  }

  // ------------------------------------------------------------------
  // GCP-specific methods (for backward compatibility)
  // ------------------------------------------------------------------

  /**
   * Create a new VM instance with GCP-specific configuration.
   *
   * @param config - VM instance configuration
   * @returns Instance self-link URL
   */
  async createVmInstance(config: VmInstanceConfig): Promise<string> {
    return this.lifecycleService.createVmInstance(config);
  }

  /**
   * Get detailed information about a VM instance.
   *
   * @param name - Instance name
   * @returns VM status and metadata, or null if not found
   */
  async getInstance(name: string): Promise<VmStatus | null> {
    return this.statusService.getInstance(name);
  }

  /**
   * Reset (restart) a VM instance.
   *
   * @param name - Instance name
   */
  async resetInstance(name: string): Promise<void> {
    return this.lifecycleService.resetInstance(name);
  }

  /**
   * Update VM instance metadata.
   *
   * @param name - Instance name
   * @param metadata - Key-value pairs to update
   */
  async updateMetadata(name: string, metadata: Record<string, string>): Promise<void> {
    const [instance] = await this.instancesClient.get({
      project: this.projectId,
      zone: this.zone,
      instance: name,
    });

    const currentItems = instance.metadata?.items ?? [];
    const metadataKeys = Object.keys(metadata);
    const newItems = currentItems.filter((item) => item.key && !metadataKeys.includes(item.key));

    for (const [key, value] of Object.entries(metadata)) {
      newItems.push({ key, value });
    }

    const [operation] = await this.instancesClient.setMetadata({
      project: this.projectId,
      zone: this.zone,
      instance: name,
      metadataResource: {
        fingerprint: instance.metadata?.fingerprint,
        items: newItems,
      },
    });

    await waitForZoneOperation(this.projectId, this.zone, operation.latestResponse?.name);
  }

  // ------------------------------------------------------------------
  // Disk Operations (delegated to DiskService)
  // ------------------------------------------------------------------

  async ensureDataDisk(name: string, sizeGb: number, diskType: string = "pd-standard"): Promise<void> {
    return this.diskService.ensureDataDisk(name, sizeGb, diskType);
  }

  async deleteDisk(name: string): Promise<void> {
    return this.diskService.deleteDisk(name);
  }
}
