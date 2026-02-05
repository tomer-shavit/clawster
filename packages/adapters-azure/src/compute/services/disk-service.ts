/**
 * Azure Disk Service
 *
 * Handles managed disk operations.
 * Part of the ISP-compliant compute service split.
 */

import { ComputeManagementClient, Disk } from "@azure/arm-compute";

/**
 * Azure Disk Service for managed disk operations.
 */
export class DiskService {
  constructor(
    private readonly computeClient: ComputeManagementClient,
    private readonly resourceGroup: string,
    private readonly location: string
  ) {}

  /**
   * Create a managed data disk.
   *
   * @param name - Disk name
   * @param sizeGb - Disk size in GB
   * @param sku - Disk SKU (default: "Standard_LRS")
   * @returns Created Disk resource
   */
  async createDataDisk(
    name: string,
    sizeGb: number,
    sku: string = "Standard_LRS"
  ): Promise<Disk> {
    // Check if already exists
    try {
      const existing = await this.computeClient.disks.get(
        this.resourceGroup,
        name
      );
      return existing;
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode !== 404) {
        throw error;
      }
    }

    const result = await this.computeClient.disks.beginCreateOrUpdateAndWait(
      this.resourceGroup,
      name,
      {
        location: this.location,
        sku: { name: sku },
        diskSizeGB: sizeGb,
        creationData: {
          createOption: "Empty",
        },
        tags: {
          managedBy: "clawster",
        },
      }
    );

    return result;
  }

  /**
   * Delete a managed disk.
   *
   * @param name - Disk name
   */
  async deleteDisk(name: string): Promise<void> {
    try {
      await this.computeClient.disks.beginDeleteAndWait(
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
   * Resize a managed disk.
   * Note: Disk must be unattached or VM must be deallocated.
   *
   * @param name - Disk name
   * @param sizeGb - New size in GB (must be larger than current)
   */
  async resizeDisk(name: string, sizeGb: number): Promise<void> {
    await this.computeClient.disks.beginUpdateAndWait(
      this.resourceGroup,
      name,
      {
        diskSizeGB: sizeGb,
      }
    );
  }

  /**
   * Get disk information.
   *
   * @param name - Disk name
   * @returns Disk resource or undefined if not found
   */
  async getDisk(name: string): Promise<Disk | undefined> {
    try {
      return await this.computeClient.disks.get(this.resourceGroup, name);
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        return undefined;
      }
      throw error;
    }
  }
}
