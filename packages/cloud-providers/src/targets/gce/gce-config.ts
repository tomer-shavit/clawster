/**
 * Configuration for GCP Compute Engine deployment targets.
 *
 * ARCHITECTURE: VM-based deployment with full Docker support.
 * Unlike Cloud Run, Compute Engine VMs provide:
 * - Persistent Disk for WhatsApp sessions and workspace data
 * - Full Docker daemon access for sandbox mode (Docker-in-Docker)
 * - No cold starts - always running
 * - State survives VM restarts
 *
 * Security:
 *   Internet -> External LB -> Instance Group NEG -> GCE VM (firewall-protected)
 *                                                       |
 *                                                 Persistent Disk
 */
export interface GceConfig {
  /** GCP project ID */
  projectId: string;

  /** GCP zone (e.g., "us-central1-a") - VMs are zone-specific */
  zone: string;

  // -- Authentication --

  /**
   * Path to service account key file (JSON).
   * Optional - uses Application Default Credentials if not provided.
   */
  keyFilePath?: string;

  // -- VM Configuration --

  /**
   * Machine type (e.g., "e2-small", "e2-medium", "n1-standard-1").
   * Default: "e2-small"
   *
   * Recommended sizing:
   * - e2-small (2 vCPU, 2GB): Basic bots, low traffic
   * - e2-medium (2 vCPU, 4GB): Standard bots, moderate traffic
   * - n1-standard-1 (1 vCPU, 3.75GB): Balanced compute
   */
  machineType?: string;

  /**
   * Boot disk size in GB.
   * Default: 20 (Container-Optimized OS requires minimal space)
   */
  bootDiskSizeGb?: number;

  /**
   * Data disk size in GB for persistent OpenClaw data.
   * This disk is mounted at /mnt/openclaw and contains:
   * - WhatsApp sessions (critical for maintaining login)
   * - Workspace data
   * - Config files
   * Default: 10
   */
  dataDiskSizeGb?: number;

  /**
   * Bot/profile name - used to derive resource names.
   * Required for install() if not called with InstallOptions.
   */
  profileName?: string;

  // -- Network Configuration --

  /**
   * VPC network name.
   * Default: "clawster-vpc-{profileName}"
   */
  vpcNetworkName?: string;

  /**
   * Subnet name.
   * Default: "clawster-subnet-{profileName}"
   */
  subnetName?: string;

  /**
   * Static external IP name for the load balancer.
   * Default: "clawster-ip-{profileName}"
   */
  externalIpName?: string;

  // -- Load Balancer Configuration --

  /**
   * SSL certificate ID for HTTPS (managed or self-managed).
   * If provided, the load balancer will use HTTPS (443).
   * If not provided, HTTP (80) will be used.
   *
   * Format: "projects/{project}/global/sslCertificates/{name}"
   */
  sslCertificateId?: string;

  /**
   * Custom domain for the load balancer.
   * Used as the host in getEndpoint() when provided.
   */
  customDomain?: string;

  // -- Security --

  /**
   * Allowed source IP ranges for firewall (CIDR notation).
   * Only traffic from these ranges can reach the load balancer.
   * Default: ["0.0.0.0/0"] (allows all - configure for production!)
   *
   * For production, restrict to:
   * - Your office IPs
   * - Webhook source IPs (Telegram, WhatsApp, etc.)
   * - Monitoring service IPs
   */
  allowedCidr?: string[];

  // -- Container Configuration --

  /**
   * Docker image to run inside the VM.
   * Default: "node:22-slim"
   *
   * The startup script will:
   * 1. Pull this image
   * 2. Mount the data disk
   * 3. Run OpenClaw gateway inside the container
   */
  image?: string;
}
