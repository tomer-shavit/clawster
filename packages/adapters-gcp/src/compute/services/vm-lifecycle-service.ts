/**
 * GCP VM Lifecycle Service
 *
 * Handles VM instance lifecycle operations.
 * Part of the ISP-compliant compute service split.
 */

import {
  InstancesClient,
  protos,
} from "@google-cloud/compute";
import type { IInstanceLifecycle } from "@clawster/adapters-common";
import type { InstanceConfig, InstanceResult } from "@clawster/adapters-common/dist/types/compute";
import { waitForZoneOperation, isNotFoundError } from "../../utils/operation-utils";

export interface VmInstanceConfig {
  /** Instance name */
  name: string;
  /** Machine type (e.g., "e2-small", "e2-medium") */
  machineType: string;
  /** Boot disk configuration */
  bootDisk: {
    /** Source image (e.g., "projects/cos-cloud/global/images/family/cos-stable") */
    sourceImage: string;
    /** Disk size in GB */
    sizeGb: number;
    /** Disk type (e.g., "pd-standard", "pd-ssd") */
    diskType?: string;
  };
  /** Data disk name to attach (optional) */
  dataDiskName?: string;
  /** VPC network name */
  networkName: string;
  /** Subnet name */
  subnetName: string;
  /** Network tags for firewall rules */
  networkTags?: string[];
  /** Metadata key-value pairs */
  metadata?: Record<string, string>;
  /** Labels for organization */
  labels?: Record<string, string>;
  /** Service account scopes */
  scopes?: string[];
}

/**
 * GCP VM Lifecycle Service for instance lifecycle operations.
 * Implements IInstanceLifecycle interface.
 */
export class VmLifecycleService implements IInstanceLifecycle {
  private readonly instancesClient: InstancesClient;
  private readonly projectId: string;
  private readonly zone: string;
  private readonly region: string;

  constructor(
    instancesClient: InstancesClient,
    projectId: string,
    zone: string
  ) {
    this.instancesClient = instancesClient;
    this.projectId = projectId;
    this.zone = zone;
    this.region = zone.replace(/-[a-z]$/, "");
  }

  /**
   * Create a new compute instance.
   * Implements IInstanceLifecycle.createInstance.
   */
  async createInstance(name: string, config: InstanceConfig): Promise<InstanceResult> {
    const disks: protos.google.cloud.compute.v1.IAttachedDisk[] = [
      {
        boot: true,
        autoDelete: true,
        initializeParams: {
          sourceImage: config.image,
          diskSizeGb: String(config.storage?.rootDiskSizeGb ?? 10),
          diskType: `zones/${this.zone}/diskTypes/${config.storage?.rootDiskType ?? "pd-standard"}`,
        },
      },
    ];

    const metadataItems: protos.google.cloud.compute.v1.IItems[] = config.metadata
      ? Object.entries(config.metadata).map(([key, value]) => ({ key, value }))
      : [];

    if (config.userData) {
      metadataItems.push({ key: "startup-script", value: config.userData });
    }

    const [operation] = await this.instancesClient.insert({
      project: this.projectId,
      zone: this.zone,
      instanceResource: {
        name,
        machineType: `zones/${this.zone}/machineTypes/${config.machineType}`,
        description: "Clawster OpenClaw instance",
        tags: config.tags ? { items: Object.keys(config.tags) } : undefined,
        disks,
        networkInterfaces: [
          {
            network: config.network?.vpcId
              ? `projects/${this.projectId}/global/networks/${config.network.vpcId}`
              : `projects/${this.projectId}/global/networks/default`,
            subnetwork: config.network?.subnetId
              ? `projects/${this.projectId}/regions/${this.region}/subnetworks/${config.network.subnetId}`
              : undefined,
            accessConfigs: config.network?.assignPublicIp ? [{ type: "ONE_TO_ONE_NAT" }] : [],
          },
        ],
        metadata: metadataItems.length > 0 ? { items: metadataItems } : undefined,
        labels: config.tags,
        serviceAccounts: config.serviceAccount
          ? [{ email: config.serviceAccount, scopes: ["https://www.googleapis.com/auth/cloud-platform"] }]
          : [{ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }],
      },
    });

    await waitForZoneOperation(this.projectId, this.zone, operation.latestResponse?.name);

    const [instance] = await this.instancesClient.get({
      project: this.projectId,
      zone: this.zone,
      instance: name,
    });

    const networkInterface = instance.networkInterfaces?.[0];

    return {
      instanceId: instance.id?.toString() ?? name,
      name,
      privateIp: networkInterface?.networkIP ?? undefined,
      publicIp: networkInterface?.accessConfigs?.[0]?.natIP ?? undefined,
      resourceId: instance.selfLink ?? undefined,
      status: "running",
    };
  }

