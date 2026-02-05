/**
 * Azure Subnet Service
 *
 * Handles Subnet operations.
 * Part of the ISP-compliant network service split.
 */

import { NetworkManagementClient, Subnet } from "@azure/arm-network";
import type { ISubnetService } from "@clawster/adapters-common";
import type { SubnetResult } from "@clawster/adapters-common/dist/types/network";

/**
 * Azure Subnet Service for subnet operations.
 * Implements ISubnetService interface.
 */
export class SubnetService implements ISubnetService {
  constructor(
    private readonly networkClient: NetworkManagementClient,
    private readonly resourceGroup: string
  ) {}

  /**
   * Ensure a subnet exists within a VNet.
   * Implements ISubnetService.ensureSubnet.
   *
   * @param vnetName - VNet name
   * @param subnetName - Subnet name
   * @param cidr - IP CIDR range
   * @returns Subnet result with ID and metadata
   */
  async ensureSubnet(
    vnetName: string,
    subnetName: string,
    cidr: string
  ): Promise<SubnetResult> {
    // Check if already exists
    try {
      const existing = await this.networkClient.subnets.get(
        this.resourceGroup,
        vnetName,
        subnetName
      );
      return {
        subnetId: existing.id ?? subnetName,
        name: subnetName,
        cidr: existing.addressPrefix ?? cidr,
        resourceId: existing.id,
        created: false,
      };
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode !== 404) {
        throw error;
      }
    }

    const result = await this.networkClient.subnets.beginCreateOrUpdateAndWait(
      this.resourceGroup,
      vnetName,
      subnetName,
      {
        addressPrefix: cidr,
      }
    );

    return {
      subnetId: result.id ?? subnetName,
      name: subnetName,
      cidr,
      resourceId: result.id,
      created: true,
    };
  }

  /**
   * Ensure a subnet exists with optional NSG attachment (Azure-specific).
   *
   * @param vnetName - VNet name
   * @param subnetName - Subnet name
   * @param cidr - IP CIDR range
   * @param nsgId - Optional NSG resource ID to attach
   * @returns Subnet resource
   */
  async ensureSubnetWithNsg(
    vnetName: string,
    subnetName: string,
    cidr: string,
    nsgId?: string
  ): Promise<Subnet> {
    // Check if already exists
    try {
      const existing = await this.networkClient.subnets.get(
        this.resourceGroup,
        vnetName,
        subnetName
      );
      return existing;
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode !== 404) {
        throw error;
      }
    }

    const result = await this.networkClient.subnets.beginCreateOrUpdateAndWait(
      this.resourceGroup,
      vnetName,
      subnetName,
      {
        addressPrefix: cidr,
        networkSecurityGroup: nsgId ? { id: nsgId } : undefined,
      }
    );

    return result;
  }

  /**
   * Delete a subnet.
   *
   * @param vnetName - VNet name
   * @param subnetName - Subnet name
   */
  async deleteSubnet(vnetName: string, subnetName: string): Promise<void> {
    try {
      await this.networkClient.subnets.beginDeleteAndWait(
        this.resourceGroup,
        vnetName,
        subnetName
      );
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        return;
      }
      throw error;
    }
  }

  /**
   * Get subnet information.
   *
   * @param vnetName - VNet name
   * @param subnetName - Subnet name
   * @returns Subnet resource or undefined if not found
   */
  async getSubnet(vnetName: string, subnetName: string): Promise<Subnet | undefined> {
    try {
      return await this.networkClient.subnets.get(
        this.resourceGroup,
        vnetName,
        subnetName
      );
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        return undefined;
      }
      throw error;
    }
  }
}
