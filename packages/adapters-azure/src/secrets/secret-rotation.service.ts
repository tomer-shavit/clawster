/**
 * Azure Secret Rotation Service
 *
 * Provides secret rotation and staleness checking for Azure Key Vault.
 * Implements ISecretRotationService interface from adapters-common.
 */

import { SecretClient } from "@azure/keyvault-secrets";
import { DefaultAzureCredential, TokenCredential } from "@azure/identity";
import type { ISecretRotationService } from "@clawster/adapters-common";
import type { StaleSecret } from "@clawster/adapters-common/dist/types/secret";

// Re-export StaleSecret type for backward compatibility
export type { StaleSecret };

/**
 * Azure Secret Rotation Service for Key Vault secrets.
 * Implements ISecretRotationService interface.
 */
export class SecretRotationService implements ISecretRotationService {
  private client: SecretClient;

  constructor(vaultName: string, credential?: TokenCredential) {
    const vaultUrl = `https://${vaultName}.vault.azure.net`;
    this.client = new SecretClient(vaultUrl, credential || new DefaultAzureCredential());
  }

  /**
   * Rotate a secret to a new value.
   * Implements ISecretRotator.rotateSecret.
   *
   * @param secretName - The name of the secret to rotate
   * @param newValue - The new secret value
   */
  async rotateSecret(secretName: string, newValue: string): Promise<void> {
    const sanitized = this.sanitizeName(secretName);

    // Get existing properties to preserve tags
    const existing = await this.client.getSecret(sanitized);
    const existingTags = existing.properties.tags || {};

    // Set value and tags atomically
    await this.client.setSecret(sanitized, newValue, {
      tags: {
        ...existingTags,
        lastRotated: new Date().toISOString(),
      },
    });
  }

  /**
   * Check if a secret is due for rotation.
   * Implements IRotationChecker.checkRotationDue.
   *
   * @param secretName - The name of the secret to check
   * @param maxAgeDays - Maximum age in days before rotation is due
   * @returns True if rotation is due
   */
  async checkRotationDue(secretName: string, maxAgeDays: number): Promise<boolean> {
    const sanitized = this.sanitizeName(secretName);
    const secret = await this.client.getSecret(sanitized);

    const lastRotatedTag = secret.properties.tags?.lastRotated;
    if (!lastRotatedTag) {
      return true;
    }

    const lastRotated = new Date(lastRotatedTag);
    const ageDays = (Date.now() - lastRotated.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > maxAgeDays;
  }

  /**
   * List all secrets that are overdue for rotation.
   * Implements IRotationChecker.listStaleSecrets.
   *
   * @param maxAgeDays - Maximum age in days
   * @returns Array of stale secrets with their age information
   */
  async listStaleSecrets(maxAgeDays: number): Promise<StaleSecret[]> {
    const stale: StaleSecret[] = [];

    for await (const properties of this.client.listPropertiesOfSecrets()) {
      if (!properties.name?.startsWith("clawster-")) {
        continue;
      }

      const lastRotatedTag = properties.tags?.lastRotated;
      const lastRotated = lastRotatedTag
        ? new Date(lastRotatedTag)
        : properties.createdOn ?? new Date(0);

      const ageDays = (Date.now() - lastRotated.getTime()) / (1000 * 60 * 60 * 24);

      if (ageDays > maxAgeDays) {
        stale.push({
          name: properties.name,
          lastRotated,
          ageDays: Math.floor(ageDays),
        });
      }
    }

    return stale;
  }

  /**
   * Sanitize a secret name to comply with Azure Key Vault naming requirements.
   */
  private sanitizeName(name: string): string {
    const sanitized = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 127);
    if (!sanitized) {
      throw new Error(`Invalid secret name: "${name}" produces empty sanitized value`);
    }
    return sanitized;
  }
}
