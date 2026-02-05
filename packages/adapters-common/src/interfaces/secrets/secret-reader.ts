/**
 * Interface for reading secrets (query operations only).
 * Part of ISP-compliant secrets service split.
 */
export interface ISecretReader {
  /**
   * Get a secret's value.
   * @param name - The name of the secret
   * @returns The secret value, or undefined if not found
   */
  getSecret(name: string): Promise<string | undefined>;

  /**
   * Check if a secret exists.
   * @param name - The name of the secret
   */
  secretExists(name: string): Promise<boolean>;
}
