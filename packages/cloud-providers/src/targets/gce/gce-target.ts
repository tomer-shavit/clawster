import {
  InstancesClient,
  DisksClient,
  NetworksClient,
  SubnetworksClient,
  FirewallsClient,
  GlobalAddressesClient,
  BackendServicesClient,
  UrlMapsClient,
  TargetHttpProxiesClient,
  TargetHttpsProxiesClient,
  GlobalForwardingRulesClient,
  InstanceGroupsClient,
  SecurityPoliciesClient,
  GlobalOperationsClient,
  ZoneOperationsClient,
  RegionOperationsClient,
} from "@google-cloud/compute";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { Logging } from "@google-cloud/logging";
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
import type { GceConfig } from "./gce-config";

const DEFAULT_MACHINE_TYPE = "e2-small";
const DEFAULT_BOOT_DISK_SIZE_GB = 20;
const DEFAULT_DATA_DISK_SIZE_GB = 10;
const OPERATION_POLL_INTERVAL_MS = 5_000;
const OPERATION_TIMEOUT_MS = 600_000; // 10 minutes

/**
 * GceTarget manages an OpenClaw gateway instance running on
 * Google Compute Engine VM.
 *
 * ARCHITECTURE: VM-based deployment with full Docker support.
 * Unlike Cloud Run, Compute Engine provides:
 * - Persistent Disk for WhatsApp sessions (survives restarts)
 * - Full Docker daemon access for sandbox mode (Docker-in-Docker)
 * - No cold starts - VM is always running
 * - State survives VM restarts
 *
 * Security:
 *   Internet -> External LB -> Instance Group NEG -> GCE VM (firewall-protected)
 *                                                       |
 *                                                 Persistent Disk
 */
export class GceTarget implements DeploymentTarget {
  readonly type = DeploymentTargetType.GCE;

  private readonly config: GceConfig;
  private readonly machineType: string;
  private readonly bootDiskSizeGb: number;
  private readonly dataDiskSizeGb: number;

  // GCP clients
  private readonly instancesClient: InstancesClient;
  private readonly disksClient: DisksClient;
  private readonly networksClient: NetworksClient;
  private readonly subnetworksClient: SubnetworksClient;
  private readonly firewallsClient: FirewallsClient;
  private readonly addressesClient: GlobalAddressesClient;
  private readonly backendServicesClient: BackendServicesClient;
  private readonly urlMapsClient: UrlMapsClient;
  private readonly httpProxiesClient: TargetHttpProxiesClient;
  private readonly httpsProxiesClient: TargetHttpsProxiesClient;
  private readonly forwardingRulesClient: GlobalForwardingRulesClient;
  private readonly instanceGroupsClient: InstanceGroupsClient;
  private readonly securityPoliciesClient: SecurityPoliciesClient;
  private readonly globalOperationsClient: GlobalOperationsClient;
  private readonly zoneOperationsClient: ZoneOperationsClient;
  private readonly regionOperationsClient: RegionOperationsClient;
  private readonly secretClient: SecretManagerServiceClient;
  private readonly logging: Logging;

  /** Derived resource names - set during install */
  private instanceName = "";
  private dataDiskName = "";
  private secretName = "";
  private vpcNetworkName = "";
  private subnetName = "";
  private firewallName = "";
  private externalIpName = "";
  private instanceGroupName = "";
  private backendServiceName = "";
  private urlMapName = "";
  private httpProxyName = "";
  private httpsProxyName = "";
  private forwardingRuleName = "";
  private securityPolicyName = "";
  private gatewayPort = 18789;

  /** Cached external IP for getEndpoint */
  private cachedExternalIp = "";

  constructor(config: GceConfig) {
    this.config = config;
    this.machineType = config.machineType ?? DEFAULT_MACHINE_TYPE;
    this.bootDiskSizeGb = config.bootDiskSizeGb ?? DEFAULT_BOOT_DISK_SIZE_GB;
    this.dataDiskSizeGb = config.dataDiskSizeGb ?? DEFAULT_DATA_DISK_SIZE_GB;

    // GCP client options
    const clientOptions = config.keyFilePath
      ? { keyFilename: config.keyFilePath }
      : {};

    // Initialize GCP clients
    this.instancesClient = new InstancesClient(clientOptions);
    this.disksClient = new DisksClient(clientOptions);
    this.networksClient = new NetworksClient(clientOptions);
    this.subnetworksClient = new SubnetworksClient(clientOptions);
    this.firewallsClient = new FirewallsClient(clientOptions);
    this.addressesClient = new GlobalAddressesClient(clientOptions);
    this.backendServicesClient = new BackendServicesClient(clientOptions);
    this.urlMapsClient = new UrlMapsClient(clientOptions);
    this.httpProxiesClient = new TargetHttpProxiesClient(clientOptions);
    this.httpsProxiesClient = new TargetHttpsProxiesClient(clientOptions);
    this.forwardingRulesClient = new GlobalForwardingRulesClient(clientOptions);
    this.instanceGroupsClient = new InstanceGroupsClient(clientOptions);
    this.securityPoliciesClient = new SecurityPoliciesClient(clientOptions);
    this.globalOperationsClient = new GlobalOperationsClient(clientOptions);
    this.zoneOperationsClient = new ZoneOperationsClient(clientOptions);
    this.regionOperationsClient = new RegionOperationsClient(clientOptions);
    this.secretClient = new SecretManagerServiceClient(clientOptions);
    this.logging = new Logging({
      projectId: config.projectId,
      ...clientOptions,
    });

    // Derive resource names from profileName if available (for re-instantiation)
    if (config.profileName) {
      this.deriveResourceNames(config.profileName);
    }
  }

