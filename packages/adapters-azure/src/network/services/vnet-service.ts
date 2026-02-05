/**
 * Azure VNet Service
 *
 * Handles Virtual Network operations.
 * Part of the ISP-compliant network service split.
 */

import { NetworkManagementClient, VirtualNetwork } from "@azure/arm-network";
import type { IVpcService } from "@clawster/adapters-common";
import type { NetworkResult } from "@clawster/adapters-common/dist/types/network";

/**
 * Azure VNet Service for virtual network operations.
 * Implements IVpcService interface.
 */
export class VnetService implements IVpcService {
  constructor(
    private readonly networkClient: NetworkManagementClient,
    private readonly resourceGroup: string,
    private readonly location: string
  ) {}

  /**
   * Ensure a VNet exists, creating it if necessary.
   * Implements IVpcService.ensureNetwork.
   *
   * @param name - VNet name
   * @param cidr - IP CIDR range (default: "10.0.0.0/16")
   * @returns Network result with ID and metadata
   */
  async ensureNetwork(name: string, cidr: string = "10.0.0.0/16"): Promise<NetworkResult> {
    // Check if already exists
    try {
      const existing = await this.networkClient.virtualNetworks.get(
        this.resourceGroup,
        name
      );
      return {
        networkId: existing.id ?? name,
        name,
        cidr: existing.addressSpace?.addressPrefixes?.[0] ?? cidr,
        resourceId: existing.id,
        created: false,
      };
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode !== 404) {
        throw error;
      }
    }

    const result = await this.networkClient.virtualNetworks.beginCreateOrUpdateAndWait(
      this.resourceGroup,
      name,
      {
        location: this.location,
        addressSpace: {
          addressPrefixes: [cidr],
        },
        tags: {
          managedBy: "clawster",
        },
      }
    );

    return {
      networkId: result.id ?? name,
      name,
      cidr,
      resourceId: result.id,
      created: true,
    };
  }

  /**
   * Delete a VNet.
   * Implements IVpcService.deleteNetwork.
   *
   * @param name - VNet name
   */
  async deleteNetwork(name: string): Promise<void> {
    try {
      await this.networkClient.virtualNetworks.beginDeleteAndWait(
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
   * Ensure a VNet exists (Azure-specific method, preserves backward compatibility).
   * Delegates to ensureNetwork for implementation.
   *
   * @param name - VNet name
   * @param cidr - IP CIDR range
   * @returns VNet resource
   */
  async ensureVNet(name: string, cidr: string = "10.0.0.0/16"): Promise<VirtualNetwork> {
    await this.ensureNetwork(name, cidr);
    // getVNet is guaranteed to return a value after ensureNetwork succeeds
    return (await this.getVNet(name))!;
  }

  /**
   * Delete a VNet (Azure-specific method, preserves backward compatibility).
   *
   * @param name - VNet name
   */
  async deleteVNet(name: string): Promise<void> {
    return this.deleteNetwork(name);
  }

  /**
   * Get VNet information.
   *
   * @param name - VNet name
   * @returns VNet resource or undefined if not found
   */
  async getVNet(name: string): Promise<VirtualNetwork | undefined> {
    try {
      return await this.networkClient.virtualNetworks.get(
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
