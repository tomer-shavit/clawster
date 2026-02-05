import type { StaleSecret } from "../../types/secret";

/**
 * Interface for checking rotation status (query only).
 * Part of ISP-compliant rotation service split.
 */
export interface IRotationChecker {
  /**
   * Check if a secret is due for rotation.
   * @param secretName - The name of the secret to check
   * @param maxAgeDays - Maximum age in days before rotation is due
   */
  checkRotationDue(secretName: string, maxAgeDays: number): Promise<boolean>;

  /**
   * List all secrets that are overdue for rotation.
   * @param maxAgeDays - Maximum age in days
   */
  listStaleSecrets(maxAgeDays: number): Promise<StaleSecret[]>;
}
