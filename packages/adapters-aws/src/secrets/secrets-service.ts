import {
  SecretsManagerClient,
  CreateSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import type { ISecretsService } from "@clawster/adapters-common";

export interface SecretValue {
  name: string;
  value: string;
  arn?: string;
}

export interface SecretsManagerServiceOptions {
  /** Prefix pattern for instance secrets. Default: "/clawster" */
  prefix?: string;
  /** AWS region for ARN construction. Default: process.env.AWS_REGION || "us-east-1" */
  region?: string;
  /** AWS account ID for ARN construction. Default: process.env.AWS_ACCOUNT_ID || "" */
  accountId?: string;
}

/**
 * AWS Secrets Manager service implementing ISecretsService.
 * Uses constructor injection for testability.
 */
export class SecretsManagerService implements ISecretsService {
  private readonly prefix: string;
  private readonly region: string;
  private readonly accountId: string;

  constructor(
    private readonly client: SecretsManagerClient,
    options: SecretsManagerServiceOptions = {}
  ) {
    this.prefix = options.prefix ?? "/clawster";
    this.region = options.region ?? process.env.AWS_REGION ?? "us-east-1";
    this.accountId = options.accountId ?? process.env.AWS_ACCOUNT_ID ?? "";
  }

  async createSecret(
    name: string,
    value: string,
    tags?: Record<string, string>
  ): Promise<string> {
    const result = await this.client.send(new CreateSecretCommand({
      Name: name,
      SecretString: value,
      Tags: Object.entries(tags || {}).map(([Key, Value]) => ({ Key, Value })),
    }));

    return result.ARN || "";
  }

  async updateSecret(name: string, value: string): Promise<void> {
    await this.client.send(new PutSecretValueCommand({
      SecretId: name,
      SecretString: value,
    }));
  }

  async getSecret(name: string): Promise<string | undefined> {
    try {
      const result = await this.client.send(new GetSecretValueCommand({
        SecretId: name,
      }));
      return result.SecretString;
    } catch (error) {
      if ((error as Error).name === "ResourceNotFoundException") {
        return undefined;
      }
      throw error;
    }
  }

  async deleteSecret(name: string, forceDelete: boolean = false): Promise<void> {
    await this.client.send(new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: forceDelete,
    }));
  }

  async secretExists(name: string): Promise<boolean> {
    try {
      await this.client.send(new DescribeSecretCommand({
        SecretId: name,
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  async ensureSecretsForInstance(
    workspace: string,
    instanceName: string,
    secrets: Record<string, string>
  ): Promise<Record<string, string>> {
    const secretPrefix = `${this.prefix}/${workspace}/${instanceName}`;
    const arns: Record<string, string> = {};

    for (const [key, value] of Object.entries(secrets)) {
      const secretName = `${secretPrefix}/${key}`;

      if (await this.secretExists(secretName)) {
        await this.updateSecret(secretName, value);
      } else {
        await this.createSecret(secretName, value, {
          managedBy: "clawster",
          workspace,
          instance: instanceName,
        });
      }

      arns[key] = `arn:aws:secretsmanager:${this.region}:${this.accountId}:secret:${secretName}`;
    }

    return arns;
  }
}

/**
 * Factory function to create a SecretsManagerService with default configuration.
 * Provides backward compatibility with the old constructor signature.
 */
export function createSecretsManagerService(
  region: string = "us-east-1",
  options: SecretsManagerServiceOptions = {}
): SecretsManagerService {
  return new SecretsManagerService(
    new SecretsManagerClient({ region }),
    { ...options, region }
  );
}
