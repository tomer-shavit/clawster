/**
 * GCP Disk Service
 *
 * Handles persistent disk operations.
 * Part of the ISP-compliant compute service split.
 */

import { DisksClient } from "@google-cloud/compute";
import { waitForZoneOperation, isNotFoundError } from "../../utils/operation-utils";

/**
 * GCP Disk Service for disk operations.
 */
export class DiskService {
  private readonly disksClient: DisksClient;
  private readonly projectId: string;
  private readonly zone: string;

  constructor(
    disksClient: DisksClient,
    projectId: string,
    zone: string
  ) {
    this.disksClient = disksClient;
    this.projectId = projectId;
    this.zone = zone;
  }

  /**
   * Ensure a persistent data disk exists.
   *
   * @param name - Disk name
   * @param sizeGb - Disk size in GB
   * @param diskType - Disk type (default: "pd-standard")
   */
  async ensureDataDisk(name: string, sizeGb: number, diskType: string = "pd-standard"): Promise<void> {
    try {
      await this.disksClient.get({
        project: this.projectId,
        zone: this.zone,
        disk: name,
      });
      // Disk already exists
    } catch (error) {
      if (isNotFoundError(error)) {
        const [operation] = await this.disksClient.insert({
          project: this.projectId,
          zone: this.zone,
          diskResource: {
            name,
            sizeGb: String(sizeGb),
            type: `zones/${this.zone}/diskTypes/${diskType}`,
            description: "Clawster persistent data disk",
          },
        });

        await waitForZoneOperation(this.projectId, this.zone, operation.latestResponse?.name);
        return;
      }
      throw error;
    }
  }

  /**
   * Delete a disk.
   *
   * @param name - Disk name
   */
  async deleteDisk(name: string): Promise<void> {
    try {
      const [operation] = await this.disksClient.delete({
        project: this.projectId,
        zone: this.zone,
        disk: name,
      });

      await waitForZoneOperation(this.projectId, this.zone, operation.latestResponse?.name);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
  }

  /**
   * Get disk information.
   *
   * @param name - Disk name
   * @returns Disk information or null if not found
   */
  async getDisk(name: string): Promise<{ name: string; sizeGb: number; type: string } | null> {
    try {
      const [disk] = await this.disksClient.get({
        project: this.projectId,
        zone: this.zone,
        disk: name,
      });

      return {
        name: disk.name ?? name,
        sizeGb: parseInt(String(disk.sizeGb ?? "0"), 10),
        type: disk.type?.split("/").pop() ?? "pd-standard",
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }
}
