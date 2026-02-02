import {
  ContainerInstanceManagementClient,
  ContainerGroup,
} from "@azure/arm-containerinstance";
import { DefaultAzureCredential, TokenCredential } from "@azure/identity";
import { InstanceManifest } from "@clawster/core";

export interface AciDeploymentConfig {
  containerGroupName: string;
  subscriptionId: string;
  resourceGroup: string;
}

export class AciService {
  private client: ContainerInstanceManagementClient;
  private resourceGroup: string;

  constructor(
    subscriptionId: string,
    resourceGroup: string,
    credential?: TokenCredential
  ) {
    this.client = new ContainerInstanceManagementClient(
      credential || new DefaultAzureCredential(),
      subscriptionId
    );
    this.resourceGroup = resourceGroup;
  }

  async createContainerGroup(
    name: string,
    manifest: InstanceManifest,
    secrets: Record<string, string> = {},
    location: string = "eastus"
  ): Promise<string> {
    const containerName = "openclaw";
    const image = manifest.spec.runtime.image;
    const cpu = manifest.spec.runtime.cpu;
    const memoryInGB = manifest.spec.runtime.memory / 1024;

    const environmentVariables: Array<{ name: string; value?: string; secureValue?: string }> = [
      { name: "OPENCLAW_LOG_LEVEL", value: manifest.spec.observability?.logLevel || "info" },
      { name: "OPENCLAW_WORKSPACE", value: manifest.metadata.workspace },
      { name: "OPENCLAW_INSTANCE", value: manifest.metadata.name },
    ];

    for (const [key, value] of Object.entries(secrets)) {
      environmentVariables.push({ name: key, secureValue: value });
    }

    const ports = manifest.spec.network.inbound === "WEBHOOK"
      ? [{ port: 3000, protocol: "TCP" as const }]
      : [];

    const containerGroup: ContainerGroup = {
      location,
      containers: [
        {
          name: containerName,
          image,
          resources: {
            requests: { cpu, memoryInGB },
            limits: { cpu, memoryInGB },
          },
          environmentVariables,
          ports: ports.length > 0
            ? ports.map((p) => ({ port: p.port, protocol: p.protocol }))
            : undefined,
          command: manifest.spec.runtime.command,
        },
      ],
      osType: "Linux",
      restartPolicy: "Always",
      tags: {
        managedBy: "clawster",
        workspace: manifest.metadata.workspace,
        instance: manifest.metadata.name,
      },
      ipAddress: ports.length > 0
        ? {
            type: "Public",
            ports: ports.map((p) => ({ port: p.port, protocol: p.protocol })),
          }
        : undefined,
    };

    const result = await this.client.containerGroups.beginCreateOrUpdateAndWait(
      this.resourceGroup,
      this.sanitizeName(name),
      containerGroup
    );

    return result.id || "";
  }

  async deleteContainerGroup(name: string): Promise<void> {
    await this.client.containerGroups.beginDeleteAndWait(
      this.resourceGroup,
      this.sanitizeName(name)
    );
  }

  async getContainerGroupStatus(name: string): Promise<{
    status: string;
    state: string;
    health: "HEALTHY" | "UNHEALTHY" | "UNKNOWN";
    restartCount: number;
  }> {
    try {
      const group = await this.client.containerGroups.get(
        this.resourceGroup,
        this.sanitizeName(name)
      );

      const container = group.containers?.[0];
      const instanceView = container?.instanceView;
      const provisioningState = group.provisioningState || "Unknown";
      const containerState = instanceView?.currentState?.state || "Unknown";
      const restartCount = instanceView?.restartCount || 0;

      let health: "HEALTHY" | "UNHEALTHY" | "UNKNOWN" = "UNKNOWN";
      if (containerState === "Running" && provisioningState === "Succeeded") {
        health = "HEALTHY";
      } else if (provisioningState === "Failed" || containerState === "Terminated") {
        health = "UNHEALTHY";
      }

      return {
        status: provisioningState,
        state: containerState,
        health,
        restartCount,
      };
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        return { status: "MISSING", state: "Unknown", health: "UNKNOWN", restartCount: 0 };
      }
      throw error;
    }
  }

  async stopContainerGroup(name: string): Promise<void> {
    await this.client.containerGroups.stop(
      this.resourceGroup,
      this.sanitizeName(name)
    );
  }

  async startContainerGroup(name: string): Promise<void> {
    await this.client.containerGroups.beginStartAndWait(
      this.resourceGroup,
      this.sanitizeName(name)
    );
  }

  async getLogs(name: string, containerName: string = "openclaw", tail?: number): Promise<string> {
    const logs = await this.client.containers.listLogs(
      this.resourceGroup,
      this.sanitizeName(name),
      containerName,
      { tail }
    );
    return logs.content || "";
  }

  private sanitizeName(name: string): string {
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
