/**
 * Interface for bulk secret provisioning operations.
 * Part of ISP-compliant secrets service split.
 */
export interface ISecretProvisioner {
  /**
   * Ensure all secrets for a bot instance exist.
   * Creates missing secrets, updates existing ones.
   * @param workspace - The workspace name
   * @param instanceName - The bot instance name
   * @param secrets - Map of secret keys to values
   * @returns Map of secret names to their identifiers (ARN/ID/resource name)
   */
  ensureSecretsForInstance(
    workspace: string,
    instanceName: string,
    secrets: Record<string, string>
  ): Promise<Record<string, string>>;
}
