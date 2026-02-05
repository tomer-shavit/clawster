import { Injectable, Logger } from "@nestjs/common";
import type { ISecretResolver } from "./interfaces";

// =============================================================================
// Secret Resolver Service
// =============================================================================

/**
 * SecretResolverService — resolves and stores secrets based on deployment type.
 *
 * Single Responsibility: Manage secret references and storage across deployment targets.
 *
 * For MVP, supports:
 * - local/docker: Environment variable references (${ENV_VAR})
 * - ecs-ec2/gce/azure-vm: Cloud provider secret references (future)
 */
@Injectable()
export class SecretResolverService implements ISecretResolver {
  private readonly logger = new Logger(SecretResolverService.name);

  /**
   * Resolve a secret reference to its value or environment variable reference.
   *
   * @param secretKey - The key identifying the secret (e.g., "bufferApiKey")
   * @param secretValue - The actual secret value
   * @param deploymentType - The deployment target type
   * @returns The resolved reference format for the deployment type
   */
  async resolveSecretRef(
    secretKey: string,
    secretValue: string,
    deploymentType: string,
  ): Promise<string> {
    switch (deploymentType) {
      case "local":
      case "docker":
        // For local/docker, use environment variable reference
        const envVarName = this.toEnvVarName(secretKey);
        return `\${${envVarName}}`;

      case "ecs-ec2":
        // For ECS, use AWS Secrets Manager reference
        // Format: ${aws:secretsmanager:secret-name:key}
        return `\${aws:secretsmanager:clawster/${secretKey}}`;

      case "gce":
        // For GCE, use Secret Manager reference
        return `\${gcp:secretmanager:clawster-${secretKey}}`;

      case "azure-vm":
        // For Azure, use Key Vault reference
        return `\${azure:keyvault:clawster-${secretKey}}`;

      default:
        // Default to env var reference
        this.logger.warn(
          `Unknown deployment type "${deploymentType}", using env var reference`,
        );
        return `\${${this.toEnvVarName(secretKey)}}`;
    }
  }

  /**
   * Store a secret in the appropriate secret store for the deployment type.
   *
   * @param instanceId - The bot instance ID
   * @param secretKey - The key identifying the secret
   * @param secretValue - The actual secret value
   * @param deploymentType - The deployment target type
   */
  async storeSecret(
    instanceId: string,
    secretKey: string,
    secretValue: string,
    deploymentType: string,
  ): Promise<void> {
    switch (deploymentType) {
      case "local":
      case "docker":
        // For local/docker, secrets are set as env vars by the user
        // We just log a reminder
        this.logger.log(
          `Secret "${secretKey}" for instance ${instanceId} should be set as env var: ${this.toEnvVarName(secretKey)}`,
        );
        break;

      case "ecs-ec2":
        // TODO: Store in AWS Secrets Manager
        // For now, log a placeholder
        this.logger.log(
          `Would store secret "${secretKey}" in AWS Secrets Manager for instance ${instanceId}`,
        );
        // Future: await this.awsSecretsAdapter.storeSecret(...)
        break;

      case "gce":
        // TODO: Store in GCP Secret Manager
        this.logger.log(
          `Would store secret "${secretKey}" in GCP Secret Manager for instance ${instanceId}`,
        );
        break;

      case "azure-vm":
        // TODO: Store in Azure Key Vault
        this.logger.log(
          `Would store secret "${secretKey}" in Azure Key Vault for instance ${instanceId}`,
        );
        break;

      default:
        this.logger.warn(
          `Unknown deployment type "${deploymentType}", secret "${secretKey}" not stored`,
        );
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Convert a camelCase secret key to SCREAMING_SNAKE_CASE env var name.
   * Example: "bufferApiKey" -> "BUFFER_API_KEY"
   */
  private toEnvVarName(secretKey: string): string {
    return secretKey
      .replace(/([A-Z])/g, "_$1")
      .toUpperCase()
      .replace(/^_/, "");
  }
}
