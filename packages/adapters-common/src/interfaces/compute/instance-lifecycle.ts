import type { InstanceConfig, InstanceResult } from "../../types/compute";

/**
 * Interface for compute instance lifecycle operations.
 * Part of ISP-compliant compute service split.
 */
export interface IInstanceLifecycle {
  /**
   * Create a new compute instance.
   * @param name - Instance name
   * @param config - Instance configuration
   * @returns Instance creation result with ID, IPs, and status
   */
  createInstance(name: string, config: InstanceConfig): Promise<InstanceResult>;

  /**
   * Delete a compute instance.
   * @param name - Instance name or ID
   */
  deleteInstance(name: string): Promise<void>;

  /**
   * Start a stopped compute instance.
   * @param name - Instance name or ID
   */
  startInstance(name: string): Promise<void>;

  /**
   * Stop a running compute instance.
   * @param name - Instance name or ID
   */
  stopInstance(name: string): Promise<void>;

  /**
   * Restart a compute instance.
   * @param name - Instance name or ID
   */
  restartInstance(name: string): Promise<void>;
}
