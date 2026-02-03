/**
 * Configuration for Azure Container Instances (ACI) deployment target.
 *
 * SECURITY: All deployments use VNet + Application Gateway architecture.
 * Containers are NEVER exposed directly to the internet.
 * External access (for webhooks from Telegram, WhatsApp, etc.) goes through Application Gateway.
 */
export interface AciConfig {
  /** Azure subscription ID */
  subscriptionId: string;

  /** Azure resource group name */
  resourceGroup: string;

  /** Azure region (e.g., "eastus", "westeurope") */
  region: string;

  // ── Authentication ──

  /** Service principal client ID (optional - uses DefaultAzureCredential if not provided) */
  clientId?: string;

  /** Service principal client secret */
  clientSecret?: string;

  /** Azure AD tenant ID */
  tenantId?: string;

  // ── VNet Configuration (always used) ──

  /** VNet name - will be created if it doesn't exist */
  vnetName?: string;

  /** VNet address prefix (e.g., "10.0.0.0/16") - used when creating VNet */
  vnetAddressPrefix?: string;

  /** Subnet name for ACI containers */
  subnetName?: string;

  /** Subnet address prefix (e.g., "10.0.1.0/24") - used when creating subnet */
  subnetAddressPrefix?: string;

  /** Existing subnet ID to use (alternative to vnetName/subnetName) */
  subnetId?: string;

  /** Network Security Group name - will be created with secure defaults if not provided */
  nsgName?: string;

  // ── Application Gateway (for "with-gateway" tier) ──

  /** Application Gateway name */
  appGatewayName?: string;

  /** Application Gateway subnet name (separate from ACI subnet) */
  appGatewaySubnetName?: string;

  /** Application Gateway subnet address prefix (e.g., "10.0.2.0/24") */
  appGatewaySubnetAddressPrefix?: string;

  /** SSL certificate ID in Key Vault for HTTPS termination */
  sslCertificateSecretId?: string;

  /** Custom domain for Application Gateway */
  customDomain?: string;

  // ── Secrets & Logging ──

  /** Azure Key Vault name for storing secrets (REQUIRED for production) */
  keyVaultName?: string;

  /** Log Analytics workspace ID for centralized logging */
  logAnalyticsWorkspaceId?: string;

  /** Log Analytics workspace key (required if workspaceId is provided) */
  logAnalyticsWorkspaceKey?: string;

  // ── Container Configuration ──

  /** Container image (default: "node:22-slim") */
  image?: string;

  /** CPU cores (default: 1) */
  cpu?: number;

  /** Memory in MB (default: 2048) */
  memory?: number;

  /** Profile name for resource naming (set during install if not provided) */
  profileName?: string;

  // ── Security Options ──

  /**
   * Allowed source IP ranges for NSG inbound rules (CIDR notation).
   * Only traffic from these ranges can reach the gateway port.
   * IMPORTANT: Always configure this to restrict access.
   */
  allowedCidr?: string[];

  /**
   * Additional NSG rules for specific services (e.g., allow SSH from bastion)
   */
  additionalNsgRules?: Array<{
    name: string;
    priority: number;
    direction: "Inbound" | "Outbound";
    access: "Allow" | "Deny";
    protocol: "Tcp" | "Udp" | "*";
    sourceAddressPrefix: string;
    destinationPortRange: string;
  }>;
}
