/**
 * Azure VM Service
 *
 * Handles Virtual Machine lifecycle operations.
 * Part of the ISP-compliant compute service split.
 */

import {
  ComputeManagementClient,
  VirtualMachine,
  RunCommandResult,
} from "@azure/arm-compute";
import type { IInstanceLifecycle } from "@clawster/adapters-common";
import type { InstanceConfig, InstanceResult, InstanceStatus } from "@clawster/adapters-common/dist/types/compute";

/**
 * VM power state values.
 */
export type VmStatus =
  | "running"
  | "stopped"
  | "deallocated"
  | "starting"
  | "stopping"
  | "unknown";

/**
 * Options for creating a VM.
 */
export interface CreateVmOptions {
  /** VM name */
  vmName: string;
  /** NIC resource ID */
  nicId: string;
  /** Data disk resource ID */
  diskId: string;
  /** VM size (e.g., "Standard_B2s") */
  vmSize: string;
  /** OS disk size in GB */
  osDiskSizeGb: number;
  /** Cloud-init script content */
  cloudInit: string;
  /** SSH public key for authentication */
  sshPublicKey?: string;
  /** Additional resource tags */
  tags?: Record<string, string>;
  /** Admin username (default: "clawster") */
  adminUsername?: string;
  /** Image publisher (default: "Canonical") */
  imagePublisher?: string;
  /** Image offer (default: "ubuntu-24_04-lts") */
  imageOffer?: string;
  /** Image SKU (default: "server") */
  imageSku?: string;
}

/**
 * Azure VM Service for virtual machine operations.
 * Implements IInstanceLifecycle interface.
 */
export class VmService implements IInstanceLifecycle {
  constructor(
    private readonly computeClient: ComputeManagementClient,
    private readonly resourceGroup: string,
    private readonly location: string
  ) {}

  // ------------------------------------------------------------------
  // IInstanceLifecycle implementation
  // ------------------------------------------------------------------

  /**
   * Create a new compute instance.
   * Implements IInstanceLifecycle.createInstance.
   */
  async createInstance(name: string, config: InstanceConfig): Promise<InstanceResult> {
    const vm = await this.computeClient.virtualMachines.beginCreateOrUpdateAndWait(
      this.resourceGroup,
      name,
      {
        location: this.location,
        hardwareProfile: {
          vmSize: config.machineType,
        },
        storageProfile: {
          imageReference: this.parseImageReference(config.image),
          osDisk: {
            createOption: "FromImage",
            diskSizeGB: config.storage?.rootDiskSizeGb ?? 30,
            managedDisk: {
              storageAccountType: config.storage?.rootDiskType ?? "Standard_LRS",
            },
            name: `${name}-osdisk`,
          },
        },
        osProfile: {
          computerName: name,
          adminUsername: "clawster",
          customData: config.userData ? Buffer.from(config.userData).toString("base64") : undefined,
          linuxConfiguration: config.sshPublicKey
            ? {
                disablePasswordAuthentication: true,
                ssh: {
                  publicKeys: [
                    {
                      path: "/home/clawster/.ssh/authorized_keys",
                      keyData: config.sshPublicKey,
                    },
                  ],
                },
              }
            : undefined,
        },
        networkProfile: {
          networkInterfaces: config.network?.subnetId
            ? [{ id: config.network.subnetId, primary: true }]
            : [],
        },
        tags: {
          managedBy: "clawster",
          ...config.tags,
        },
      }
    );

    const status = await this.getVmStatus(name);

    return {
      instanceId: vm.vmId ?? name,
      name,
      privateIp: undefined, // Would need NIC lookup
      publicIp: undefined, // Would need public IP lookup
      resourceId: vm.id,
      status: this.mapVmStatusToInstanceStatus(status),
    };
  }

  /**
   * Delete a compute instance.
   * Implements IInstanceLifecycle.deleteInstance.
   */
  async deleteInstance(name: string): Promise<void> {
    return this.deleteVm(name);
  }

  /**
   * Start a stopped compute instance.
   * Implements IInstanceLifecycle.startInstance.
   */
  async startInstance(name: string): Promise<void> {
    return this.startVm(name);
  }

  /**
   * Stop a running compute instance.
   * Implements IInstanceLifecycle.stopInstance.
   */
  async stopInstance(name: string): Promise<void> {
    return this.stopVm(name);
  }

  /**
   * Restart a compute instance.
   * Implements IInstanceLifecycle.restartInstance.
   */
  async restartInstance(name: string): Promise<void> {
    return this.restartVm(name);
  }

  // ------------------------------------------------------------------
  // Azure-specific methods (backward compatibility)
  // ------------------------------------------------------------------

