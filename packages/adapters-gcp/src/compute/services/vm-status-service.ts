/**
 * GCP VM Status Service
 *
 * Handles VM instance status queries.
 * Part of the ISP-compliant compute service split.
 */

import { InstancesClient } from "@google-cloud/compute";
import type { IInstanceStatusProvider } from "@clawster/adapters-common";
import type { InstanceStatus } from "@clawster/adapters-common/dist/types/compute";

export interface VmStatus {
  status: "RUNNING" | "STOPPED" | "TERMINATED" | "STAGING" | "PROVISIONING" | "SUSPENDING" | "SUSPENDED" | "REPAIRING" | "UNKNOWN" | "NOT_FOUND";
  machineType?: string;
  zone?: string;
  networkIp?: string;
  externalIp?: string;
}

/**
 * GCP VM Status Service for querying instance status.
 * Implements IInstanceStatusProvider interface.
 */
export class VmStatusService implements IInstanceStatusProvider {
  private readonly instancesClient: InstancesClient;
  private readonly projectId: string;
  private readonly zone: string;

  constructor(
    instancesClient: InstancesClient,
    projectId: string,
    zone: string
  ) {
    this.instancesClient = instancesClient;
    this.projectId = projectId;
    this.zone = zone;
  }

  /**
   * Get the current status of a compute instance.
   * Implements IInstanceStatusProvider.getInstanceStatus.
   */
  async getInstanceStatus(name: string): Promise<InstanceStatus> {
    try {
      const [instance] = await this.instancesClient.get({
        project: this.projectId,
        zone: this.zone,
        instance: name,
      });

      return this.mapGcpStatusToCommon(instance.status as string);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return "terminated";
      }
      throw error;
    }
  }

  /**
   * Get detailed information about a VM instance.
   *
   * @param name - Instance name
   * @returns VM status and metadata, or null if not found
   */
  async getInstance(name: string): Promise<VmStatus | null> {
    try {
      const [instance] = await this.instancesClient.get({
        project: this.projectId,
        zone: this.zone,
        instance: name,
      });

      const networkInterface = instance.networkInterfaces?.[0];

      return {
        status: (instance.status as VmStatus["status"]) ?? "UNKNOWN",
        machineType: instance.machineType?.split("/").pop(),
        zone: this.zone,
        networkIp: networkInterface?.networkIP ?? undefined,
        externalIp: networkInterface?.accessConfigs?.[0]?.natIP ?? undefined,
      };
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  private mapGcpStatusToCommon(gcpStatus: string): InstanceStatus {
    switch (gcpStatus) {
      case "RUNNING":
        return "running";
      case "STOPPED":
      case "TERMINATED":
        return "stopped";
      case "STAGING":
      case "PROVISIONING":
        return "pending";
      case "STOPPING":
        return "stopping";
      case "SUSPENDING":
      case "SUSPENDED":
        return "stopped";
      default:
        return "unknown";
    }
  }

  private isNotFoundError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.message.includes("NOT_FOUND") || error.message.includes("404") || error.message.includes("was not found"))
    );
  }
}
