/**
 * Interface for rotating secrets (mutation only).
 * Part of ISP-compliant rotation service split.
 */
export interface ISecretRotator {
  /**
   * Rotate a secret to a new value.
   * Updates the secret and sets a lastRotated timestamp.
   * @param secretName - The name of the secret to rotate
   * @param newValue - The new secret value
   */
  rotateSecret(secretName: string, newValue: string): Promise<void>;
}
