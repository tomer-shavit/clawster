/**
 * Azure NIC Service
 *
 * Handles Network Interface operations.
 * Part of the ISP-compliant compute service split.
 */

import { NetworkManagementClient, NetworkInterface } from "@azure/arm-network";

/**
 * Azure NIC Service for network interface operations.
 */
export class NicService {
  constructor(
    private readonly networkClient: NetworkManagementClient,
    private readonly resourceGroup: string,
    private readonly location: string
  ) {}

  /**
   * Create a network interface.
   *
   * @param name - NIC name
   * @param subnetId - Subnet resource ID
   * @param publicIpId - Optional public IP resource ID
   * @returns Created NIC resource
   */
  async createNic(
    name: string,
    subnetId: string,
    publicIpId?: string
  ): Promise<NetworkInterface> {
    // Check if already exists
    try {
      const existing = await this.networkClient.networkInterfaces.get(
        this.resourceGroup,
        name
      );
      return existing;
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode !== 404) {
        throw error;
      }
    }

    const result = await this.networkClient.networkInterfaces.beginCreateOrUpdateAndWait(
      this.resourceGroup,
      name,
      {
        location: this.location,
        ipConfigurations: [
          {
            name: "ipconfig1",
            subnet: { id: subnetId },
            privateIPAllocationMethod: "Dynamic",
            publicIPAddress: publicIpId ? { id: publicIpId } : undefined,
          },
        ],
        tags: {
          managedBy: "clawster",
        },
      }
    );

    return result;
  }

  /**
   * Delete a network interface.
   *
   * @param name - NIC name
   */
  async deleteNic(name: string): Promise<void> {
    try {
      await this.networkClient.networkInterfaces.beginDeleteAndWait(
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
   * Get the VM private IP address.
   *
   * @param nicName - NIC name
   * @returns Private IP address or undefined
   */
  async getVmPrivateIp(nicName: string): Promise<string | undefined> {
    try {
      const nic = await this.networkClient.networkInterfaces.get(
        this.resourceGroup,
        nicName
      );
      return nic.ipConfigurations?.[0]?.privateIPAddress ?? undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get NIC information.
   *
   * @param name - NIC name
   * @returns NIC resource or undefined if not found
   */
  async getNic(name: string): Promise<NetworkInterface | undefined> {
    try {
      return await this.networkClient.networkInterfaces.get(
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
}
