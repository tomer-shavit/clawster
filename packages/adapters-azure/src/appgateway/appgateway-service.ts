/**
 * Azure Application Gateway Service
 *
 * Provides operations for managing Azure Application Gateways.
 * Implements ILoadBalancerService interface.
 *
 * Application Gateway provides Layer 7 load balancing with SSL termination,
 * URL-based routing, and Web Application Firewall (WAF) capabilities.
 */

import {
  NetworkManagementClient,
  ApplicationGateway,
} from "@azure/arm-network";
import { DefaultAzureCredential, TokenCredential } from "@azure/identity";
import type { ILoadBalancerService } from "@clawster/adapters-common";
import type {
  LoadBalancerConfig,
  LoadBalancerResult,
  LoadBalancerEndpoint,
} from "@clawster/adapters-common/dist/types/loadbalancer";

import { PublicIpService } from "../network/services/public-ip-service";
import { SubnetService } from "../network/services/subnet-service";

/**
 * Application Gateway endpoint information.
 */
export interface GatewayEndpointInfo {
  /** Public IP address */
  publicIp: string;
  /** Fully qualified domain name */
  fqdn: string;
}

/**
 * Options for creating an Application Gateway.
 */
export interface CreateAppGatewayOptions {
  /** Application Gateway name */
  name: string;
  /** Subnet resource ID */
  subnetId: string;
  /** Public IP name */
  publicIpName: string;
  /** Backend pool port (gateway port) */
  gatewayPort: number;
  /** Backend pool name (default: "vmBackendPool") */
  backendPoolName?: string;
  /** Health probe path (default: "/health") */
  healthProbePath?: string;
  /** Request timeout in seconds (default: 60) */
  requestTimeout?: number;
  /** SKU name (default: "Standard_v2") */
  skuName?: string;
  /** SKU tier (default: "Standard_v2") */
  skuTier?: string;
  /** Capacity (default: 1) */
  capacity?: number;
}

/**
 * Azure Application Gateway Service.
 * Implements ILoadBalancerService interface.
 */
export class AppGatewayService implements ILoadBalancerService {
  private readonly networkClient: NetworkManagementClient;
  private readonly subscriptionId: string;
  private readonly resourceGroup: string;
  private readonly location: string;
  private readonly publicIpService: PublicIpService;
  private readonly subnetService: SubnetService;

  /**
   * Create a new AppGatewayService instance.
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
    this.networkClient = new NetworkManagementClient(cred, subscriptionId);
    this.subscriptionId = subscriptionId;
    this.resourceGroup = resourceGroup;
    this.location = location;

    // Use the sub-services for delegation
    this.publicIpService = new PublicIpService(this.networkClient, resourceGroup, location);
    this.subnetService = new SubnetService(this.networkClient, resourceGroup);
  }

  /**
   * Create with pre-constructed sub-services (for testing/DI).
   */
  static fromServices(
    networkClient: NetworkManagementClient,
    subscriptionId: string,
    resourceGroup: string,
    location: string,
    publicIpService: PublicIpService,
    subnetService: SubnetService
  ): AppGatewayService {
    const instance = Object.create(AppGatewayService.prototype);
    instance.networkClient = networkClient;
    instance.subscriptionId = subscriptionId;
    instance.resourceGroup = resourceGroup;
    instance.location = location;
    instance.publicIpService = publicIpService;
    instance.subnetService = subnetService;
    return instance;
  }

  // ------------------------------------------------------------------
  // ILoadBalancerService implementation
  // ------------------------------------------------------------------

  /**
   * Create a new load balancer (Application Gateway).
   * Implements ILoadBalancerService.createLoadBalancer.
   */
  async createLoadBalancer(
    name: string,
    config: LoadBalancerConfig
  ): Promise<LoadBalancerResult> {
    const listener = config.listeners[0]; // Application Gateway uses single listener
    const publicIpName = `${name}-pip`;

    // Create public IP for the gateway
    await this.publicIpService.createPublicIp(publicIpName, name, "Standard", "Static");

    const options: CreateAppGatewayOptions = {
      name,
      subnetId: config.subnetIds?.[0] ?? "",
      publicIpName,
      gatewayPort: listener.targetPort,
      healthProbePath: config.healthCheck?.path ?? "/health",
      requestTimeout: config.healthCheck?.timeoutSeconds ?? 60,
    };

    const appGw = await this.createAppGateway(options);

    return {
      loadBalancerId: appGw.id ?? name,
      name,
      dnsName: appGw.frontendIPConfigurations?.[0]?.publicIPAddress?.id ?? undefined,
      resourceId: appGw.id,
      status: "active",
    };
  }

