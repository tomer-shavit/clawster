/**
 * Azure Public IP Service
 *
 * Handles Public IP Address operations.
 * Part of the ISP-compliant network service split.
 */

import { NetworkManagementClient, PublicIPAddress } from "@azure/arm-network";

/**
 * Azure Public IP Service for public IP address operations.
 */
export class PublicIpService {
  constructor(
    private readonly networkClient: NetworkManagementClient,
    private readonly resourceGroup: string,
    private readonly location: string
  ) {}

  /**
   * Create a public IP address.
   *
   * @param name - Public IP name
   * @param dnsLabel - Optional DNS label for FQDN
   * @param sku - SKU (default: "Standard")
   * @param allocationMethod - Allocation method (default: "Static")
   * @returns Public IP resource
   */
  async createPublicIp(
    name: string,
    dnsLabel?: string,
    sku: "Basic" | "Standard" = "Standard",
    allocationMethod: "Static" | "Dynamic" = "Static"
  ): Promise<PublicIPAddress> {
    // Check if already exists
    try {
      const existing = await this.networkClient.publicIPAddresses.get(
        this.resourceGroup,
        name
      );
      return existing;
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode !== 404) {
        throw error;
      }
    }

    const result = await this.networkClient.publicIPAddresses.beginCreateOrUpdateAndWait(
      this.resourceGroup,
      name,
      {
        location: this.location,
        sku: { name: sku },
        publicIPAllocationMethod: allocationMethod,
        dnsSettings: dnsLabel
          ? {
              domainNameLabel: dnsLabel.toLowerCase().replace(/[^a-z0-9-]/g, ""),
            }
          : undefined,
        tags: {
          managedBy: "clawster",
        },
      }
    );

    return result;
  }

  /**
   * Delete a public IP address.
   *
   * @param name - Public IP name
   */
  async deletePublicIp(name: string): Promise<void> {
    try {
      await this.networkClient.publicIPAddresses.beginDeleteAndWait(
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
   * Get public IP address information.
   *
   * @param name - Public IP name
   * @returns Public IP resource or undefined if not found
   */
  async getPublicIp(name: string): Promise<PublicIPAddress | undefined> {
    try {
      return await this.networkClient.publicIPAddresses.get(
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
   * Ensure a static public IP exists with DNS label.
   *
   * @param name - Public IP name
   * @param dnsLabel - DNS label for FQDN
   * @returns IP address and FQDN
   */
  async ensurePublicIp(
    name: string,
    dnsLabel: string
  ): Promise<{ ipAddress: string; fqdn: string }> {
    const pip = await this.createPublicIp(name, dnsLabel, "Standard", "Static");
    return {
      ipAddress: pip.ipAddress || "",
      fqdn: pip.dnsSettings?.fqdn || "",
    };
  }
}
