import { SecretClient } from "@azure/keyvault-secrets";
import { DefaultAzureCredential, TokenCredential } from "@azure/identity";

export interface SecretValue {
  name: string;
  value: string;
  id?: string;
}

export class KeyVaultService {
  private client: SecretClient;

  constructor(vaultName: string, credential?: TokenCredential) {
    const vaultUrl = `https://${vaultName}.vault.azure.net`;
    this.client = new SecretClient(vaultUrl, credential || new DefaultAzureCredential());
  }

  async createSecret(
    name: string,
    value: string,
    tags?: Record<string, string>
  ): Promise<string> {
    const sanitized = this.sanitizeName(name);
    const result = await this.client.setSecret(sanitized, value, { tags });
    return result.properties.id || "";
  }

  async updateSecret(name: string, value: string): Promise<void> {
    const sanitized = this.sanitizeName(name);
    await this.client.setSecret(sanitized, value);
  }

  async getSecret(name: string): Promise<string | undefined> {
    try {
      const sanitized = this.sanitizeName(name);
      const result = await this.client.getSecret(sanitized);
      return result.value;
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        return undefined;
      }
      throw error;
    }
  }

  async deleteSecret(name: string, purge: boolean = false): Promise<void> {
    const sanitized = this.sanitizeName(name);
    const poller = await this.client.beginDeleteSecret(sanitized);
    await poller.pollUntilDone();

    if (purge) {
      await this.client.purgeDeletedSecret(sanitized);
    }
  }

  async secretExists(name: string): Promise<boolean> {
    try {
      const sanitized = this.sanitizeName(name);
      await this.client.getSecret(sanitized);
      return true;
    } catch (error: unknown) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async ensureSecretsForInstance(
    workspace: string,
    instanceName: string,
    secrets: Record<string, string>
  ): Promise<Record<string, string>> {
    const ids: Record<string, string> = {};

    for (const [key, value] of Object.entries(secrets)) {
      const secretName = this.sanitizeName(`clawster-${workspace}-${instanceName}-${key}`);

      await this.client.setSecret(secretName, value, {
        tags: {
          managedBy: "clawster",
          workspace,
          instance: instanceName,
        },
      });

      ids[key] = secretName;
    }

    return ids;
  }

  private sanitizeName(name: string): string {
    // Key Vault secret names: alphanumeric and hyphens, max 127 chars
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
