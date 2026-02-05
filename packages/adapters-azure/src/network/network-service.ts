/**
 * Azure Network Service (Facade)
 *
 * Provides a unified interface for Azure network operations.
 * Delegates to specialized sub-services following SOLID principles.
 */

import {
  NetworkManagementClient,
  VirtualNetwork,
  Subnet,
  NetworkSecurityGroup,
  PublicIPAddress,
} from "@azure/arm-network";
import { DefaultAzureCredential, TokenCredential } from "@azure/identity";
import type { INetworkService } from "@clawster/adapters-common";
import type {
  NetworkResult,
  SubnetResult,
  SecurityRule as CommonSecurityRule,
  SecurityGroupResult,
} from "@clawster/adapters-common/dist/types/network";

import { VnetService } from "./services/vnet-service";
import { SubnetService } from "./services/subnet-service";
import { NsgService, SecurityRule } from "./services/nsg-service";
import { PublicIpService } from "./services/public-ip-service";

// Re-export types for backward compatibility
export type { SecurityRule };

/**
 * Azure Network Service (Facade) for VNet, Subnet, NSG, and Public IP operations.
 * Implements INetworkService interface.
 * Delegates to specialized sub-services for each concern.
 */
export class NetworkService implements INetworkService {
  private readonly vnetService: VnetService;
  private readonly subnetService: SubnetService;
  private readonly nsgService: NsgService;
  private readonly publicIpService: PublicIpService;

  /**
   * Create a new NetworkService instance.
   *
   * @param subscriptionId - Azure subscription ID
   * @param resourceGroup - Resource group name
   * @param location - Azure region (e.g., "eastus")
   * @param credential - Optional TokenCredential (defaults to DefaultAzureCredential)
   */
  constructor(
    subscriptionId: string,
    resourceGroup: string,
    location: string,
    credential?: TokenCredential
  ) {
    const cred = credential || new DefaultAzureCredential();
    const networkClient = new NetworkManagementClient(cred, subscriptionId);

    this.vnetService = new VnetService(networkClient, resourceGroup, location);
    this.subnetService = new SubnetService(networkClient, resourceGroup);
    this.nsgService = new NsgService(networkClient, resourceGroup, location);
    this.publicIpService = new PublicIpService(networkClient, resourceGroup, location);
  }

  /**
   * Create with pre-constructed sub-services (for testing/DI).
   */
  static fromServices(
    vnetService: VnetService,
    subnetService: SubnetService,
    nsgService: NsgService,
    publicIpService: PublicIpService
  ): NetworkService {
    const instance = Object.create(NetworkService.prototype);
    instance.vnetService = vnetService;
    instance.subnetService = subnetService;
    instance.nsgService = nsgService;
    instance.publicIpService = publicIpService;
    return instance;
  }

  // ------------------------------------------------------------------
  // INetworkService implementation (IVpcService + ISubnetService + ISecurityGroupService)
  // ------------------------------------------------------------------

  /**
   * Ensure a network (VNet) exists, creating it if necessary.
   * Implements IVpcService.ensureNetwork.
   */
  async ensureNetwork(name: string, cidr: string): Promise<NetworkResult> {
    return this.vnetService.ensureNetwork(name, cidr);
  }

  /**
   * Delete a network and all its resources.
   * Implements IVpcService.deleteNetwork.
   */
  async deleteNetwork(name: string): Promise<void> {
    return this.vnetService.deleteNetwork(name);
  }

  /**
   * Ensure a subnet exists within a network.
   * Implements ISubnetService.ensureSubnet.
   */
  async ensureSubnet(
    networkName: string,
    subnetName: string,
    cidr: string
  ): Promise<SubnetResult> {
    return this.subnetService.ensureSubnet(networkName, subnetName, cidr);
  }

  /**
   * Ensure a security group exists with the specified rules.
   * Implements ISecurityGroupService.ensureSecurityGroup.
   */
  async ensureSecurityGroup(
    name: string,
    rules: CommonSecurityRule[]
  ): Promise<SecurityGroupResult> {
    return this.nsgService.ensureSecurityGroup(name, rules);
  }

  // ------------------------------------------------------------------
  // Azure-specific VNet Operations (backward compatibility)
  // ------------------------------------------------------------------

  async ensureVNet(name: string, cidr: string = "10.0.0.0/16"): Promise<VirtualNetwork> {
    return this.vnetService.ensureVNet(name, cidr);
  }

  async deleteVNet(name: string): Promise<void> {
    return this.vnetService.deleteVNet(name);
  }

  async getVNet(name: string): Promise<VirtualNetwork | undefined> {
    return this.vnetService.getVNet(name);
  }

  // ------------------------------------------------------------------
  // Azure-specific Subnet Operations (backward compatibility)
  // ------------------------------------------------------------------

  /**
   * Ensure a subnet exists with optional NSG attachment (Azure-specific).
   * For interface-compliant version, use ensureSubnet().
   */
  async ensureSubnetWithNsg(
    vnetName: string,
    subnetName: string,
    cidr: string,
    nsgId?: string
  ): Promise<Subnet> {
    return this.subnetService.ensureSubnetWithNsg(vnetName, subnetName, cidr, nsgId);
  }

  async deleteSubnet(vnetName: string, subnetName: string): Promise<void> {
    return this.subnetService.deleteSubnet(vnetName, subnetName);
  }

  async getSubnet(vnetName: string, subnetName: string): Promise<Subnet | undefined> {
    return this.subnetService.getSubnet(vnetName, subnetName);
  }

  // ------------------------------------------------------------------
  // NSG Operations (delegated to NsgService)
  // ------------------------------------------------------------------

  async ensureNSG(
    name: string,
    rules: SecurityRule[],
    additionalRules?: SecurityRule[]
  ): Promise<NetworkSecurityGroup> {
    return this.nsgService.ensureNSG(name, rules, additionalRules);
  }

  async deleteNSG(name: string): Promise<void> {
    return this.nsgService.deleteNSG(name);
  }

  async getNSG(name: string): Promise<NetworkSecurityGroup | undefined> {
    return this.nsgService.getNSG(name);
  }

  /**
   * Get default NSG security rules for VM protection.
   */
  static getDefaultSecurityRules(): SecurityRule[] {
    return NsgService.getDefaultSecurityRules();
  }

  // ------------------------------------------------------------------
  // Public IP Operations (delegated to PublicIpService)
  // ------------------------------------------------------------------

  async createPublicIp(
    name: string,
    dnsLabel?: string,
    sku: "Basic" | "Standard" = "Standard",
    allocationMethod: "Static" | "Dynamic" = "Static"
  ): Promise<PublicIPAddress> {
    return this.publicIpService.createPublicIp(name, dnsLabel, sku, allocationMethod);
  }

  async deletePublicIp(name: string): Promise<void> {
    return this.publicIpService.deletePublicIp(name);
  }

  async getPublicIp(name: string): Promise<PublicIPAddress | undefined> {
    return this.publicIpService.getPublicIp(name);
  }
}
