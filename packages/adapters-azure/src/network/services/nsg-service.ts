/**
 * Azure NSG Service
 *
 * Handles Network Security Group operations.
 * Part of the ISP-compliant network service split.
 */

import { NetworkManagementClient, NetworkSecurityGroup } from "@azure/arm-network";
import type { ISecurityGroupService } from "@clawster/adapters-common";
import type {
  SecurityRule as CommonSecurityRule,
  SecurityGroupResult,
} from "@clawster/adapters-common/dist/types/network";

/**
 * Azure-specific NSG security rule definition.
 */
export interface SecurityRule {
  /** Rule name */
  name: string;
  /** Rule priority (100-4096) */
  priority: number;
  /** Traffic direction */
  direction: "Inbound" | "Outbound";
  /** Allow or Deny traffic */
  access: "Allow" | "Deny";
  /** Network protocol */
  protocol: "Tcp" | "Udp" | "*";
  /** Source address prefix (CIDR or service tag) */
  sourceAddressPrefix: string;
  /** Destination port range */
  destinationPortRange: string;
}

/**
 * Azure NSG Service for network security group operations.
 * Implements ISecurityGroupService interface.
 */
export class NsgService implements ISecurityGroupService {
  constructor(
    private readonly networkClient: NetworkManagementClient,
    private readonly resourceGroup: string,
    private readonly location: string
  ) {}

  /**
   * Ensure a security group exists with the specified rules.
   * Implements ISecurityGroupService.ensureSecurityGroup.
   *
   * @param name - NSG name
   * @param rules - Security rules to apply
   * @returns Security group result with ID and applied rules
   */
  async ensureSecurityGroup(
    name: string,
    rules: CommonSecurityRule[]
  ): Promise<SecurityGroupResult> {
    // Convert common rules to Azure-specific format
    const azureRules: SecurityRule[] = rules.map((rule, index) => ({
      name: rule.name ?? `rule-${index}`,
      priority: rule.priority ?? 100 + index * 10,
      direction: rule.direction === "inbound" ? "Inbound" : "Outbound",
      access: rule.action === "allow" ? "Allow" : "Deny",
      protocol: this.mapProtocol(rule.protocol),
      sourceAddressPrefix: rule.sourceCidrs?.[0] ?? "*",
      destinationPortRange: rule.portRange,
    }));

    const nsg = await this.ensureNSG(name, azureRules);

    return {
      securityGroupId: nsg.id ?? name,
      name,
      resourceId: nsg.id,
      created: true, // Azure API doesn't differentiate
      rules,
    };
  }

  /**
   * Ensure an NSG exists with the specified rules (Azure-specific method).
   *
   * @param name - NSG name
   * @param rules - Security rules to apply
   * @param additionalRules - Additional security rules
   * @returns NSG resource
   */
  async ensureNSG(
    name: string,
    rules: SecurityRule[],
    additionalRules?: SecurityRule[]
  ): Promise<NetworkSecurityGroup> {
    // Check if already exists
    try {
      const existing = await this.networkClient.networkSecurityGroups.get(
        this.resourceGroup,
        name
      );
      return existing;
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode !== 404) {
        throw error;
      }
    }

    // Build security rules
    const securityRules = rules.map((rule) => ({
      name: rule.name,
      priority: rule.priority,
      direction: rule.direction,
      access: rule.access,
      protocol: rule.protocol,
      sourceAddressPrefix: rule.sourceAddressPrefix,
      sourcePortRange: "*",
      destinationAddressPrefix: "*",
      destinationPortRange: rule.destinationPortRange,
    }));

    // Add additional rules if provided
    if (additionalRules && additionalRules.length > 0) {
      let priority = 400;
      for (const rule of additionalRules) {
        securityRules.push({
          name: rule.name,
          priority: rule.priority || priority,
          direction: rule.direction,
          access: rule.access,
          protocol: rule.protocol,
          sourceAddressPrefix: rule.sourceAddressPrefix,
          sourcePortRange: "*",
          destinationAddressPrefix: "*",
          destinationPortRange: rule.destinationPortRange,
        });
        priority += 10;
      }
    }

    const result = await this.networkClient.networkSecurityGroups.beginCreateOrUpdateAndWait(
      this.resourceGroup,
      name,
      {
        location: this.location,
        securityRules,
        tags: {
          managedBy: "clawster",
        },
      }
    );

    return result;
  }

  /**
   * Delete an NSG.
   *
   * @param name - NSG name
   */
  async deleteNSG(name: string): Promise<void> {
    try {
      await this.networkClient.networkSecurityGroups.beginDeleteAndWait(
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
   * Get NSG information.
   *
   * @param name - NSG name
   * @returns NSG resource or undefined if not found
   */
  async getNSG(name: string): Promise<NetworkSecurityGroup | undefined> {
    try {
      return await this.networkClient.networkSecurityGroups.get(
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

  /**
   * Get default NSG security rules for VM protection.
   */
  static getDefaultSecurityRules(): SecurityRule[] {
    return [
      {
        name: "DenyAllInbound",
        priority: 4096,
        direction: "Inbound",
        access: "Deny",
        protocol: "*",
        sourceAddressPrefix: "*",
        destinationPortRange: "*",
      },
      {
        name: "AllowInternetOutbound",
        priority: 100,
        direction: "Outbound",
        access: "Allow",
        protocol: "*",
        sourceAddressPrefix: "*",
        destinationPortRange: "*",
      },
      {
        name: "AllowAzureLoadBalancer",
        priority: 100,
        direction: "Inbound",
        access: "Allow",
        protocol: "*",
        sourceAddressPrefix: "AzureLoadBalancer",
        destinationPortRange: "*",
      },
      {
        name: "AllowVNetInbound",
        priority: 200,
        direction: "Inbound",
        access: "Allow",
        protocol: "*",
        sourceAddressPrefix: "VirtualNetwork",
        destinationPortRange: "*",
      },
      {
        name: "AllowAppGatewayHealthProbes",
        priority: 300,
        direction: "Inbound",
        access: "Allow",
        protocol: "*",
        sourceAddressPrefix: "GatewayManager",
        destinationPortRange: "65200-65535",
      },
    ];
  }

  private mapProtocol(protocol: string): "Tcp" | "Udp" | "*" {
    switch (protocol.toLowerCase()) {
      case "tcp":
        return "Tcp";
      case "udp":
        return "Udp";
      default:
        return "*";
    }
  }
}
