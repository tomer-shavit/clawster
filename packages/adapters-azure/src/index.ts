export { AciService, AciDeploymentConfig } from "./aci/aci-service";
export { KeyVaultService, SecretValue } from "./secrets/keyvault-service";
export { SecretRotationService, StaleSecret } from "./secrets/secret-rotation.service";
export { LogAnalyticsService, LogEvent } from "./log-analytics/log-analytics-service";

export interface AzureConfig {
  subscriptionId: string;
  resourceGroup: string;
  keyVaultName?: string;
  logAnalyticsWorkspaceId?: string;
}