  /**
   * Delete a load balancer (Application Gateway) and its resources.
   * Implements ILoadBalancerService.deleteLoadBalancer.
   */
  async deleteLoadBalancer(name: string): Promise<void> {
    await this.deleteAppGateway(name);
    // Also delete associated public IP
    await this.publicIpService.deletePublicIp(`${name}-pip`);
  }

  /**
   * Update the backend pool with new targets.
   * Implements ILoadBalancerService.updateBackendPool.
   */
  async updateBackendPool(name: string, targets: string[]): Promise<void> {
    const appGw: ApplicationGateway = await this.networkClient.applicationGateways.get(
      this.resourceGroup,
      name
    );

    if (appGw.backendAddressPools?.[0]) {
      appGw.backendAddressPools[0].backendAddresses = targets.map((ip) => ({
        ipAddress: ip,
      }));
    }

    await this.networkClient.applicationGateways.beginCreateOrUpdateAndWait(
      this.resourceGroup,
      name,
      appGw
    );
  }

  /**
   * Get the public endpoint information for a load balancer.
   * Implements ILoadBalancerService.getEndpoint.
   */
  async getEndpoint(name: string): Promise<LoadBalancerEndpoint> {
    const appGw = await this.getAppGateway(name);
    if (!appGw) {
      throw new Error(`Application Gateway ${name} not found`);
    }

    // Get public IP details
    const publicIpName = `${name}-pip`;
    const pip = await this.publicIpService.getPublicIp(publicIpName);

    return {
      dnsName: pip?.dnsSettings?.fqdn ?? "",
      publicIp: pip?.ipAddress ?? undefined,
      port: appGw.frontendPorts?.[0]?.port ?? 80,
      url: `http://${pip?.dnsSettings?.fqdn ?? pip?.ipAddress ?? ""}`,
    };
  }

  // ------------------------------------------------------------------
  // Azure-specific methods (for backward compatibility)
  // ------------------------------------------------------------------

  /**
   * Create an Application Gateway.
   *
   * @param options - Creation options
   * @returns Created Application Gateway resource
   */
  async createAppGateway(options: CreateAppGatewayOptions): Promise<ApplicationGateway> {
    const {
      name,
      subnetId,
      publicIpName,
      gatewayPort,
      backendPoolName = "vmBackendPool",
      healthProbePath = "/health",
      requestTimeout = 60,
      skuName = "Standard_v2",
      skuTier = "Standard_v2",
      capacity = 1,
    } = options;

    // Check if already exists
    try {
      const existing = await this.networkClient.applicationGateways.get(
        this.resourceGroup,
        name
      );
      return existing;
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode !== 404) {
        throw error;
      }
    }

    const gatewayIpConfigName = "appGatewayIpConfig";
    const frontendIpConfigName = "appGatewayFrontendIp";
    const frontendPortName = "appGatewayFrontendPort";
    const backendHttpSettingsName = "vmBackendHttpSettings";
    const httpListenerName = "vmHttpListener";
    const requestRoutingRuleName = "vmRoutingRule";
    const probeName = "vmHealthProbe";

    const publicIpId = `/subscriptions/${this.subscriptionId}/resourceGroups/${this.resourceGroup}/providers/Microsoft.Network/publicIPAddresses/${publicIpName}`;
    const baseResourceId = `/subscriptions/${this.subscriptionId}/resourceGroups/${this.resourceGroup}/providers/Microsoft.Network/applicationGateways/${name}`;