  /**
   * Create a VM instance with GCP-specific configuration.
   */
  async createVmInstance(config: VmInstanceConfig): Promise<string> {
    const disks: protos.google.cloud.compute.v1.IAttachedDisk[] = [
      {
        boot: true,
        autoDelete: true,
        initializeParams: {
          sourceImage: config.bootDisk.sourceImage,
          diskSizeGb: String(config.bootDisk.sizeGb),
          diskType: `zones/${this.zone}/diskTypes/${config.bootDisk.diskType || "pd-standard"}`,
        },
      },
    ];

    if (config.dataDiskName) {
      disks.push({
        boot: false,
        autoDelete: false,
        source: `zones/${this.zone}/disks/${config.dataDiskName}`,
        deviceName: config.dataDiskName,
      });
    }

    const metadataItems: protos.google.cloud.compute.v1.IItems[] = config.metadata
      ? Object.entries(config.metadata).map(([key, value]) => ({ key, value }))
      : [];

    const [operation] = await this.instancesClient.insert({
      project: this.projectId,
      zone: this.zone,
      instanceResource: {
        name: config.name,
        machineType: `zones/${this.zone}/machineTypes/${config.machineType}`,
        description: "Clawster OpenClaw instance",
        tags: config.networkTags ? { items: config.networkTags } : undefined,
        disks,
        networkInterfaces: [
          {
            network: `projects/${this.projectId}/global/networks/${config.networkName}`,
            subnetwork: `projects/${this.projectId}/regions/${this.region}/subnetworks/${config.subnetName}`,
            accessConfigs: [],
          },
        ],
        metadata: metadataItems.length > 0 ? { items: metadataItems } : undefined,
        labels: config.labels,
        serviceAccounts: [
          {
            scopes: config.scopes || ["https://www.googleapis.com/auth/cloud-platform"],
          },
        ],
      },
    });

    await waitForZoneOperation(this.projectId, this.zone, operation.latestResponse?.name);

    const [instance] = await this.instancesClient.get({
      project: this.projectId,
      zone: this.zone,
      instance: config.name,
    });

    return instance.selfLink ?? "";
  }

  /**
   * Delete a compute instance.
   * Implements IInstanceLifecycle.deleteInstance.
   */
  async deleteInstance(name: string): Promise<void> {
    try {
      const [operation] = await this.instancesClient.delete({
        project: this.projectId,
        zone: this.zone,
        instance: name,
      });

      await waitForZoneOperation(this.projectId, this.zone, operation.latestResponse?.name);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
  }

  /**
   * Start a stopped compute instance.
   * Implements IInstanceLifecycle.startInstance.
   */
  async startInstance(name: string): Promise<void> {
    const [operation] = await this.instancesClient.start({
      project: this.projectId,
      zone: this.zone,
      instance: name,
    });

    await waitForZoneOperation(this.projectId, this.zone, operation.latestResponse?.name);
  }

  /**
   * Stop a running compute instance.
   * Implements IInstanceLifecycle.stopInstance.
   */
  async stopInstance(name: string): Promise<void> {
    const [operation] = await this.instancesClient.stop({
      project: this.projectId,
      zone: this.zone,
      instance: name,
    });

    await waitForZoneOperation(this.projectId, this.zone, operation.latestResponse?.name);
  }

  /**
   * Restart a compute instance.
   * Implements IInstanceLifecycle.restartInstance.
   */
  async restartInstance(name: string): Promise<void> {
    const [operation] = await this.instancesClient.reset({
      project: this.projectId,
      zone: this.zone,
      instance: name,
    });

    await waitForZoneOperation(this.projectId, this.zone, operation.latestResponse?.name);
  }

  /**
   * Reset (restart) a VM instance (GCP-specific alias).
   */
  async resetInstance(name: string): Promise<void> {
    return this.restartInstance(name);
  }
}
