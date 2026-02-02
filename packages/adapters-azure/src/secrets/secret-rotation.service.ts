import { SecretClient } from "@azure/keyvault-secrets";
import { DefaultAzureCredential, TokenCredential } from "@azure/identity";

export interface StaleSecret {
  name: string;
  lastRotated: Date;
  ageDays: number;
}

export class SecretRotationService {
  private client: SecretClient;

  constructor(vaultName: string, credential?: TokenCredential) {
    const vaultUrl = `https://${vaultName}.vault.azure.net`;
    this.client = new SecretClient(vaultUrl, credential || new DefaultAzureCredential());
  }

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
