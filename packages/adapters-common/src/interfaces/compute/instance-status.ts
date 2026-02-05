import type { InstanceStatus } from "../../types/compute";

/**
 * Interface for querying compute instance status.
 * Part of ISP-compliant compute service split.
 */
export interface IInstanceStatusProvider {
  /**
   * Get the current status of a compute instance.
   * @param name - Instance name or ID
   * @returns Current instance status
   */
  getInstanceStatus(name: string): Promise<InstanceStatus>;
}
