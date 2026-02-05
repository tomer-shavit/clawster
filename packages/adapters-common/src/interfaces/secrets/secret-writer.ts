/**
 * Interface for writing secrets (mutation operations).
 * Part of ISP-compliant secrets service split.
 */
export interface ISecretWriter {
  /**
   * Create a new secret.
   * @param name - The name of the secret
   * @param value - The secret value
   * @param tags - Optional tags/metadata to attach
   * @returns The secret identifier (ARN for AWS, ID for Azure, resource name for GCP)
   */
  createSecret(
    name: string,
    value: string,
    tags?: Record<string, string>
  ): Promise<string>;

  /**
   * Update an existing secret's value.
   * @param name - The name of the secret
   * @param value - The new secret value
   */
  updateSecret(name: string, value: string): Promise<void>;

  /**
   * Delete a secret.
   * @param name - The name of the secret
   * @param forceDelete - For AWS: immediate delete. For Azure: purge. For GCP: immediate.
   */
  deleteSecret(name: string, forceDelete?: boolean): Promise<void>;
}
