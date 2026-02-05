/**
 * Azure Compute Service (Facade)
 *
 * Provides a unified interface for Azure compute operations.
 * Delegates to specialized sub-services following SOLID principles.
 */

import { ComputeManagementClient, VirtualMachine, Disk } from "@azure/arm-compute";
import { NetworkManagementClient, NetworkInterface } from "@azure/arm-network";
import { DefaultAzureCredential, TokenCredential } from "@azure/identity";
import type { IComputeService } from "@clawster/adapters-common";
import type { InstanceConfig, InstanceResult, InstanceStatus } from "@clawster/adapters-common/dist/types/compute";

import { VmService, VmStatus, CreateVmOptions } from "./services/vm-service";
import { NicService } from "./services/nic-service";
import { DiskService } from "./services/disk-service";

// Re-export types for backward compatibility
export type { VmStatus, CreateVmOptions };

/**
 * Azure Compute Service (Facade) for VM, Disk, and NIC operations.
 * Implements IComputeService interface.
 * Delegates to specialized sub-services for each concern.
 */
export class ComputeService implements IComputeService {
  private readonly vmService: VmService;
  private readonly nicService: NicService;
  private readonly diskService: DiskService;

  /**
   * Create a new ComputeService instance.
   *
   * @param subscriptionId - Azure subscription ID
   * @param resourceGroup - Resource group name
   * @param location - Azure region (e.g., "eastus")
   * @param credential - Optional TokenCredential (defaults to DefaultAzureCredential)
   */
  constructor(
    subscriptionId: string,
    resourceGroup: string,
    location: string,
    credential?: TokenCredential
  ) {
    const cred = credential || new DefaultAzureCredential();
    const computeClient = new ComputeManagementClient(cred, subscriptionId);
    const networkClient = new NetworkManagementClient(cred, subscriptionId);

    this.vmService = new VmService(computeClient, resourceGroup, location);
    this.nicService = new NicService(networkClient, resourceGroup, location);
    this.diskService = new DiskService(computeClient, resourceGroup, location);
  }

  /**
   * Create with pre-constructed sub-services (for testing/DI).
   */
  static fromServices(
    vmService: VmService,
    nicService: NicService,
    diskService: DiskService
  ): ComputeService {
    const instance = Object.create(ComputeService.prototype);
    instance.vmService = vmService;
    instance.nicService = nicService;
    instance.diskService = diskService;
    return instance;
  }

  // ------------------------------------------------------------------
  // IComputeService implementation (IInstanceLifecycle + IInstanceStatusProvider + IInstanceCommandExecutor)
  // ------------------------------------------------------------------

  /**
   * Create a new compute instance.
   * Implements IInstanceLifecycle.createInstance.
   */
  async createInstance(name: string, config: InstanceConfig): Promise<InstanceResult> {
    return this.vmService.createInstance(name, config);
  }

  /**
   * Delete a compute instance.
   * Implements IInstanceLifecycle.deleteInstance.
   */
  async deleteInstance(name: string): Promise<void> {
    return this.vmService.deleteInstance(name);
  }

  /**
   * Start a stopped compute instance.
   * Implements IInstanceLifecycle.startInstance.
   */
  async startInstance(name: string): Promise<void> {
    return this.vmService.startInstance(name);
  }

  /**
   * Stop a running compute instance.
   * Implements IInstanceLifecycle.stopInstance.
   */
  async stopInstance(name: string): Promise<void> {
    return this.vmService.stopInstance(name);
  }

  /**
   * Restart a compute instance.
   * Implements IInstanceLifecycle.restartInstance.
   */
  async restartInstance(name: string): Promise<void> {
    return this.vmService.restartInstance(name);
  }

  /**
   * Get the current status of a compute instance.
   * Implements IInstanceStatusProvider.getInstanceStatus.
   */
  async getInstanceStatus(name: string): Promise<InstanceStatus> {
    const status = await this.vmService.getVmStatus(name);
    return this.mapVmStatusToInstanceStatus(status);
  }

  /**
   * Run commands on a compute instance.
   * Implements IInstanceCommandExecutor.runCommand.
   */
  async runCommand(name: string, commands: string[]): Promise<string> {
    return this.vmService.runCommand(name, commands);
  }

  // ------------------------------------------------------------------
  // Azure-specific VM Operations (backward compatibility)
  // ------------------------------------------------------------------

  async createVm(options: CreateVmOptions): Promise<VirtualMachine> {
    return this.vmService.createVm(options);
  }

  async deleteVm(name: string): Promise<void> {
    return this.vmService.deleteVm(name);
  }

  async startVm(name: string): Promise<void> {
    return this.vmService.startVm(name);
  }

  async stopVm(name: string): Promise<void> {
    return this.vmService.stopVm(name);
  }

  async restartVm(name: string): Promise<void> {
    return this.vmService.restartVm(name);
  }

  async getVmStatus(name: string): Promise<VmStatus> {
    return this.vmService.getVmStatus(name);
  }

  async resizeVm(name: string, size: string): Promise<void> {
    return this.vmService.resizeVm(name, size);
  }

  async getVm(name: string): Promise<VirtualMachine | undefined> {
    return this.vmService.getVm(name);
  }

  // ------------------------------------------------------------------
  // NIC Operations (delegated to NicService)
  // ------------------------------------------------------------------

  async createNic(
    name: string,
    subnetId: string,
    publicIpId?: string
  ): Promise<NetworkInterface> {
    return this.nicService.createNic(name, subnetId, publicIpId);
  }

  async deleteNic(name: string): Promise<void> {
    return this.nicService.deleteNic(name);
  }

  async getVmPrivateIp(nicName: string): Promise<string | undefined> {
    return this.nicService.getVmPrivateIp(nicName);
  }

  // ------------------------------------------------------------------
  // Disk Operations (delegated to DiskService)
  // ------------------------------------------------------------------

  async createDataDisk(
    name: string,
    sizeGb: number,
    sku: string = "Standard_LRS"
  ): Promise<Disk> {
    return this.diskService.createDataDisk(name, sizeGb, sku);
  }

  async deleteDisk(name: string): Promise<void> {
    return this.diskService.deleteDisk(name);
  }

  async resizeDisk(name: string, sizeGb: number): Promise<void> {
    return this.diskService.resizeDisk(name, sizeGb);
  }

  async getDisk(name: string): Promise<Disk | undefined> {
    return this.diskService.getDisk(name);
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  /**
   * Map Azure VM status to common InstanceStatus.
   */
  private mapVmStatusToInstanceStatus(status: VmStatus): InstanceStatus {
    switch (status) {
      case "running":
        return "running";
      case "stopped":
      case "deallocated":
        return "stopped";
      case "starting":
        return "starting";
      case "stopping":
        return "stopping";
      default:
        return "unknown";
    }
  }
}
