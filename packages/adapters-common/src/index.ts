// =============================================================================
// Interfaces (ISP-compliant split)
// =============================================================================

// Secrets interfaces
export type { ISecretReader } from "./interfaces/secrets/secret-reader";
export type { ISecretWriter } from "./interfaces/secrets/secret-writer";
export type { ISecretProvisioner } from "./interfaces/secrets/secret-provisioner";
export type { ISecretsService } from "./interfaces/secrets";

// Rotation interfaces
export type { ISecretRotator } from "./interfaces/rotation/secret-rotator";
export type { IRotationChecker } from "./interfaces/rotation/rotation-checker";
export type { ISecretRotationService } from "./interfaces/rotation";

// Compute interfaces
export type { IInstanceLifecycle } from "./interfaces/compute/instance-lifecycle";
export type { IInstanceStatusProvider } from "./interfaces/compute/instance-status";
export type { IInstanceCommandExecutor } from "./interfaces/compute/instance-command";
export type { IComputeService } from "./interfaces/compute";

// Network interfaces
export type { IVpcService } from "./interfaces/network/vpc-service";
export type { ISubnetService } from "./interfaces/network/subnet-service";
export type { ISecurityGroupService } from "./interfaces/network/security-group-service";
export type { INetworkService } from "./interfaces/network";

// Logging interfaces
export type { ILogGroupService } from "./interfaces/logging/log-group-service";
export type { ILogQueryService } from "./interfaces/logging/log-query-service";
export type { ILogConsoleService } from "./interfaces/logging/log-console-service";
export type { ILoggingService } from "./interfaces/logging";

// Infrastructure interfaces
export type {
  IStackOperations,
  StackInfo,
  StackOutput,
} from "./interfaces/infrastructure/stack-operations";
export type { IStackOutputs } from "./interfaces/infrastructure/stack-outputs";
export type { IInfrastructureService } from "./interfaces/infrastructure";

// Load balancer and container interfaces
export type { ILoadBalancerService } from "./interfaces/loadbalancer-service";
export type { IContainerService } from "./interfaces/container-service";

// =============================================================================
// Types
// =============================================================================

export type { StaleSecret, SecretValue } from "./types/secret";
export type { LogEvent, LogQueryOptions, LogQueryResult } from "./types/logging";
export type {
  InstanceConfig,
  InstanceResult,
  InstanceStatus,
} from "./types/compute";
export type {
  NetworkResult,
  SubnetResult,
  SecurityRule,
  SecurityGroupResult,
} from "./types/network";
export type {
  LoadBalancerConfig,
  LoadBalancerListener,
  HealthCheckConfig,
  LoadBalancerResult,
  LoadBalancerEndpoint,
} from "./types/loadbalancer";
export type {
  ContainerServiceConfig,
  PortMapping,
  ContainerHealthCheck,
  ServiceResult,
  ServiceStatus,
} from "./types/container";
export type {
  StackResult,
  StackStatus,
  StackConfig,
  StackResource,
  StackEvent,
} from "./types/infrastructure";

// =============================================================================
// Utilities
// =============================================================================

export {
  sanitizeName,
  sanitizeKeyVaultName,
  sanitizeAciName,
  sanitizeAwsName,
  sanitizeGcpSecretName,
  sanitizeGcpLabel,
} from "./utils/sanitize";

export { calculateAgeDays, isOlderThan, daysAgo } from "./utils/age-calculator";

export {
  isNotFoundError,
  isAlreadyExistsError,
  extractStatusCode,
  isValidationError,
} from "./utils/error-utils";