    const result = await this.networkClient.applicationGateways.beginCreateOrUpdateAndWait(
      this.resourceGroup,
      name,
      {
        location: this.location,
        sku: {
          name: skuName,
          tier: skuTier,
          capacity,
        },
        gatewayIPConfigurations: [
          {
            name: gatewayIpConfigName,
            subnet: { id: subnetId },
          },
        ],
        frontendIPConfigurations: [
          {
            name: frontendIpConfigName,
            publicIPAddress: {
              id: publicIpId,
            },
          },
        ],
        frontendPorts: [
          {
            name: frontendPortName,
            port: 80,
          },
        ],
        backendAddressPools: [
          {
            name: backendPoolName,
            backendAddresses: [],
          },
        ],
        probes: [
          {
            name: probeName,
            protocol: "Http",
            path: healthProbePath,
            interval: 30,
            timeout: 30,
            unhealthyThreshold: 3,
            pickHostNameFromBackendHttpSettings: true,
          },
        ],
        backendHttpSettingsCollection: [
          {
            name: backendHttpSettingsName,
            port: gatewayPort,
            protocol: "Http",
            cookieBasedAffinity: "Disabled",
            requestTimeout,
            probe: {
              id: `${baseResourceId}/probes/${probeName}`,
            },
          },
        ],
        httpListeners: [
          {
            name: httpListenerName,
            frontendIPConfiguration: {
              id: `${baseResourceId}/frontendIPConfigurations/${frontendIpConfigName}`,
            },
            frontendPort: {
              id: `${baseResourceId}/frontendPorts/${frontendPortName}`,
            },
            protocol: "Http",
          },
        ],
        requestRoutingRules: [
          {
            name: requestRoutingRuleName,
            ruleType: "Basic",
            priority: 100,
            httpListener: {
              id: `${baseResourceId}/httpListeners/${httpListenerName}`,
            },
            backendAddressPool: {
              id: `${baseResourceId}/backendAddressPools/${backendPoolName}`,
            },
            backendHttpSettings: {
              id: `${baseResourceId}/backendHttpSettingsCollection/${backendHttpSettingsName}`,
            },
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
   * Delete an Application Gateway.
   *
   * @param name - Application Gateway name
   */
  async deleteAppGateway(name: string): Promise<void> {
    try {
      await this.networkClient.applicationGateways.beginDeleteAndWait(
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
   * Get the Application Gateway's public endpoint information.
   *
   * @param publicIpName - Public IP name associated with the gateway
   * @returns Gateway endpoint info (IP and FQDN)
   */
  async getGatewayEndpoint(publicIpName: string): Promise<GatewayEndpointInfo> {
    const pip = await this.publicIpService.getPublicIp(publicIpName);
    return {
      publicIp: pip?.ipAddress || "",
      fqdn: pip?.dnsSettings?.fqdn || "",
    };
  }

  /**
   * Get Application Gateway information.
   *
   * @param name - Application Gateway name
   * @returns Application Gateway resource or undefined if not found
   */
  async getAppGateway(name: string): Promise<ApplicationGateway | undefined> {
    try {
      return await this.networkClient.applicationGateways.get(
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
   * Ensure a static public IP exists for the Application Gateway.
   * Delegated to PublicIpService.
   *
   * @param name - Public IP name
   * @param dnsLabel - DNS label for FQDN
   * @returns IP address and FQDN
   */
  async ensurePublicIp(
    name: string,
    dnsLabel: string
  ): Promise<{ ipAddress: string; fqdn: string }> {
    return this.publicIpService.ensurePublicIp(name, dnsLabel);
  }

  /**
   * Delete a public IP address.
   * Delegated to PublicIpService.
   *
   * @param name - Public IP name
   */
  async deletePublicIp(name: string): Promise<void> {
    return this.publicIpService.deletePublicIp(name);
  }

  /**
   * Delete a subnet.
   * Delegated to SubnetService.
   *
   * @param vnetName - VNet name
   * @param subnetName - Subnet name
   */
  async deleteSubnet(vnetName: string, subnetName: string): Promise<void> {
    return this.subnetService.deleteSubnet(vnetName, subnetName);
  }
}
