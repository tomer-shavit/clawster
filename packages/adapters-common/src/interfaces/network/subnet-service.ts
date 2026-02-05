import type { SubnetResult } from "../../types/network";

/**
 * Interface for subnet operations.
 * Part of ISP-compliant network service split.
 */
export interface ISubnetService {
  /**
   * Ensure a subnet exists within a network, creating it if necessary.
   * @param networkName - Parent network name or ID
   * @param subnetName - Subnet name
   * @param cidr - IP CIDR range (e.g., "10.0.1.0/24")
   * @returns Subnet result with ID and metadata
   */
  ensureSubnet(
    networkName: string,
    subnetName: string,
    cidr: string
  ): Promise<SubnetResult>;
}
