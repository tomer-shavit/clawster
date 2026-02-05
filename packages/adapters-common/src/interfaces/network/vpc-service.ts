import type { NetworkResult } from "../../types/network";

/**
 * Interface for VPC/VNet operations.
 * Part of ISP-compliant network service split.
 */
export interface IVpcService {
  /**
   * Ensure a network (VPC/VNet) exists, creating it if necessary.
   * @param name - Network name
   * @param cidr - IP CIDR range (e.g., "10.0.0.0/16")
   * @returns Network result with ID and metadata
   */
  ensureNetwork(name: string, cidr: string): Promise<NetworkResult>;

  /**
   * Delete a network and all its resources.
   * @param name - Network name or ID
   */
  deleteNetwork(name: string): Promise<void>;
}
