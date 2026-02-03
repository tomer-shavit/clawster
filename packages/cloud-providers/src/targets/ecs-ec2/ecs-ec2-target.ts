import {
  CloudFormationClient,
  CreateStackCommand,
  UpdateStackCommand,
  DeleteStackCommand,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import {
  ECSClient,
  DescribeServicesCommand,
  UpdateServiceCommand,
} from "@aws-sdk/client-ecs";
import {
  SecretsManagerClient,
  CreateSecretCommand,
  UpdateSecretCommand,
  DeleteSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  CloudWatchLogsClient,
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
  DeleteLogGroupCommand,
} from "@aws-sdk/client-cloudwatch-logs";
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
import type { EcsEc2Config } from "./ecs-ec2-config";
import { generateProductionTemplate } from "./templates/production";


const DEFAULT_CPU = 1024;
const DEFAULT_MEMORY = 2048;
const STACK_POLL_INTERVAL_MS = 10_000;
const STACK_TIMEOUT_MS = 600_000; // 10 minutes

/**
 * EcsEc2Target manages an OpenClaw gateway instance running
 * on AWS ECS with EC2 launch type via CloudFormation.
 *
 * SECURITY: All deployments use VPC + ALB architecture.
 * Containers are NEVER exposed directly to the internet.
 * External access (for webhooks from Telegram, WhatsApp, etc.) goes through ALB.
 *
 * Uses AWS SDK v3 for all cloud operations. EC2 launch type enables
 * Docker socket mounting for sandbox isolation.
 */
export class EcsEc2Target implements DeploymentTarget {
  readonly type = DeploymentTargetType.ECS_EC2;

  private readonly config: EcsEc2Config;
  private readonly cpu: number;
  private readonly memory: number;

  private readonly cfnClient: CloudFormationClient;
  private readonly ecsClient: ECSClient;
  private readonly smClient: SecretsManagerClient;
  private readonly cwlClient: CloudWatchLogsClient;

  /** Derived resource names — set during install */
  private stackName = "";
  private clusterName = "";
  private serviceName = "";
  private secretName = "";
  private logGroup = "";
  private gatewayPort = 18789;

  constructor(config: EcsEc2Config) {
    this.config = config;
    this.cpu = config.cpu ?? DEFAULT_CPU;
    this.memory = config.memory ?? DEFAULT_MEMORY;

    // Derive resource names from profileName (allows re-instantiated targets
    // to operate on existing resources without calling install() again)
    if (config.profileName) {
      const p = config.profileName;
      this.stackName = `clawster-bot-${p}`;
      this.clusterName = `clawster-${p}`;
      this.serviceName = `clawster-${p}`;
      this.secretName = `clawster/${p}/config`;
      this.logGroup = `/ecs/clawster-${p}`;
    }

    const credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };
    const region = config.region;

    this.cfnClient = new CloudFormationClient({ region, credentials });
    this.ecsClient = new ECSClient({ region, credentials });
    this.smClient = new SecretsManagerClient({ region, credentials });
    this.cwlClient = new CloudWatchLogsClient({ region, credentials });
  }

  // ------------------------------------------------------------------
  // install
  // ------------------------------------------------------------------

  async install(options: InstallOptions): Promise<InstallResult> {
    const profileName = options.profileName;
    this.gatewayPort = options.port;
    this.stackName = `clawster-bot-${profileName}`;
    this.clusterName = `clawster-${profileName}`;
    this.serviceName = `clawster-${profileName}`;
    this.secretName = `clawster/${profileName}/config`;
    this.logGroup = `/ecs/clawster-${profileName}`;

    try {
      // 1. Resolve image: use public node:22-slim unless a custom image is provided
      const imageUri = this.config.image ?? "node:22-slim";
      const usePublicImage = !this.config.image;

      // 2. Create the config secret in Secrets Manager (empty initially, configure() fills it)
      await this.ensureSecret(this.secretName, "{}");

      // 3. Generate CloudFormation template (always uses secure VPC + ALB architecture)
      const template = generateProductionTemplate({
        botName: profileName,
        gatewayPort: this.gatewayPort,
        imageUri,
        usePublicImage,
        cpu: this.cpu,
        memory: this.memory,
        gatewayAuthToken: options.gatewayAuthToken ?? "",
        containerEnv: options.containerEnv ?? {},
        allowedCidr: this.config.allowedCidr,
        certificateArn: this.config.certificateArn,
      });

      // 4. Deploy CloudFormation stack (create or update if it already exists)
      const stackExists = await this.stackExists();

      if (stackExists) {
        try {
          await this.cfnClient.send(
            new UpdateStackCommand({
              StackName: this.stackName,
              TemplateBody: JSON.stringify(template),
              Capabilities: ["CAPABILITY_NAMED_IAM"],
            }),
          );
          await this.waitForStack("UPDATE_COMPLETE");
        } catch (error: unknown) {
          // "No updates are to be performed" is not an error
          if (
            error instanceof Error &&
            error.message.includes("No updates are to be performed")
          ) {
            // Stack is already up-to-date, nothing to do
          } else {
            throw error;
          }
        }
      } else {
        await this.cfnClient.send(
          new CreateStackCommand({
            StackName: this.stackName,
            TemplateBody: JSON.stringify(template),
            Capabilities: ["CAPABILITY_NAMED_IAM"],
            Tags: [{ Key: "clawster:bot", Value: profileName }],
          }),
        );
        await this.waitForStack("CREATE_COMPLETE");
      }

      return {
        success: true,
        instanceId: this.serviceName,
        message: `ECS EC2 stack "${this.stackName}" created (VPC + ALB, secure)`,
        serviceName: this.serviceName,
      };
    } catch (error) {
      return {
        success: false,
        instanceId: this.serviceName,
        message: `ECS Fargate install failed: ${error instanceof Error ? error.message : String(error)}`,
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
      this.secretName = `clawster/${profileName}/config`;
    }

    // Apply the same config transformations as the Docker target
    // so that the openclaw.json written inside the container is valid.
    const raw = { ...config.config } as Record<string, unknown>;

    // gateway.bind = "lan" — ECS containers MUST bind to 0.0.0.0
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

    // channels.*.enabled is not valid — presence means active
    if (raw.channels && typeof raw.channels === "object") {
      for (const [key, value] of Object.entries(raw.channels as Record<string, unknown>)) {
        if (value && typeof value === "object" && "enabled" in (value as Record<string, unknown>)) {
          const { enabled: _enabled, ...rest } = value as Record<string, unknown>;
          (raw.channels as Record<string, unknown>)[key] = rest;
        }
      }
    }

    // Store the transformed config as JSON — this will be injected as
    // the OPENCLAW_CONFIG env var and written to ~/.openclaw/openclaw.json
    // by the container startup command.
    const configData = JSON.stringify(raw, null, 2);

    try {
      await this.ensureSecret(this.secretName, configData);

      return {
        success: true,
        message: `Configuration stored in Secrets Manager as "${this.secretName}"`,
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
    await this.ecsClient.send(
      new UpdateServiceCommand({
        cluster: this.clusterName,
        service: this.serviceName,
        desiredCount: 1,
      }),
    );
  }

  // ------------------------------------------------------------------
  // stop
  // ------------------------------------------------------------------

  async stop(): Promise<void> {
    await this.ecsClient.send(
      new UpdateServiceCommand({
        cluster: this.clusterName,
        service: this.serviceName,
        desiredCount: 0,
      }),
    );
  }

  // ------------------------------------------------------------------
  // restart
  // ------------------------------------------------------------------

  async restart(): Promise<void> {
    await this.ecsClient.send(
      new UpdateServiceCommand({
        cluster: this.clusterName,
        service: this.serviceName,
        forceNewDeployment: true,
      }),
    );
  }

  // ------------------------------------------------------------------
  // getStatus
  // ------------------------------------------------------------------

  async getStatus(): Promise<TargetStatus> {
    try {
      const result = await this.ecsClient.send(
        new DescribeServicesCommand({
          cluster: this.clusterName,
          services: [this.serviceName],
        }),
      );

      const service = result.services?.[0];
      if (!service) {
        return { state: "not-installed" };
      }

      const runningCount = service.runningCount ?? 0;
      const desiredCount = service.desiredCount ?? 0;
      const serviceStatus = service.status ?? "";

      let state: TargetStatus["state"];
      if (runningCount > 0) {
        state = "running";
      } else if (desiredCount === 0) {
        state = "stopped";
      } else if (serviceStatus === "ACTIVE" && desiredCount > 0) {
        state = "error";
      } else {
        state = "error";
      }

      return {
        state,
        gatewayPort: this.gatewayPort,
        error:
          state === "error"
            ? `Service status: ${serviceStatus}, running: ${runningCount}/${desiredCount}`
            : undefined,
      };
    } catch {
      return { state: "not-installed" };
    }
  }

  // ------------------------------------------------------------------
  // getLogs
  // ------------------------------------------------------------------

  async getLogs(options?: DeploymentLogOptions): Promise<string[]> {
    try {
      const streamsResult = await this.cwlClient.send(
        new DescribeLogStreamsCommand({
          logGroupName: this.logGroup,
          orderBy: "LastEventTime",
          descending: true,
          limit: 1,
        }),
      );

      const latestStream = streamsResult.logStreams?.[0];
      if (!latestStream?.logStreamName) {
        return [];
      }

      const eventsResult = await this.cwlClient.send(
        new GetLogEventsCommand({
          logGroupName: this.logGroup,
          logStreamName: latestStream.logStreamName,
          limit: options?.lines,
          startTime: options?.since?.getTime(),
        }),
      );

      let lines = (eventsResult.events ?? [])
        .map((e) => e.message)
        .filter((m): m is string => Boolean(m));

      if (options?.filter) {
        try {
          const pattern = new RegExp(options.filter, "i");
          lines = lines.filter((line) => pattern.test(line));
        } catch {
          // If the filter is not a valid regex, use literal string match
          const literal = options.filter.toLowerCase();
          lines = lines.filter((line) => line.toLowerCase().includes(literal));
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
    // Always return the ALB DNS name (secure architecture)
    const outputs = await this.getStackOutputs();
    const albDns = outputs["AlbDnsName"];
    if (!albDns) {
      throw new Error("ALB DNS name not found in stack outputs");
    }
    return {
      host: albDns,
      port: this.config.certificateArn ? 443 : 80,
      protocol: this.config.certificateArn ? "wss" : "ws",
    };
  }

  // ------------------------------------------------------------------
  // destroy
  // ------------------------------------------------------------------

  async destroy(): Promise<void> {
    // 1. Delete CloudFormation stack (handles all CF-managed resources)
    try {
      await this.cfnClient.send(
        new DeleteStackCommand({ StackName: this.stackName }),
      );
      await this.waitForStack("DELETE_COMPLETE");
    } catch {
      // Stack may not exist
    }

    // 2. Delete the Secrets Manager secret
    try {
      await this.smClient.send(
        new DeleteSecretCommand({
          SecretId: this.secretName,
          ForceDeleteWithoutRecovery: true,
        }),
      );
    } catch {
      // Secret may not exist
    }

    // 3. Delete the CloudWatch log group
    try {
      await this.cwlClient.send(
        new DeleteLogGroupCommand({ logGroupName: this.logGroup }),
      );
    } catch {
      // Log group may not exist
    }
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private async ensureSecret(name: string, value: string): Promise<void> {
    try {
      await this.smClient.send(
        new CreateSecretCommand({
          Name: name,
          SecretString: value,
        }),
      );
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === "ResourceExistsException"
      ) {
        await this.smClient.send(
          new UpdateSecretCommand({
            SecretId: name,
            SecretString: value,
          }),
        );
      } else {
        throw error;
      }
    }
  }

  private async stackExists(): Promise<boolean> {
    try {
      const result = await this.cfnClient.send(
        new DescribeStacksCommand({ StackName: this.stackName }),
      );
      const stack = result.Stacks?.[0];
      // A stack in DELETE_COMPLETE or ROLLBACK_COMPLETE is effectively gone
      if (!stack) return false;
      const status = stack.StackStatus;
      return status !== "DELETE_COMPLETE" && status !== "ROLLBACK_COMPLETE";
    } catch {
      return false;
    }
  }

  private async waitForStack(
    targetStatus: "CREATE_COMPLETE" | "UPDATE_COMPLETE" | "DELETE_COMPLETE",
  ): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < STACK_TIMEOUT_MS) {
      try {
        const result = await this.cfnClient.send(
          new DescribeStacksCommand({ StackName: this.stackName }),
        );

        const stack = result.Stacks?.[0];
        if (!stack) {
          if (targetStatus === "DELETE_COMPLETE") return;
          throw new Error(`Stack "${this.stackName}" not found`);
        }

        const status = stack.StackStatus;

        if (status === targetStatus) return;

        if (
          status?.endsWith("_FAILED") ||
          status === "ROLLBACK_COMPLETE" ||
          status === "DELETE_FAILED"
        ) {
          const reason = stack.StackStatusReason || "Unknown error";
          throw new Error(
            `Stack "${this.stackName}" reached ${status}: ${reason}`,
          );
        }
      } catch (error: unknown) {
        if (
          targetStatus === "DELETE_COMPLETE" &&
          error instanceof Error &&
          error.message.includes("does not exist")
        ) {
          return;
        }
        if (
          error instanceof Error &&
          (error.message.includes("_FAILED") ||
            error.message.includes("ROLLBACK"))
        ) {
          throw error;
        }
      }

      await new Promise((resolve) =>
        setTimeout(resolve, STACK_POLL_INTERVAL_MS),
      );
    }

    throw new Error(
      `Stack "${this.stackName}" timed out waiting for ${targetStatus}`,
    );
  }

  private async getStackOutputs(): Promise<Record<string, string>> {
    const result = await this.cfnClient.send(
      new DescribeStacksCommand({ StackName: this.stackName }),
    );

    const stack = result.Stacks?.[0];
    if (!stack) {
      throw new Error(`Stack "${this.stackName}" not found`);
    }

    const outputs: Record<string, string> = {};
    for (const output of stack.Outputs ?? []) {
      if (output.OutputKey && output.OutputValue) {
        outputs[output.OutputKey] = output.OutputValue;
      }
    }
    return outputs;
  }
}
