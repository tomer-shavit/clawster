/**
 * Azure Adapters Package
 *
 * Provides Azure-specific implementations for cloud services.
 * All services follow SOLID principles with ISP-compliant interfaces.
 */

import { TokenCredential } from "@azure/identity";

// Import classes for factory functions
import { AciService } from "./aci/aci-service";
import { KeyVaultService } from "./secrets/keyvault-service";
import { SecretRotationService } from "./secrets/secret-rotation.service";
import { LogAnalyticsService } from "./log-analytics/log-analytics-service";
import { ComputeService } from "./compute/compute-service";
import { NetworkService } from "./network/network-service";
import { AppGatewayService } from "./appgateway/appgateway-service";
import { ResourceService } from "./resources/resource-service";

// Container Instance
export { AciService, AciDeploymentConfig } from "./aci/aci-service";

// Secrets & Key Vault
export { KeyVaultService, SecretValue } from "./secrets/keyvault-service";
export { SecretRotationService, StaleSecret } from "./secrets/secret-rotation.service";

// Log Analytics
export { LogAnalyticsService, LogEvent } from "./log-analytics/log-analytics-service";

// Compute (VM, Disk, NIC) - Facade and sub-services
export {
  ComputeService,
  VmStatus,
  CreateVmOptions,
} from "./compute/compute-service";
export { VmService } from "./compute/services/vm-service";
export { NicService } from "./compute/services/nic-service";
export { DiskService } from "./compute/services/disk-service";

// Network (VNet, Subnet, NSG, Public IP) - Facade and sub-services
export {
  NetworkService,
  SecurityRule,
} from "./network/network-service";
export { VnetService } from "./network/services/vnet-service";
export { SubnetService } from "./network/services/subnet-service";
export { NsgService } from "./network/services/nsg-service";
export { PublicIpService } from "./network/services/public-ip-service";

// Application Gateway
export {
  AppGatewayService,
  GatewayEndpointInfo,
  CreateAppGatewayOptions,
} from "./appgateway/appgateway-service";

// Resource Management
export {
  ResourceService,
  ResourceSummary,
} from "./resources/resource-service";

/**
 * Azure configuration interface for the adapters package.
 */
export interface AzureConfig {
  /** Azure subscription ID */
  subscriptionId: string;
  /** Default resource group name */
  resourceGroup: string;
  /** Azure region (e.g., "eastus") */
  location?: string;
  /** Key Vault name for secrets */
  keyVaultName?: string;
  /** Log Analytics workspace ID */
  logAnalyticsWorkspaceId?: string;
  /** Optional Azure credential */
  credential?: TokenCredential;
}

// ------------------------------------------------------------------
// Factory Functions
// ------------------------------------------------------------------

/**
 * Create an Azure Compute Service with the given configuration.
 *
 * @param config - Azure configuration
 * @returns Configured ComputeService instance
 */
export function createAzureComputeService(config: AzureConfig): ComputeService {
  if (!config.location) {
    throw new Error("location is required for ComputeService");
  }
  return new ComputeService(
    config.subscriptionId,
    config.resourceGroup,
    config.location,
    config.credential
  );
}

/**
 * Create an Azure Network Service with the given configuration.
 *
 * @param config - Azure configuration
 * @returns Configured NetworkService instance
 */
export function createAzureNetworkService(config: AzureConfig): NetworkService {
  if (!config.location) {
    throw new Error("location is required for NetworkService");
  }
  return new NetworkService(
    config.subscriptionId,
    config.resourceGroup,
    config.location,
    config.credential
  );
}

/**
 * Create an Azure Application Gateway Service with the given configuration.
 *
 * @param config - Azure configuration
 * @returns Configured AppGatewayService instance
 */
export function createAzureAppGatewayService(config: AzureConfig): AppGatewayService {
  if (!config.location) {
    throw new Error("location is required for AppGatewayService");
  }
  return new AppGatewayService(
    config.subscriptionId,
    config.resourceGroup,
    config.location,
    config.credential
  );
}

/**
 * Create an Azure Key Vault Service with the given configuration.
 *
 * @param config - Azure configuration
 * @returns Configured KeyVaultService instance
 */
export function createAzureKeyVaultService(config: AzureConfig): KeyVaultService {
  if (!config.keyVaultName) {
    throw new Error("keyVaultName is required for KeyVaultService");
  }
  return new KeyVaultService(config.keyVaultName, config.credential);
}

/**
 * Create an Azure Secret Rotation Service with the given configuration.
 *
 * @param config - Azure configuration
 * @returns Configured SecretRotationService instance
 */
export function createAzureSecretRotationService(config: AzureConfig): SecretRotationService {
  if (!config.keyVaultName) {
    throw new Error("keyVaultName is required for SecretRotationService");
  }
  return new SecretRotationService(config.keyVaultName, config.credential);
}

/**
 * Create an Azure Log Analytics Service with the given configuration.
 *
 * @param config - Azure configuration
 * @returns Configured LogAnalyticsService instance
 */
export function createAzureLogAnalyticsService(config: AzureConfig): LogAnalyticsService {
  if (!config.logAnalyticsWorkspaceId) {
    throw new Error("logAnalyticsWorkspaceId is required for LogAnalyticsService");
  }
  return new LogAnalyticsService(config.logAnalyticsWorkspaceId, config.credential);
}

/**
 * Create an Azure ACI Service with the given configuration.
 *
 * @param config - Azure configuration
 * @returns Configured AciService instance
 */
export function createAzureAciService(config: AzureConfig): AciService {
  return new AciService(
    config.subscriptionId,
    config.resourceGroup,
    config.credential
  );
}

/**
 * Create an Azure Resource Service with the given configuration.
 *
 * @param config - Azure configuration
 * @returns Configured ResourceService instance
 */
export function createAzureResourceService(config: AzureConfig): ResourceService {
  return new ResourceService(
    config.subscriptionId,
    config.credential
  );
}
