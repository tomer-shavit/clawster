import { ContainerInstanceManagementClient } from "@azure/arm-containerinstance";
import { NetworkManagementClient } from "@azure/arm-network";
import { DefaultAzureCredential, ClientSecretCredential, TokenCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { LogsQueryClient } from "@azure/monitor-query";
import {
  DeploymentTarget,
  DeploymentTargetType,
  InstallOptions,
  InstallResult,
  OpenClawConfigPayload,
  ConfigureResult,
  TargetStatus,
  DeploymentLogOptions,
  GatewayEndpoint,
} from "../../interface/deployment-target";
import type { AciConfig } from "./aci-config";

const DEFAULT_CPU = 1;
const DEFAULT_MEMORY = 2048;
const DEFAULT_VNET_PREFIX = "10.0.0.0/16";
const DEFAULT_ACI_SUBNET_PREFIX = "10.0.1.0/24";
const DEFAULT_APPGW_SUBNET_PREFIX = "10.0.2.0/24";

/**
 * AciTarget manages an OpenClaw gateway instance running on
 * Azure Container Instances (ACI).
 *
 * SECURITY: All deployments use VNet + Application Gateway architecture.
 * Containers are NEVER exposed directly to the internet.
 * External access (for webhooks from Telegram, WhatsApp, etc.) goes through Application Gateway.
 *
 * All deployments include:
 * - VNet with private subnet for containers
 * - Network Security Group with restrictive inbound rules
 * - Application Gateway for secure external access
 * - Optional Key Vault integration for secrets
 */
export class AciTarget implements DeploymentTarget {
  readonly type = DeploymentTargetType.ACI;

  private readonly config: AciConfig;
  private readonly cpu: number;
  private readonly memory: number;
  private readonly credential: TokenCredential;

  private readonly aciClient: ContainerInstanceManagementClient;
  private readonly networkClient: NetworkManagementClient;
  private readonly keyVaultClient?: SecretClient;
  private readonly logsClient?: LogsQueryClient;

  /** Derived resource names - set during install */
  private containerGroupName = "";
  private vnetName = "";
  private subnetName = "";
  private subnetId = "";
  private nsgName = "";
  private secretName = "";
  private gatewayPort = 18789;

  /** Application Gateway resources (for with-gateway tier) */
  private appGatewayName = "";
  private appGatewaySubnetName = "";
  private appGatewaySubnetId = "";
  private appGatewayPublicIpName = "";
  private appGatewayPublicIp = "";
  private appGatewayFqdn = "";

  constructor(config: AciConfig) {
    this.config = config;
    this.cpu = config.cpu ?? DEFAULT_CPU;
    this.memory = (config.memory ?? DEFAULT_MEMORY) / 1024; // Convert MB to GB

    // Derive resource names from profileName if available
    if (config.profileName) {
      const p = this.sanitizeName(config.profileName);
      this.containerGroupName = `clawster-${p}`;
      this.vnetName = config.vnetName ?? `clawster-vnet-${p}`;
      this.subnetName = config.subnetName ?? `clawster-aci-subnet-${p}`;
      this.nsgName = config.nsgName ?? `clawster-nsg-${p}`;
      this.secretName = `clawster-${p}-config`;
    }

    // Use existing subnet ID if provided
    if (config.subnetId) {
      this.subnetId = config.subnetId;
    }

    // Create credential
    if (config.clientId && config.clientSecret && config.tenantId) {
      this.credential = new ClientSecretCredential(
        config.tenantId,
        config.clientId,
        config.clientSecret
      );
    } else {
      this.credential = new DefaultAzureCredential();
    }

    this.aciClient = new ContainerInstanceManagementClient(
      this.credential,
      config.subscriptionId
    );

    this.networkClient = new NetworkManagementClient(
      this.credential,
      config.subscriptionId
    );

    // Initialize Key Vault client if configured
    if (config.keyVaultName) {
      const vaultUrl = `https://${config.keyVaultName}.vault.azure.net`;
      this.keyVaultClient = new SecretClient(vaultUrl, this.credential);
    }

    // Initialize Logs client if Log Analytics is configured
    if (config.logAnalyticsWorkspaceId) {
      this.logsClient = new LogsQueryClient(this.credential);
    }
  }

  // ------------------------------------------------------------------
  // install
  // ------------------------------------------------------------------

  async install(options: InstallOptions): Promise<InstallResult> {
    const profileName = this.sanitizeName(options.profileName);
    this.gatewayPort = options.port;
    this.containerGroupName = `clawster-${profileName}`;
    this.vnetName = this.config.vnetName ?? `clawster-vnet-${profileName}`;
    this.subnetName = this.config.subnetName ?? `clawster-aci-subnet-${profileName}`;
    this.nsgName = this.config.nsgName ?? `clawster-nsg-${profileName}`;
    this.secretName = `clawster-${profileName}-config`;

    // Application Gateway names (for with-gateway tier)
    this.appGatewayName = this.config.appGatewayName ?? `clawster-appgw-${profileName}`;
    this.appGatewaySubnetName = this.config.appGatewaySubnetName ?? `clawster-appgw-subnet-${profileName}`;
    this.appGatewayPublicIpName = `clawster-appgw-pip-${profileName}`;

    try {
      // 1. Set up VNet infrastructure (MANDATORY for all deployments)
      await this.ensureNetworkInfrastructure();

      // 2. Set up Application Gateway for secure external access (webhooks, etc.)
      await this.ensureApplicationGateway();

      // 3. Resolve image
      const imageUri = this.config.image ?? "node:22-slim";

      // 4. Store initial empty config in Key Vault if available
      if (this.keyVaultClient) {
        await this.ensureSecret(this.secretName, "{}");
      }

      // 5. Build environment variables
      const environmentVariables: Array<{ name: string; value?: string; secureValue?: string }> = [
        { name: "OPENCLAW_GATEWAY_PORT", value: String(this.gatewayPort) },
      ];

      // Add gateway auth token if provided
      if (options.gatewayAuthToken) {
        environmentVariables.push({
          name: "OPENCLAW_GATEWAY_TOKEN",
          secureValue: options.gatewayAuthToken,
        });
      }

      // Add container env vars
      for (const [key, value] of Object.entries(options.containerEnv ?? {})) {
        environmentVariables.push({ name: key, value });
      }

      // 6. Build container group configuration
      const containerGroupConfig = this.buildContainerGroupConfig(
        imageUri,
        environmentVariables,
        profileName
      );

      // 7. Create container group
      const result = await this.aciClient.containerGroups.beginCreateOrUpdateAndWait(
        this.config.resourceGroup,
        this.containerGroupName,
        containerGroupConfig
      );

      // 8. Update Application Gateway backend with ACI's private IP
      if (result.ipAddress?.ip) {
        await this.updateAppGatewayBackend(result.ipAddress.ip);
      }

      const externalAccess = this.appGatewayFqdn
        ? ` External access via: http://${this.appGatewayFqdn}`
        : "";
      return {
        success: true,
        instanceId: this.containerGroupName,
        message: `ACI container group "${this.containerGroupName}" created (VNet + App Gateway, secure) in ${this.config.region}.${externalAccess}`,
        serviceName: result.name,
      };
    } catch (error) {
      return {
        success: false,
        instanceId: this.containerGroupName,
        message: `ACI install failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ------------------------------------------------------------------
  // Network Infrastructure (Production Tier)
  // ------------------------------------------------------------------

  private async ensureNetworkInfrastructure(): Promise<void> {
    // 1. Create or get VNet
    await this.ensureVNet();

    // 2. Create or get NSG with secure rules
    await this.ensureNSG();

    // 3. Create or get subnet for ACI with delegation
    await this.ensureAciSubnet();
  }

  private async ensureVNet(): Promise<void> {
    const vnetAddressPrefix = this.config.vnetAddressPrefix ?? DEFAULT_VNET_PREFIX;

    try {
      // Check if VNet exists
      await this.networkClient.virtualNetworks.get(
        this.config.resourceGroup,
        this.vnetName
      );
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        // Create VNet
        await this.networkClient.virtualNetworks.beginCreateOrUpdateAndWait(
          this.config.resourceGroup,
          this.vnetName,
          {
            location: this.config.region,
            addressSpace: {
              addressPrefixes: [vnetAddressPrefix],
            },
            tags: {
              managedBy: "clawster",
            },
          }
        );
      } else {
        throw error;
      }
    }
  }

  private async ensureNSG(): Promise<void> {
    const allowedCidr = this.config.allowedCidr ?? [];

    try {
      await this.networkClient.networkSecurityGroups.get(
        this.config.resourceGroup,
        this.nsgName
      );
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        // Build security rules
        type SecurityRule = {
          name: string;
          priority: number;
          direction: "Inbound" | "Outbound";
          access: "Allow" | "Deny";
          protocol: "*" | "Tcp" | "Udp";
          sourceAddressPrefix: string;
          sourcePortRange: string;
          destinationAddressPrefix: string;
          destinationPortRange: string;
        };
        const securityRules: SecurityRule[] = [
          // Deny all inbound by default (implicit, but explicit for clarity)
          {
            name: "DenyAllInbound",
            priority: 4096,
            direction: "Inbound" as const,
            access: "Deny" as const,
            protocol: "*" as const,
            sourceAddressPrefix: "*",
            sourcePortRange: "*",
            destinationAddressPrefix: "*",
            destinationPortRange: "*",
          },
          // Allow outbound to internet (for npm install, API calls)
          {
            name: "AllowInternetOutbound",
            priority: 100,
            direction: "Outbound" as const,
            access: "Allow" as const,
            protocol: "*" as const,
            sourceAddressPrefix: "*",
            sourcePortRange: "*",
            destinationAddressPrefix: "Internet",
            destinationPortRange: "*",
          },
          // Allow Azure Load Balancer health probes
          {
            name: "AllowAzureLoadBalancer",
            priority: 100,
            direction: "Inbound" as const,
            access: "Allow" as const,
            protocol: "*" as const,
            sourceAddressPrefix: "AzureLoadBalancer",
            sourcePortRange: "*",
            destinationAddressPrefix: "*",
            destinationPortRange: "*",
          },
          // Allow VNet internal traffic
          {
            name: "AllowVNetInbound",
            priority: 200,
            direction: "Inbound" as const,
            access: "Allow" as const,
            protocol: "*" as const,
            sourceAddressPrefix: "VirtualNetwork",
            sourcePortRange: "*",
            destinationAddressPrefix: "VirtualNetwork",
            destinationPortRange: "*",
          },
        ];

        // Add rules for allowed CIDRs to access gateway port
        let priority = 300;
        for (const cidr of allowedCidr) {
          securityRules.push({
            name: `AllowGateway-${priority}`,
            priority,
            direction: "Inbound" as const,
            access: "Allow" as const,
            protocol: "Tcp" as const,
            sourceAddressPrefix: cidr,
            sourcePortRange: "*",
            destinationAddressPrefix: "*",
            destinationPortRange: String(this.gatewayPort),
          });
          priority += 10;
        }

        // Create NSG
        await this.networkClient.networkSecurityGroups.beginCreateOrUpdateAndWait(
          this.config.resourceGroup,
          this.nsgName,
          {
            location: this.config.region,
            securityRules,
            tags: {
              managedBy: "clawster",
            },
          }
        );
      } else {
        throw error;
      }
    }
  }

  private async ensureAciSubnet(): Promise<void> {
    const subnetAddressPrefix = this.config.subnetAddressPrefix ?? DEFAULT_ACI_SUBNET_PREFIX;

    // Get NSG ID
    const nsg = await this.networkClient.networkSecurityGroups.get(
      this.config.resourceGroup,
      this.nsgName
    );

    try {
      const subnet = await this.networkClient.subnets.get(
        this.config.resourceGroup,
        this.vnetName,
        this.subnetName
      );
      this.subnetId = subnet.id!;
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        // Create subnet with ACI delegation
        const subnet = await this.networkClient.subnets.beginCreateOrUpdateAndWait(
          this.config.resourceGroup,
          this.vnetName,
          this.subnetName,
          {
            addressPrefix: subnetAddressPrefix,
            networkSecurityGroup: {
              id: nsg.id,
            },
            delegations: [
              {
                name: "aciDelegation",
                serviceName: "Microsoft.ContainerInstance/containerGroups",
              },
            ],
          }
        );
        this.subnetId = subnet.id!;
      } else {
        throw error;
      }
    }
  }

  // ------------------------------------------------------------------
  // Application Gateway (for with-gateway tier)
  // ------------------------------------------------------------------

  private async ensureApplicationGateway(): Promise<void> {
    // 1. Create Application Gateway subnet (separate from ACI subnet, no delegations)
    await this.ensureAppGatewaySubnet();

    // 2. Create public IP for Application Gateway
    await this.ensureAppGatewayPublicIp();

    // 3. Wait for ACI container to be ready (need its private IP for backend)
    // Note: Container group is created after this, so we'll use a placeholder
    // and update the backend pool after container creation

    // 4. Create Application Gateway
    await this.createApplicationGateway();
  }

  private async ensureAppGatewaySubnet(): Promise<void> {
    const subnetAddressPrefix = this.config.appGatewaySubnetAddressPrefix ?? DEFAULT_APPGW_SUBNET_PREFIX;

    try {
      const subnet = await this.networkClient.subnets.get(
        this.config.resourceGroup,
        this.vnetName,
        this.appGatewaySubnetName
      );
      this.appGatewaySubnetId = subnet.id!;
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        // Create subnet for Application Gateway (NO delegations - App Gateway doesn't support them)
        const subnet = await this.networkClient.subnets.beginCreateOrUpdateAndWait(
          this.config.resourceGroup,
          this.vnetName,
          this.appGatewaySubnetName,
          {
            addressPrefix: subnetAddressPrefix,
            // Application Gateway subnet must NOT have delegations or NSG attached directly
          }
        );
        this.appGatewaySubnetId = subnet.id!;
      } else {
        throw error;
      }
    }
  }

  private async ensureAppGatewayPublicIp(): Promise<void> {
    try {
      const pip = await this.networkClient.publicIPAddresses.get(
        this.config.resourceGroup,
        this.appGatewayPublicIpName
      );
      this.appGatewayPublicIp = pip.ipAddress || "";
      this.appGatewayFqdn = pip.dnsSettings?.fqdn || "";
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        // Create public IP for Application Gateway (must be Standard SKU for v2)
        const pip = await this.networkClient.publicIPAddresses.beginCreateOrUpdateAndWait(
          this.config.resourceGroup,
          this.appGatewayPublicIpName,
          {
            location: this.config.region,
            sku: { name: "Standard" },
            publicIPAllocationMethod: "Static",
            dnsSettings: {
              domainNameLabel: this.appGatewayName.toLowerCase().replace(/[^a-z0-9-]/g, ""),
            },
            tags: {
              managedBy: "clawster",
            },
          }
        );
        this.appGatewayPublicIp = pip.ipAddress || "";
        this.appGatewayFqdn = pip.dnsSettings?.fqdn || "";
      } else {
        throw error;
      }
    }
  }

  private async createApplicationGateway(): Promise<void> {
    try {
      // Check if Application Gateway already exists
      const existingGw = await this.networkClient.applicationGateways.get(
        this.config.resourceGroup,
        this.appGatewayName
      );
      // Already exists, store the frontend IP info
      if (existingGw.frontendIPConfigurations?.[0]?.publicIPAddress?.id) {
        const pip = await this.networkClient.publicIPAddresses.get(
          this.config.resourceGroup,
          this.appGatewayPublicIpName
        );
        this.appGatewayPublicIp = pip.ipAddress || "";
        this.appGatewayFqdn = pip.dnsSettings?.fqdn || "";
      }
      return;
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode !== 404) {
        throw error;
      }
    }

    // Create Application Gateway v2 (Standard_v2 SKU)
    // Initially create with a placeholder backend - will be updated after ACI is created
    const subscriptionId = this.config.subscriptionId;
    const resourceGroup = this.config.resourceGroup;
    const gatewayIpConfigName = "appGatewayIpConfig";
    const frontendIpConfigName = "appGatewayFrontendIp";
    const frontendPortName = "appGatewayFrontendPort";
    const backendPoolName = "aciBackendPool";
    const backendHttpSettingsName = "aciBackendHttpSettings";
    const httpListenerName = "aciHttpListener";
    const requestRoutingRuleName = "aciRoutingRule";
    const probeName = "aciHealthProbe";

    await this.networkClient.applicationGateways.beginCreateOrUpdateAndWait(
      resourceGroup,
      this.appGatewayName,
      {
        location: this.config.region,
        sku: {
          name: "Standard_v2",
          tier: "Standard_v2",
          capacity: 1, // Minimum capacity for cost savings
        },
        gatewayIPConfigurations: [
          {
            name: gatewayIpConfigName,
            subnet: { id: this.appGatewaySubnetId },
          },
        ],
        frontendIPConfigurations: [
          {
            name: frontendIpConfigName,
            publicIPAddress: {
              id: `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/publicIPAddresses/${this.appGatewayPublicIpName}`,
            },
          },
        ],
        frontendPorts: [
          {
            name: frontendPortName,
            port: 80, // HTTP for now, can add HTTPS with SSL cert
          },
        ],
        backendAddressPools: [
          {
            name: backendPoolName,
            // Backend addresses will be updated after ACI is created
            backendAddresses: [],
          },
        ],
        probes: [
          {
            name: probeName,
            protocol: "Http",
            path: "/health", // OpenClaw gateway health endpoint
            interval: 30,
            timeout: 30,
            unhealthyThreshold: 3,
            pickHostNameFromBackendHttpSettings: true,
          },
        ],
        backendHttpSettingsCollection: [
          {
            name: backendHttpSettingsName,
            port: this.gatewayPort,
            protocol: "Http",
            cookieBasedAffinity: "Disabled",
            requestTimeout: 60,
            probe: {
              id: `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/applicationGateways/${this.appGatewayName}/probes/${probeName}`,
            },
          },
        ],
        httpListeners: [
          {
            name: httpListenerName,
            frontendIPConfiguration: {
              id: `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/applicationGateways/${this.appGatewayName}/frontendIPConfigurations/${frontendIpConfigName}`,
            },
            frontendPort: {
              id: `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/applicationGateways/${this.appGatewayName}/frontendPorts/${frontendPortName}`,
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
              id: `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/applicationGateways/${this.appGatewayName}/httpListeners/${httpListenerName}`,
            },
            backendAddressPool: {
              id: `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/applicationGateways/${this.appGatewayName}/backendAddressPools/${backendPoolName}`,
            },
            backendHttpSettings: {
              id: `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/applicationGateways/${this.appGatewayName}/backendHttpSettingsCollection/${backendHttpSettingsName}`,
            },
          },
        ],
        tags: {
          managedBy: "clawster",
        },
      }
    );
  }

  /**
   * Update Application Gateway backend pool with ACI private IP.
   * Called after container group is created and has a private IP.
   */
  private async updateAppGatewayBackend(aciPrivateIp: string): Promise<void> {
    try {
      const appGw = await this.networkClient.applicationGateways.get(
        this.config.resourceGroup,
        this.appGatewayName
      );

      // Update backend pool with ACI's private IP
      if (appGw.backendAddressPools?.[0]) {
        appGw.backendAddressPools[0].backendAddresses = [
          { ipAddress: aciPrivateIp },
        ];
      }

      await this.networkClient.applicationGateways.beginCreateOrUpdateAndWait(
        this.config.resourceGroup,
        this.appGatewayName,
        appGw
      );
    } catch (error) {
      console.warn(`Failed to update Application Gateway backend: ${error}`);
      // Non-fatal - gateway still works, just may have stale backend
    }
  }

  // ------------------------------------------------------------------
  // Container Group Configuration
  // ------------------------------------------------------------------

  private buildContainerGroupConfig(
    imageUri: string,
    environmentVariables: Array<{ name: string; value?: string; secureValue?: string }>,
    profileName: string
  ) {
    const baseConfig = {
      location: this.config.region,
      containers: [
        {
          name: "openclaw",
          image: imageUri,
          resources: {
            requests: {
              cpu: this.cpu,
              memoryInGB: this.memory,
            },
          },
          environmentVariables,
          ports: [{ port: this.gatewayPort, protocol: "TCP" as const }],
          command: [
            "/bin/sh",
            "-c",
            `mkdir -p ~/.openclaw && echo "$OPENCLAW_CONFIG" > ~/.openclaw/openclaw.json && npx -y openclaw@latest gateway --port ${this.gatewayPort} --verbose`,
          ],
        },
      ],
      osType: "Linux" as const,
      restartPolicy: "Always" as const,
      tags: {
        managedBy: "clawster",
        profile: profileName,
        architecture: "vnet-appgateway",
      },
      ...(this.config.logAnalyticsWorkspaceId && this.config.logAnalyticsWorkspaceKey
        ? {
            diagnostics: {
              logAnalytics: {
                workspaceId: this.config.logAnalyticsWorkspaceId,
                workspaceKey: this.config.logAnalyticsWorkspaceKey,
              },
            },
          }
        : {}),
    };

    // SECURITY: ALL deployments use VNet with private IP - no public IP option
    if (!this.subnetId) {
      throw new Error("VNet subnet is required for ACI deployment (security requirement)");
    }

    return {
      ...baseConfig,
      subnetIds: [{ id: this.subnetId }],
      // No public IP - containers must be accessed via VPN/ExpressRoute/bastion
      // or through Application Gateway (with-gateway tier)
    };
  }

  // ------------------------------------------------------------------
  // configure
  // ------------------------------------------------------------------

  async configure(config: OpenClawConfigPayload): Promise<ConfigureResult> {
    const profileName = this.sanitizeName(config.profileName);
    this.gatewayPort = config.gatewayPort;

    if (!this.containerGroupName) {
      this.containerGroupName = `clawster-${profileName}`;
      this.secretName = `clawster-${profileName}-config`;
    }

    // Apply config transformations (same as ECS/Docker targets)
    const raw = { ...config.config } as Record<string, unknown>;

    // gateway.bind = "lan" - containers MUST bind to 0.0.0.0
    if (raw.gateway && typeof raw.gateway === "object") {
      const gw = { ...(raw.gateway as Record<string, unknown>) };
      gw.bind = "lan";
      delete gw.host;
      delete gw.port;
      raw.gateway = gw;
    }

    // skills.allowUnverified is not a valid OpenClaw key
    if (raw.skills && typeof raw.skills === "object") {
      const skills = { ...(raw.skills as Record<string, unknown>) };
      delete skills.allowUnverified;
      raw.skills = skills;
    }

    // sandbox at root level -> agents.defaults.sandbox
    if ("sandbox" in raw) {
      const agents = (raw.agents as Record<string, unknown>) || {};
      const defaults = (agents.defaults as Record<string, unknown>) || {};
      defaults.sandbox = raw.sandbox;
      agents.defaults = defaults;
      raw.agents = agents;
      delete raw.sandbox;
    }

    // channels.*.enabled is not valid - presence means active
    if (raw.channels && typeof raw.channels === "object") {
      for (const [key, value] of Object.entries(raw.channels as Record<string, unknown>)) {
        if (value && typeof value === "object" && "enabled" in (value as Record<string, unknown>)) {
          const { enabled: _enabled, ...rest } = value as Record<string, unknown>;
          (raw.channels as Record<string, unknown>)[key] = rest;
        }
      }
    }

    const configData = JSON.stringify(raw, null, 2);

    try {
      // Store config in Key Vault if available
      if (this.keyVaultClient) {
        await this.ensureSecret(this.secretName, configData);
      }

      // Update container group with new OPENCLAW_CONFIG env var
      const existing = await this.aciClient.containerGroups.get(
        this.config.resourceGroup,
        this.containerGroupName
      );

      if (!existing.containers?.[0]) {
        throw new Error("Container group has no containers");
      }

      // Update the OPENCLAW_CONFIG environment variable
      const envVars = existing.containers[0].environmentVariables || [];
      const configEnvIndex = envVars.findIndex((e) => e.name === "OPENCLAW_CONFIG");

      if (configEnvIndex >= 0) {
        envVars[configEnvIndex] = { name: "OPENCLAW_CONFIG", secureValue: configData };
      } else {
        envVars.push({ name: "OPENCLAW_CONFIG", secureValue: configData });
      }

      existing.containers[0].environmentVariables = envVars;

      await this.aciClient.containerGroups.beginCreateOrUpdateAndWait(
        this.config.resourceGroup,
        this.containerGroupName,
        existing
      );

      return {
        success: true,
        message: `Configuration applied to container group "${this.containerGroupName}"`,
        requiresRestart: true,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to configure: ${error instanceof Error ? error.message : String(error)}`,
        requiresRestart: false,
      };
    }
  }

  // ------------------------------------------------------------------
  // start
  // ------------------------------------------------------------------

  async start(): Promise<void> {
    await this.aciClient.containerGroups.beginStartAndWait(
      this.config.resourceGroup,
      this.containerGroupName
    );
  }

  // ------------------------------------------------------------------
  // stop
  // ------------------------------------------------------------------

  async stop(): Promise<void> {
    await this.aciClient.containerGroups.stop(
      this.config.resourceGroup,
      this.containerGroupName
    );
  }

  // ------------------------------------------------------------------
  // restart
  // ------------------------------------------------------------------

  async restart(): Promise<void> {
    await this.aciClient.containerGroups.beginRestartAndWait(
      this.config.resourceGroup,
      this.containerGroupName
    );
  }

  // ------------------------------------------------------------------
  // getStatus
  // ------------------------------------------------------------------

  async getStatus(): Promise<TargetStatus> {
    try {
      const group = await this.aciClient.containerGroups.get(
        this.config.resourceGroup,
        this.containerGroupName
      );

      const container = group.containers?.[0];
      const instanceView = container?.instanceView;
      const provisioningState = group.provisioningState || "Unknown";
      const containerState = instanceView?.currentState?.state || "Unknown";

      let state: TargetStatus["state"];
      if (containerState === "Running" && provisioningState === "Succeeded") {
        state = "running";
      } else if (containerState === "Terminated" || provisioningState === "Stopped") {
        state = "stopped";
      } else if (provisioningState === "Failed") {
        state = "error";
      } else {
        state = "stopped";
      }

      return {
        state,
        gatewayPort: this.gatewayPort,
        error: state === "error"
          ? `Provisioning: ${provisioningState}, Container: ${containerState}`
          : undefined,
      };
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        return { state: "not-installed" };
      }
      return {
        state: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ------------------------------------------------------------------
  // getLogs
  // ------------------------------------------------------------------

  async getLogs(options?: DeploymentLogOptions): Promise<string[]> {
    try {
      // Try ACI container logs first
      const logs = await this.aciClient.containers.listLogs(
        this.config.resourceGroup,
        this.containerGroupName,
        "openclaw",
        { tail: options?.lines }
      );

      let lines = (logs.content || "").split("\n");

      if (options?.filter) {
        try {
          const pattern = new RegExp(options.filter, "i");
          lines = lines.filter((line) => pattern.test(line));
        } catch {
          const literal = options.filter.toLowerCase();
          lines = lines.filter((line) => line.toLowerCase().includes(literal));
        }
      }

      return lines;
    } catch {
      // Fallback to Log Analytics if configured
      if (this.logsClient && this.config.logAnalyticsWorkspaceId) {
        return this.getLogsFromAnalytics(options);
      }
      return [];
    }
  }

  private async getLogsFromAnalytics(options?: DeploymentLogOptions): Promise<string[]> {
    if (!this.logsClient || !this.config.logAnalyticsWorkspaceId) {
      return [];
    }

    const limit = options?.lines || 100;
    const query = `ContainerInstanceLog_CL | where ContainerGroup_s == "${this.containerGroupName}" | take ${limit} | project TimeGenerated, Message`;

    try {
      const result = await this.logsClient.queryWorkspace(
        this.config.logAnalyticsWorkspaceId,
        query,
        { duration: "P1D" }
      );

      const lines: string[] = [];
      const tables = (result as { tables?: Array<{ rows?: unknown[][] }> }).tables;
      if (tables && tables[0]?.rows) {
        for (const row of tables[0].rows) {
          lines.push(row[1] as string);
        }
      }
      return lines;
    } catch {
      return [];
    }
  }

  // ------------------------------------------------------------------
  // getEndpoint
  // ------------------------------------------------------------------

  async getEndpoint(): Promise<GatewayEndpoint> {
    // Always return the Application Gateway's public endpoint (secure architecture)
    // Try to get Application Gateway info if not already cached
    if (!this.appGatewayFqdn && !this.appGatewayPublicIp) {
      try {
        const pip = await this.networkClient.publicIPAddresses.get(
          this.config.resourceGroup,
          this.appGatewayPublicIpName
        );
        this.appGatewayPublicIp = pip.ipAddress || "";
        this.appGatewayFqdn = pip.dnsSettings?.fqdn || "";
      } catch {
        throw new Error("Application Gateway public IP not found");
      }
    }

    const host = this.appGatewayFqdn || this.appGatewayPublicIp;
    if (!host) {
      throw new Error("Application Gateway endpoint not available");
    }

    return {
      host,
      port: 80, // Application Gateway frontend port
      protocol: "ws",
    };
  }

  // ------------------------------------------------------------------
  // destroy
  // ------------------------------------------------------------------

  async destroy(): Promise<void> {
    // 1. Delete container group
    try {
      await this.aciClient.containerGroups.beginDeleteAndWait(
        this.config.resourceGroup,
        this.containerGroupName
      );
    } catch {
      // Container group may not exist
    }

    // 2. Delete Key Vault secrets if configured
    if (this.keyVaultClient) {
      try {
        await this.keyVaultClient.beginDeleteSecret(this.secretName);
      } catch {
        // Secret may not exist
      }
    }

    // 3. Delete Application Gateway resources
    // Delete Application Gateway first (depends on public IP and subnet)
    try {
      await this.networkClient.applicationGateways.beginDeleteAndWait(
        this.config.resourceGroup,
        this.appGatewayName
      );
    } catch {
      // Application Gateway may not exist
    }

    // Delete public IP
    try {
      await this.networkClient.publicIPAddresses.beginDeleteAndWait(
        this.config.resourceGroup,
        this.appGatewayPublicIpName
      );
    } catch {
      // Public IP may not exist
    }

    // Delete Application Gateway subnet
    try {
      await this.networkClient.subnets.beginDeleteAndWait(
        this.config.resourceGroup,
        this.vnetName,
        this.appGatewaySubnetName
      );
    } catch {
      // Subnet may not exist
    }

    // 4. VNet, ACI subnet, and NSG are NOT deleted by default to allow reuse
    // They can be manually cleaned up or a separate cleanup method can be added
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private async ensureSecret(name: string, value: string): Promise<void> {
    if (!this.keyVaultClient) return;

    try {
      await this.keyVaultClient.setSecret(name, value);
    } catch (error) {
      // Ignore errors - Key Vault may not be configured
      console.warn(`Failed to store secret in Key Vault: ${error}`);
    }
  }

  private sanitizeName(name: string): string {
    // Azure container group names: lowercase, alphanumeric and hyphens, max 63 chars
    const sanitized = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 63);

    if (!sanitized) {
      throw new Error(`Invalid name: "${name}" produces empty sanitized value`);
    }
    return sanitized;
  }
}