  /**
   * Create a VM instance.
   *
   * @param options - VM creation options
   * @returns Created VM resource
   */
  async createVm(options: CreateVmOptions): Promise<VirtualMachine> {
    const {
      vmName,
      nicId,
      diskId,
      vmSize,
      osDiskSizeGb,
      cloudInit,
      sshPublicKey,
      tags,
      adminUsername = "clawster",
      imagePublisher = "Canonical",
      imageOffer = "ubuntu-24_04-lts",
      imageSku = "server",
    } = options;

    const result = await this.computeClient.virtualMachines.beginCreateOrUpdateAndWait(
      this.resourceGroup,
      vmName,
      {
        location: this.location,
        hardwareProfile: {
          vmSize,
        },
        storageProfile: {
          imageReference: {
            publisher: imagePublisher,
            offer: imageOffer,
            sku: imageSku,
            version: "latest",
          },
          osDisk: {
            createOption: "FromImage",
            diskSizeGB: osDiskSizeGb,
            managedDisk: {
              storageAccountType: "Standard_LRS",
            },
            name: `${vmName}-osdisk`,
          },
          dataDisks: [
            {
              lun: 0,
              createOption: "Attach",
              managedDisk: {
                id: diskId,
              },
            },
          ],
        },
        osProfile: {
          computerName: vmName,
          adminUsername,
          customData: Buffer.from(cloudInit).toString("base64"),
          linuxConfiguration: {
            disablePasswordAuthentication: true,
            ssh: sshPublicKey
              ? {
                  publicKeys: [
                    {
                      path: `/home/${adminUsername}/.ssh/authorized_keys`,
                      keyData: sshPublicKey,
                    },
                  ],
                }
              : undefined,
          },
        },
        networkProfile: {
          networkInterfaces: [
            {
              id: nicId,
              primary: true,
            },
          ],
        },
        tags: {
          managedBy: "clawster",
          ...tags,
        },
      }
    );

    return result;
  }

  /**
   * Delete a VM.
   *
   * @param name - VM name
   */
  async deleteVm(name: string): Promise<void> {
    try {
      await this.computeClient.virtualMachines.beginDeleteAndWait(
        this.resourceGroup,
        name
      );
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        return;
      }
      throw error;
    }
  }

  /**
   * Start a VM.
   *
   * @param name - VM name
   */
  async startVm(name: string): Promise<void> {
    await this.computeClient.virtualMachines.beginStartAndWait(
      this.resourceGroup,
      name
    );
  }

  /**
   * Stop (deallocate) a VM.
   *
   * @param name - VM name
   */
  async stopVm(name: string): Promise<void> {
    await this.computeClient.virtualMachines.beginDeallocateAndWait(
      this.resourceGroup,
      name
    );
  }

  /**
   * Restart a VM.
   *
   * @param name - VM name
   */
  async restartVm(name: string): Promise<void> {
    await this.computeClient.virtualMachines.beginRestartAndWait(
      this.resourceGroup,
      name
    );
  }

  /**
   * Get VM power state.
   *
   * @param name - VM name
   * @returns VM status
   */
  async getVmStatus(name: string): Promise<VmStatus> {
    try {
      const instanceView = await this.computeClient.virtualMachines.instanceView(
        this.resourceGroup,
        name
      );

      const powerState = instanceView.statuses?.find(
        (s) => s.code?.startsWith("PowerState/")
      );

      const code = powerState?.code ?? "";

      if (code === "PowerState/running") {
        return "running";
      } else if (code === "PowerState/stopped") {
        return "stopped";
      } else if (code === "PowerState/deallocated") {
        return "deallocated";
      } else if (code === "PowerState/starting") {
        return "starting";
      } else if (code === "PowerState/stopping") {
        return "stopping";
      }
      return "unknown";
    } catch {
      return "unknown";
    }
  }

  /**
   * Resize a VM.
   *
   * @param name - VM name
   * @param size - New VM size (e.g., "Standard_D2s_v3")
   */
  async resizeVm(name: string, size: string): Promise<void> {
    await this.computeClient.virtualMachines.beginUpdateAndWait(
      this.resourceGroup,
      name,
      {
        hardwareProfile: {
          vmSize: size,
        },
      }
    );
  }

  /**
   * Run a shell command on a VM using Run Command extension.
   *
   * @param vmName - VM name
   * @param script - Script lines to execute
   * @returns Command output
   */
  async runCommand(vmName: string, script: string[]): Promise<string> {
    const result: RunCommandResult = await this.computeClient.virtualMachines.beginRunCommandAndWait(
      this.resourceGroup,
      vmName,
      {
        commandId: "RunShellScript",
        script,
      }
    );

    return result.value?.[0]?.message ?? "";
  }

  /**
   * Get VM information.
   *
   * @param name - VM name
   * @returns VM resource or undefined if not found
   */
  async getVm(name: string): Promise<VirtualMachine | undefined> {
    try {
      return await this.computeClient.virtualMachines.get(
        this.resourceGroup,
        name
      );
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        return undefined;
      }
      throw error;
    }
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  /**
   * Parse image reference from a string format.
   * Supports format: "publisher:offer:sku:version" or uses defaults.
   */
  private parseImageReference(image: string): {
    publisher: string;
    offer: string;
    sku: string;
    version: string;
  } {
    const parts = image.split(":");
    if (parts.length === 4) {
      return {
        publisher: parts[0],
        offer: parts[1],
        sku: parts[2],
        version: parts[3],
      };
    }
    // Default to Ubuntu LTS
    return {
      publisher: "Canonical",
      offer: "ubuntu-24_04-lts",
      sku: "server",
      version: "latest",
    };
  }

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
