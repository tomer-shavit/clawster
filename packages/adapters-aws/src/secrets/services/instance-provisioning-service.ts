/**
 * Instance Provisioning Service
 *
 * Handles bulk secret provisioning for bot instances.
 * Part of SRP-compliant Secrets Manager service split.
 */

import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import type { ISecretProvisioner } from "@clawster/adapters-common";
import { SecretCrudService } from "./secret-crud-service";

export interface InstanceProvisioningServiceOptions {
  /** Prefix pattern for instance secrets. Default: "/clawster" */
  prefix?: string;
  /** AWS region for ARN construction */
  region: string;
  /** AWS account ID for ARN construction */
  accountId?: string;
}

export class InstanceProvisioningService implements ISecretProvisioner {
  private readonly crudService: SecretCrudService;
  private readonly prefix: string;
  private readonly region: string;
  private readonly accountId: string;

  constructor(
    client: SecretsManagerClient,
    options: InstanceProvisioningServiceOptions
  ) {
    this.crudService = new SecretCrudService(client);
    this.prefix = options.prefix ?? "/clawster";
    this.region = options.region;
    this.accountId = options.accountId ?? process.env.AWS_ACCOUNT_ID ?? "";
  }

  /**
   * Ensure all secrets for a bot instance exist.
   * Creates missing secrets, updates existing ones.
   */
  async ensureSecretsForInstance(
    workspace: string,
    instanceName: string,
    secrets: Record<string, string>
  ): Promise<Record<string, string>> {
    const secretPrefix = `${this.prefix}/${workspace}/${instanceName}`;
    const arns: Record<string, string> = {};

    for (const [key, value] of Object.entries(secrets)) {
      const secretName = `${secretPrefix}/${key}`;

      if (await this.crudService.secretExists(secretName)) {
        await this.crudService.updateSecret(secretName, value);
      } else {
        await this.crudService.createSecret(secretName, value, {
          managedBy: "clawster",
          workspace,
          instance: instanceName,
        });
      }

      arns[key] = this.buildArn(secretName);
    }

    return arns;
  }

  /**
   * Build an ARN for a secret.
   */
  private buildArn(secretName: string): string {
    return `arn:aws:secretsmanager:${this.region}:${this.accountId}:secret:${secretName}`;
  }
}