  private deriveResourceNames(profileName: string): void {
    const sanitized = this.sanitizeName(profileName);
    this.instanceName = `clawster-${sanitized}`;
    this.dataDiskName = `clawster-data-${sanitized}`;
    this.secretName = `clawster-${sanitized}-config`;
    this.vpcNetworkName = this.config.vpcNetworkName ?? `clawster-vpc-${sanitized}`;
    this.subnetName = this.config.subnetName ?? `clawster-subnet-${sanitized}`;
    this.firewallName = `clawster-fw-${sanitized}`;
    this.externalIpName = this.config.externalIpName ?? `clawster-ip-${sanitized}`;
    this.instanceGroupName = `clawster-ig-${sanitized}`;
    this.backendServiceName = `clawster-backend-${sanitized}`;
    this.urlMapName = `clawster-urlmap-${sanitized}`;
    this.httpProxyName = `clawster-http-proxy-${sanitized}`;
    this.httpsProxyName = `clawster-https-proxy-${sanitized}`;
    this.forwardingRuleName = `clawster-fwd-${sanitized}`;
    this.securityPolicyName = `clawster-security-${sanitized}`;
  }

  /**
   * Sanitize name for GCP resources.
   * Must be lowercase, start with a letter, contain only letters, numbers, hyphens.
   * Max 63 characters.
   */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^[^a-z]/, "a")
      .replace(/-+/g, "-")
      .replace(/-$/, "")
      .slice(0, 63);
  }

  /** Extract region from zone (e.g., "us-central1-a" -> "us-central1") */
  private get region(): string {
    const parts = this.config.zone.split("-");
    return parts.slice(0, -1).join("-");
  }

  // ------------------------------------------------------------------
  // install
  // ------------------------------------------------------------------

  async install(options: InstallOptions): Promise<InstallResult> {
    const profileName = options.profileName;
    this.gatewayPort = options.port;
    this.deriveResourceNames(profileName);

    try {
      // 1. Create Secret Manager secret (empty initially, configure() fills it)
      await this.ensureSecret(this.secretName, "{}");

      // 2. Create VPC Network (if it doesn't exist)
      await this.ensureVpcNetwork();

      // 3. Create Subnet
      await this.ensureSubnet();

      // 4. Create Firewall rules
      await this.ensureFirewall();

      // 5. Reserve external IP address
      await this.ensureExternalIp();

      // 6. Create Persistent Disk for data
      await this.ensureDataDisk();

      // 7. Create VM instance with Container-Optimized OS
      await this.createVmInstance(options);

      // 8. Create unmanaged instance group for load balancer
      await this.ensureInstanceGroup();

      // 9. Create Cloud Armor security policy (if allowedCidr configured)
      if (this.config.allowedCidr && this.config.allowedCidr.length > 0) {
        await this.ensureSecurityPolicy();
      }

      // 10. Create Backend Service with instance group
      await this.ensureBackendService();

      // 11. Create URL Map
      await this.ensureUrlMap();

      // 12. Create HTTP(S) Proxy
      await this.ensureHttpProxy();

      // 13. Create Forwarding Rule
      await this.ensureForwardingRule();

      return {
        success: true,
        instanceId: this.instanceName,
        message: `GCE VM "${this.instanceName}" created (VPC + External LB, persistent disk) in ${this.config.zone}`,
        serviceName: this.instanceName,
      };
    } catch (error) {
      return {
        success: false,
        instanceId: this.instanceName,
        message: `GCE install failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ------------------------------------------------------------------
  // configure
  // ------------------------------------------------------------------

  async configure(config: OpenClawConfigPayload): Promise<ConfigureResult> {
    const profileName = config.profileName;
    this.gatewayPort = config.gatewayPort;

    if (!this.secretName) {
      this.deriveResourceNames(profileName);
    }

    // Apply the same config transformations as other deployment targets
    const raw = { ...config.config } as Record<string, unknown>;

    // gateway.bind = "lan" - container MUST bind to 0.0.0.0
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
      // Store config in Secret Manager (backup)
      await this.ensureSecret(this.secretName, configData);

      // Update VM instance metadata with new config
      await this.updateVmMetadata(configData);

      return {
        success: true,
        message: `Configuration stored in Secret Manager as "${this.secretName}" and applied to VM metadata`,
        requiresRestart: true,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to store config: ${error instanceof Error ? error.message : String(error)}`,
        requiresRestart: false,
      };
    }
  }

  // ------------------------------------------------------------------
  // start
  // ------------------------------------------------------------------

  async start(): Promise<void> {
    const [operation] = await this.instancesClient.start({
      project: this.config.projectId,
      zone: this.config.zone,
      instance: this.instanceName,
    });

    await this.waitForZoneOperation(operation);
  }

  // ------------------------------------------------------------------
  // stop
  // ------------------------------------------------------------------

  async stop(): Promise<void> {
    const [operation] = await this.instancesClient.stop({
      project: this.config.projectId,
      zone: this.config.zone,
      instance: this.instanceName,
    });

    await this.waitForZoneOperation(operation);
  }

  // ------------------------------------------------------------------
  // restart
  // ------------------------------------------------------------------

  async restart(): Promise<void> {
    const [operation] = await this.instancesClient.reset({
      project: this.config.projectId,
      zone: this.config.zone,
      instance: this.instanceName,
    });

    await this.waitForZoneOperation(operation);
  }

  // ------------------------------------------------------------------
  // getStatus
  // ------------------------------------------------------------------

  async getStatus(): Promise<TargetStatus> {
    try {
      const [instance] = await this.instancesClient.get({
        project: this.config.projectId,
        zone: this.config.zone,
        instance: this.instanceName,
      });

      let state: TargetStatus["state"];
      let error: string | undefined;

      switch (instance.status) {
        case "RUNNING":
          state = "running";
          break;
        case "STOPPED":
        case "TERMINATED":
          state = "stopped";
          break;
        case "STAGING":
        case "PROVISIONING":
        case "SUSPENDING":
        case "SUSPENDED":
        case "REPAIRING":
          state = "running"; // Transitional states
          break;
        default:
          state = "error";
          error = `Unknown VM status: ${instance.status}`;
      }

      return {
        state,
        gatewayPort: this.gatewayPort,
        error,
      };
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes("NOT_FOUND") || error.message.includes("404"))
      ) {
        return { state: "not-installed" };
      }
      return { state: "error", error: String(error) };
    }
  }

  // ------------------------------------------------------------------
  // getLogs
  // ------------------------------------------------------------------

  async getLogs(options?: DeploymentLogOptions): Promise<string[]> {
    try {
      const log = this.logging.log("compute.googleapis.com%2Fstartup-script");

      const filter = [
        `resource.type="gce_instance"`,
        `resource.labels.instance_id="${this.instanceName}"`,
        `resource.labels.zone="${this.config.zone}"`,
      ];

      if (options?.since) {
        filter.push(`timestamp>="${options.since.toISOString()}"`);
      }

      const [entries] = await log.getEntries({
        filter: filter.join(" AND "),
        orderBy: "timestamp desc",
        pageSize: options?.lines ?? 100,
      });

      let lines = entries.map((entry) => {
        const data = entry.data as { message?: string; textPayload?: string } | string;
        if (typeof data === "string") return data;
        return data?.message ?? data?.textPayload ?? JSON.stringify(data);
      });

      if (options?.filter) {
        try {
          const pattern = new RegExp(options.filter, "i");
          lines = lines.filter((line) => pattern.test(line));
        } catch {
          const literal = options.filter.toLowerCase();
          lines = lines.filter((line) => line.toLowerCase().includes(literal));
        }
      }

      return lines.reverse(); // Return in chronological order
    } catch {
      return [];
    }
  }

  // ------------------------------------------------------------------
  // getEndpoint
  // ------------------------------------------------------------------

  async getEndpoint(): Promise<GatewayEndpoint> {
    // CRITICAL: Return the External Load Balancer IP, NEVER the VM's ephemeral IP
    if (!this.cachedExternalIp) {
      const [address] = await this.addressesClient.get({
        project: this.config.projectId,
        address: this.externalIpName,
      });
      this.cachedExternalIp = address.address ?? "";
    }

    if (!this.cachedExternalIp) {
      throw new Error("External IP address not found");
    }

    return {
      host: this.config.customDomain ?? this.cachedExternalIp,
      port: this.config.sslCertificateId ? 443 : 80,
      protocol: this.config.sslCertificateId ? "wss" : "ws",
    };
  }

  // ------------------------------------------------------------------
  // destroy
  // ------------------------------------------------------------------

  async destroy(): Promise<void> {
    // Delete in reverse order of creation

    // 1. Delete Forwarding Rule
    try {
      const [operation] = await this.forwardingRulesClient.delete({
        project: this.config.projectId,
        forwardingRule: this.forwardingRuleName,
      });
      await this.waitForGlobalOperation(operation);
    } catch {
      // May not exist
    }

    // 2. Delete HTTP(S) Proxy
    try {
      if (this.config.sslCertificateId) {
        const [operation] = await this.httpsProxiesClient.delete({
          project: this.config.projectId,
          targetHttpsProxy: this.httpsProxyName,
        });
        await this.waitForGlobalOperation(operation);
      } else {
        const [operation] = await this.httpProxiesClient.delete({
          project: this.config.projectId,
          targetHttpProxy: this.httpProxyName,
        });
        await this.waitForGlobalOperation(operation);
      }
    } catch {
      // May not exist
    }

    // 3. Delete URL Map
    try {
      const [operation] = await this.urlMapsClient.delete({
        project: this.config.projectId,
        urlMap: this.urlMapName,
      });
      await this.waitForGlobalOperation(operation);
    } catch {
      // May not exist
    }

    // 4. Delete Backend Service
    try {
      const [operation] = await this.backendServicesClient.delete({
        project: this.config.projectId,
        backendService: this.backendServiceName,
      });
      await this.waitForGlobalOperation(operation);
    } catch {
      // May not exist
    }

    // 5. Delete Security Policy
    try {
      const [operation] = await this.securityPoliciesClient.delete({
        project: this.config.projectId,
        securityPolicy: this.securityPolicyName,
      });
      await this.waitForGlobalOperation(operation);
    } catch {
      // May not exist
    }

    // 6. Delete Instance Group
    try {
      const [operation] = await this.instanceGroupsClient.delete({
        project: this.config.projectId,
        zone: this.config.zone,
        instanceGroup: this.instanceGroupName,
      });
      await this.waitForZoneOperation(operation);
    } catch {
      // May not exist
    }

    // 7. Delete VM Instance
    try {
      const [operation] = await this.instancesClient.delete({
        project: this.config.projectId,
        zone: this.config.zone,
        instance: this.instanceName,
      });
      await this.waitForZoneOperation(operation);
    } catch {
      // May not exist
    }

    // 8. Delete Data Disk
    try {
      const [operation] = await this.disksClient.delete({
        project: this.config.projectId,
        zone: this.config.zone,
        disk: this.dataDiskName,
      });
      await this.waitForZoneOperation(operation);
    } catch {
      // May not exist
    }

    // 9. Delete External IP
    try {
      const [operation] = await this.addressesClient.delete({
        project: this.config.projectId,
        address: this.externalIpName,
      });
      await this.waitForGlobalOperation(operation);
    } catch {
      // May not exist
    }

    // 10. Delete Firewall
    try {
      const [operation] = await this.firewallsClient.delete({
        project: this.config.projectId,
        firewall: this.firewallName,
      });
      await this.waitForGlobalOperation(operation);
    } catch {
      // May not exist
    }

    // 11. Delete Secret
    try {
      const secretPath = `projects/${this.config.projectId}/secrets/${this.secretName}`;
      await this.secretClient.deleteSecret({ name: secretPath });
    } catch {
      // May not exist
    }

    // Note: VPC Network and Subnet are NOT deleted as they may be shared with other services
  }

  // ------------------------------------------------------------------
  // Private helpers - Secret Manager
  // ------------------------------------------------------------------

  private async ensureSecret(name: string, value: string): Promise<void> {
    const parent = `projects/${this.config.projectId}`;
    const secretPath = `${parent}/secrets/${name}`;

    try {
      // Check if secret exists
      await this.secretClient.getSecret({ name: secretPath });

      // Secret exists, add new version
      await this.secretClient.addSecretVersion({
        parent: secretPath,
        payload: {
          data: Buffer.from(value, "utf8"),
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes("NOT_FOUND") || error.message.includes("404"))
      ) {
        // Create secret
        await this.secretClient.createSecret({
          parent,
          secretId: name,
          secret: {
            replication: {
              automatic: {},
            },
          },
        });

        // Add initial version
        await this.secretClient.addSecretVersion({
          parent: secretPath,
          payload: {
            data: Buffer.from(value, "utf8"),
          },
        });
      } else {
        throw error;
      }
    }
  }

  // ------------------------------------------------------------------
  // Private helpers - VPC Infrastructure
  // ------------------------------------------------------------------

  private async ensureVpcNetwork(): Promise<void> {
    try {
      await this.networksClient.get({
        project: this.config.projectId,
        network: this.vpcNetworkName,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes("NOT_FOUND") || error.message.includes("404"))
      ) {
        const [operation] = await this.networksClient.insert({
          project: this.config.projectId,
          networkResource: {
            name: this.vpcNetworkName,
            autoCreateSubnetworks: false, // Custom subnets
            description: `Clawster VPC for ${this.instanceName}`,
          },
        });
        await this.waitForGlobalOperation(operation);
      } else {
        throw error;
      }
    }
  }

  private async ensureSubnet(): Promise<void> {
    try {
      await this.subnetworksClient.get({
        project: this.config.projectId,
        region: this.region,
        subnetwork: this.subnetName,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes("NOT_FOUND") || error.message.includes("404"))
      ) {
        const [operation] = await this.subnetworksClient.insert({
          project: this.config.projectId,
          region: this.region,
          subnetworkResource: {
            name: this.subnetName,
            network: `projects/${this.config.projectId}/global/networks/${this.vpcNetworkName}`,
            ipCidrRange: "10.0.0.0/24",
            region: this.region,
            description: `Clawster subnet for ${this.instanceName}`,
          },
        });
        await this.waitForRegionOperation(operation);
      } else {
        throw error;
      }
    }
  }

  private async ensureFirewall(): Promise<void> {
    try {
      await this.firewallsClient.get({
        project: this.config.projectId,
        firewall: this.firewallName,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes("NOT_FOUND") || error.message.includes("404"))
      ) {
        const [operation] = await this.firewallsClient.insert({
          project: this.config.projectId,
          firewallResource: {
            name: this.firewallName,
            network: `projects/${this.config.projectId}/global/networks/${this.vpcNetworkName}`,
            description: `Allow traffic to Clawster instance ${this.instanceName}`,
            allowed: [
              {
                IPProtocol: "tcp",
                ports: [String(this.gatewayPort)],
              },
            ],
            // Allow traffic from GCP health check ranges and the LB
            sourceRanges: [
              "130.211.0.0/22", // GCP health check
              "35.191.0.0/16", // GCP health check
            ],
            targetTags: [`clawster-${this.sanitizeName(this.instanceName)}`],
          },
        });
        await this.waitForGlobalOperation(operation);
      } else {
        throw error;
      }
    }
  }

  private async ensureExternalIp(): Promise<void> {
    try {
      const [address] = await this.addressesClient.get({
        project: this.config.projectId,
        address: this.externalIpName,
      });
      this.cachedExternalIp = address.address ?? "";
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes("NOT_FOUND") || error.message.includes("404"))
      ) {
        const [operation] = await this.addressesClient.insert({
          project: this.config.projectId,
          addressResource: {
            name: this.externalIpName,
            description: `External IP for Clawster instance ${this.instanceName}`,
            networkTier: "PREMIUM",
          },
        });
        await this.waitForGlobalOperation(operation);

        // Get the newly created IP
        const [address] = await this.addressesClient.get({
          project: this.config.projectId,
          address: this.externalIpName,
        });
        this.cachedExternalIp = address.address ?? "";
      } else {
        throw error;
      }
    }
  }

  // ------------------------------------------------------------------
  // Private helpers - Persistent Disk
  // ------------------------------------------------------------------

  private async ensureDataDisk(): Promise<void> {
    try {
      await this.disksClient.get({
        project: this.config.projectId,
        zone: this.config.zone,
        disk: this.dataDiskName,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes("NOT_FOUND") || error.message.includes("404"))
      ) {
        const [operation] = await this.disksClient.insert({
          project: this.config.projectId,
          zone: this.config.zone,
          diskResource: {
            name: this.dataDiskName,
            sizeGb: String(this.dataDiskSizeGb),
            type: `zones/${this.config.zone}/diskTypes/pd-standard`,
            description: `Persistent data disk for Clawster instance ${this.instanceName}`,
          },
        });
        await this.waitForZoneOperation(operation);
      } else {
        throw error;
      }
    }
  }

  // ------------------------------------------------------------------
  // Private helpers - VM Instance
  // ------------------------------------------------------------------

  private async createVmInstance(options: InstallOptions): Promise<void> {
    const imageUri = this.config.image ?? "node:22-slim";
    const networkTag = `clawster-${this.sanitizeName(options.profileName)}`;

    // Startup script that:
    // 1. Formats and mounts the data disk
    // 2. Pulls the config from metadata
    // 3. Runs OpenClaw in Docker with Docker socket mounted (for sandbox)
    const startupScript = `#!/bin/bash
set -e

# Format and mount data disk if not already mounted
DATA_DISK="/dev/disk/by-id/google-${this.dataDiskName}"
MOUNT_POINT="/mnt/openclaw"

if ! mountpoint -q "$MOUNT_POINT"; then
  sudo mkdir -p "$MOUNT_POINT"

  # Check if disk needs formatting
  if ! blkid "$DATA_DISK"; then
    sudo mkfs.ext4 -F "$DATA_DISK"
  fi

  sudo mount "$DATA_DISK" "$MOUNT_POINT"
  sudo chmod 777 "$MOUNT_POINT"

  # Add to fstab for persistence
  if ! grep -q "$MOUNT_POINT" /etc/fstab; then
    echo "$DATA_DISK $MOUNT_POINT ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab
  fi
fi

# Get config from instance metadata
GATEWAY_PORT=$(curl -s -H "Metadata-Flavor: Google" \\
  http://metadata.google.internal/computeMetadata/v1/instance/attributes/gateway-port || echo "${this.gatewayPort}")
GATEWAY_TOKEN=$(curl -s -H "Metadata-Flavor: Google" \\
  http://metadata.google.internal/computeMetadata/v1/instance/attributes/gateway-token || echo "")
OPENCLAW_CONFIG=$(curl -s -H "Metadata-Flavor: Google" \\
  http://metadata.google.internal/computeMetadata/v1/instance/attributes/openclaw-config || echo "{}")

# Create config directory
mkdir -p "$MOUNT_POINT/.openclaw"
echo "$OPENCLAW_CONFIG" > "$MOUNT_POINT/.openclaw/openclaw.json"

# Stop any existing container
docker rm -f openclaw-gateway 2>/dev/null || true

# Run OpenClaw in Docker with full Docker access (for sandbox)
docker run -d \\
  --name openclaw-gateway \\
  --restart=always \\
  -p $GATEWAY_PORT:$GATEWAY_PORT \\
  -v "$MOUNT_POINT/.openclaw:/home/node/.openclaw" \\
  -v /var/run/docker.sock:/var/run/docker.sock \\
  -e OPENCLAW_GATEWAY_PORT=$GATEWAY_PORT \\
  -e OPENCLAW_GATEWAY_TOKEN="$GATEWAY_TOKEN" \\
  ${imageUri} \\
  sh -c "npx -y openclaw@latest gateway --port $GATEWAY_PORT --verbose"
`;

    // Build metadata items
    const metadataItems: Array<{ key: string; value: string }> = [
      { key: "startup-script", value: startupScript },
      { key: "gateway-port", value: String(this.gatewayPort) },
      { key: "openclaw-config", value: "{}" },
    ];

    if (options.gatewayAuthToken) {
      metadataItems.push({ key: "gateway-token", value: options.gatewayAuthToken });
    }

    // Add container env vars to metadata
    for (const [key, value] of Object.entries(options.containerEnv ?? {})) {
      metadataItems.push({ key: `env-${key}`, value });
    }

    const [operation] = await this.instancesClient.insert({
      project: this.config.projectId,
      zone: this.config.zone,
      instanceResource: {
        name: this.instanceName,
        machineType: `zones/${this.config.zone}/machineTypes/${this.machineType}`,
        description: `Clawster OpenClaw instance for ${options.profileName}`,
        tags: {
          items: [networkTag],
        },
        disks: [
          {
            boot: true,
            autoDelete: true,
            initializeParams: {
              // Container-Optimized OS - has Docker pre-installed
              sourceImage: "projects/cos-cloud/global/images/family/cos-stable",
              diskSizeGb: String(this.bootDiskSizeGb),
              diskType: `zones/${this.config.zone}/diskTypes/pd-standard`,
            },
          },
          {
            // Attach the data disk
            boot: false,
            autoDelete: false,
            source: `zones/${this.config.zone}/disks/${this.dataDiskName}`,
            deviceName: this.dataDiskName,
          },
        ],
        networkInterfaces: [
          {
            network: `projects/${this.config.projectId}/global/networks/${this.vpcNetworkName}`,
            subnetwork: `projects/${this.config.projectId}/regions/${this.region}/subnetworks/${this.subnetName}`,
            // No external IP - traffic goes through LB
            accessConfigs: [],
          },
        ],
        metadata: {
          items: metadataItems,
        },
        labels: {
          "clawster-managed": "true",
          "clawster-profile": this.sanitizeName(options.profileName),
        },
        serviceAccounts: [
          {
            scopes: [
              "https://www.googleapis.com/auth/cloud-platform",
            ],
          },
        ],
      },
    });

    await this.waitForZoneOperation(operation);
  }

  private async updateVmMetadata(configData: string): Promise<void> {
    // Get current instance
    const [instance] = await this.instancesClient.get({
      project: this.config.projectId,
      zone: this.config.zone,
      instance: this.instanceName,
    });

    // Update metadata
    const currentItems = instance.metadata?.items ?? [];
    const newItems = currentItems.filter((item) => item.key !== "openclaw-config");
    newItems.push({ key: "openclaw-config", value: configData });

    const [operation] = await this.instancesClient.setMetadata({
      project: this.config.projectId,
      zone: this.config.zone,
      instance: this.instanceName,
      metadataResource: {
        fingerprint: instance.metadata?.fingerprint,
        items: newItems,
      },
    });

    await this.waitForZoneOperation(operation);
  }

  // ------------------------------------------------------------------
  // Private helpers - Instance Group
  // ------------------------------------------------------------------

  private async ensureInstanceGroup(): Promise<void> {
    try {
      await this.instanceGroupsClient.get({
        project: this.config.projectId,
        zone: this.config.zone,
        instanceGroup: this.instanceGroupName,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes("NOT_FOUND") || error.message.includes("404"))
      ) {
        // Create unmanaged instance group
        const [operation] = await this.instanceGroupsClient.insert({
          project: this.config.projectId,
          zone: this.config.zone,
          instanceGroupResource: {
            name: this.instanceGroupName,
            description: `Instance group for Clawster ${this.instanceName}`,
            network: `projects/${this.config.projectId}/global/networks/${this.vpcNetworkName}`,
            namedPorts: [
              {
                name: "http",
                port: this.gatewayPort,
              },
            ],
          },
        });
        await this.waitForZoneOperation(operation);

        // Add instance to group
        const [addOperation] = await this.instanceGroupsClient.addInstances({
          project: this.config.projectId,
          zone: this.config.zone,
          instanceGroup: this.instanceGroupName,
          instanceGroupsAddInstancesRequestResource: {
            instances: [
              {
                instance: `zones/${this.config.zone}/instances/${this.instanceName}`,
              },
            ],
          },
        });
        await this.waitForZoneOperation(addOperation);
      } else {
        throw error;
      }
    }
  }

  // ------------------------------------------------------------------
  // Private helpers - Load Balancer Infrastructure
  // ------------------------------------------------------------------

  private async ensureSecurityPolicy(): Promise<void> {
    const allowedCidr = this.config.allowedCidr ?? ["0.0.0.0/0"];

    try {
      await this.securityPoliciesClient.get({
        project: this.config.projectId,
        securityPolicy: this.securityPolicyName,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes("NOT_FOUND") || error.message.includes("404"))
      ) {
        // Build rules for allowed CIDRs
        const rules = allowedCidr.map((cidr, index) => ({
          priority: 1000 + index,
          match: {
            versionedExpr: "SRC_IPS_V1" as const,
            config: {
              srcIpRanges: [cidr],
            },
          },
          action: "allow",
          description: `Allow traffic from ${cidr}`,
        }));

        // Add default deny rule
        rules.push({
          priority: 2147483647, // Lowest priority (highest number)
          match: {
            versionedExpr: "SRC_IPS_V1" as const,
            config: {
              srcIpRanges: ["*"],
            },
          },
          action: "deny(403)",
          description: "Deny all other traffic",
        });

        const [operation] = await this.securityPoliciesClient.insert({
          project: this.config.projectId,
          securityPolicyResource: {
            name: this.securityPolicyName,
            description: `Cloud Armor policy for Clawster instance ${this.instanceName}`,
            rules,
          },
        });
        await this.waitForGlobalOperation(operation);
      } else {
        throw error;
      }
    }
  }

  private async ensureBackendService(): Promise<void> {
    const instanceGroupSelfLink = `https://www.googleapis.com/compute/v1/projects/${this.config.projectId}/zones/${this.config.zone}/instanceGroups/${this.instanceGroupName}`;

    try {
      await this.backendServicesClient.get({
        project: this.config.projectId,
        backendService: this.backendServiceName,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes("NOT_FOUND") || error.message.includes("404"))
      ) {
        const backendService: Record<string, unknown> = {
          name: this.backendServiceName,
          description: `Backend service for Clawster ${this.instanceName}`,
          backends: [
            {
              group: instanceGroupSelfLink,
              balancingMode: "UTILIZATION",
              maxUtilization: 0.8,
            },
          ],
          protocol: "HTTP",
          portName: "http",
          healthChecks: [], // We'll use a simple TCP health check created inline
          loadBalancingScheme: "EXTERNAL_MANAGED",
        };

        // Attach security policy if it exists
        if (this.config.allowedCidr && this.config.allowedCidr.length > 0) {
          backendService.securityPolicy = `https://www.googleapis.com/compute/v1/projects/${this.config.projectId}/global/securityPolicies/${this.securityPolicyName}`;
        }

        const [operation] = await this.backendServicesClient.insert({
          project: this.config.projectId,
          backendServiceResource: backendService,
        });
        await this.waitForGlobalOperation(operation);
      } else {
        throw error;
      }
    }
  }

  private async ensureUrlMap(): Promise<void> {
    const backendServiceSelfLink = `https://www.googleapis.com/compute/v1/projects/${this.config.projectId}/global/backendServices/${this.backendServiceName}`;

    try {
      await this.urlMapsClient.get({
        project: this.config.projectId,
        urlMap: this.urlMapName,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes("NOT_FOUND") || error.message.includes("404"))
      ) {
        const [operation] = await this.urlMapsClient.insert({
          project: this.config.projectId,
          urlMapResource: {
            name: this.urlMapName,
            description: `URL map for Clawster ${this.instanceName}`,
            defaultService: backendServiceSelfLink,
          },
        });
        await this.waitForGlobalOperation(operation);
      } else {
        throw error;
      }
    }
  }

  private async ensureHttpProxy(): Promise<void> {
    const urlMapSelfLink = `https://www.googleapis.com/compute/v1/projects/${this.config.projectId}/global/urlMaps/${this.urlMapName}`;

    if (this.config.sslCertificateId) {
      // HTTPS Proxy
      try {
        await this.httpsProxiesClient.get({
          project: this.config.projectId,
          targetHttpsProxy: this.httpsProxyName,
        });
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          (error.message.includes("NOT_FOUND") || error.message.includes("404"))
        ) {
          const [operation] = await this.httpsProxiesClient.insert({
            project: this.config.projectId,
            targetHttpsProxyResource: {
              name: this.httpsProxyName,
              description: `HTTPS proxy for Clawster ${this.instanceName}`,
              urlMap: urlMapSelfLink,
              sslCertificates: [this.config.sslCertificateId],
            },
          });
          await this.waitForGlobalOperation(operation);
        } else {
          throw error;
        }
      }
    } else {
      // HTTP Proxy
      try {
        await this.httpProxiesClient.get({
          project: this.config.projectId,
          targetHttpProxy: this.httpProxyName,
        });
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          (error.message.includes("NOT_FOUND") || error.message.includes("404"))
        ) {
          const [operation] = await this.httpProxiesClient.insert({
            project: this.config.projectId,
            targetHttpProxyResource: {
              name: this.httpProxyName,
              description: `HTTP proxy for Clawster ${this.instanceName}`,
              urlMap: urlMapSelfLink,
            },
          });
          await this.waitForGlobalOperation(operation);
        } else {
          throw error;
        }
      }
    }
  }

  private async ensureForwardingRule(): Promise<void> {
    try {
      await this.forwardingRulesClient.get({
        project: this.config.projectId,
        forwardingRule: this.forwardingRuleName,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.includes("NOT_FOUND") || error.message.includes("404"))
      ) {
        const proxyName = this.config.sslCertificateId
          ? this.httpsProxyName
          : this.httpProxyName;
        const proxyType = this.config.sslCertificateId ? "targetHttpsProxies" : "targetHttpProxies";
        const proxySelfLink = `https://www.googleapis.com/compute/v1/projects/${this.config.projectId}/global/${proxyType}/${proxyName}`;
        const ipSelfLink = `https://www.googleapis.com/compute/v1/projects/${this.config.projectId}/global/addresses/${this.externalIpName}`;

        const [operation] = await this.forwardingRulesClient.insert({
          project: this.config.projectId,
          forwardingRuleResource: {
            name: this.forwardingRuleName,
            description: `Forwarding rule for Clawster ${this.instanceName}`,
            IPAddress: ipSelfLink,
            IPProtocol: "TCP",
            portRange: this.config.sslCertificateId ? "443" : "80",
            target: proxySelfLink,
            loadBalancingScheme: "EXTERNAL_MANAGED",
            networkTier: "PREMIUM",
          },
        });
        await this.waitForGlobalOperation(operation);
      } else {
        throw error;
      }
    }
  }

  // ------------------------------------------------------------------
  // Private helpers - Operation waiting
  // ------------------------------------------------------------------

  private async waitForGlobalOperation(operation: unknown): Promise<void> {
    const op = operation as { name?: string };
    if (!op?.name) return;

    const operationName = op.name.split("/").pop() ?? op.name;

    const start = Date.now();
    while (Date.now() - start < OPERATION_TIMEOUT_MS) {
      const [result] = await this.globalOperationsClient.get({
        project: this.config.projectId,
        operation: operationName,
      });

      if (result.status === "DONE") {
        if (result.error?.errors?.length) {
          throw new Error(result.error.errors[0]?.message ?? "Operation failed");
        }
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, OPERATION_POLL_INTERVAL_MS));
    }
    throw new Error(`Operation timed out: ${operationName}`);
  }

  private async waitForZoneOperation(operation: unknown): Promise<void> {
    const op = operation as { name?: string };
    if (!op?.name) return;

    const operationName = op.name.split("/").pop() ?? op.name;

    const start = Date.now();
    while (Date.now() - start < OPERATION_TIMEOUT_MS) {
      const [result] = await this.zoneOperationsClient.get({
        project: this.config.projectId,
        zone: this.config.zone,
        operation: operationName,
      });

      if (result.status === "DONE") {
        if (result.error?.errors?.length) {
          throw new Error(result.error.errors[0]?.message ?? "Operation failed");
        }
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, OPERATION_POLL_INTERVAL_MS));
    }
    throw new Error(`Operation timed out: ${operationName}`);
  }

  private async waitForRegionOperation(operation: unknown): Promise<void> {
    const op = operation as { name?: string };
    if (!op?.name) return;

    const operationName = op.name.split("/").pop() ?? op.name;

    const start = Date.now();
    while (Date.now() - start < OPERATION_TIMEOUT_MS) {
      const [result] = await this.regionOperationsClient.get({
        project: this.config.projectId,
        region: this.region,
        operation: operationName,
      });

      if (result.status === "DONE") {
        if (result.error?.errors?.length) {
          throw new Error(result.error.errors[0]?.message ?? "Operation failed");
        }
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, OPERATION_POLL_INTERVAL_MS));
    }
    throw new Error(`Operation timed out: ${operationName}`);
  }
}
