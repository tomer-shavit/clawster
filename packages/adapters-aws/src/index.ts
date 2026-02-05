// Error handling utilities
export { AwsErrorCodes } from "./errors/aws-error-codes";
export { AwsErrorHandler } from "./errors/aws-error-handler";

// Secrets Manager
export {
  SecretsManagerService,
  createSecretsManagerService,
  type SecretValue,
  type SecretsManagerServiceOptions,
} from "./secrets/secrets-service";

export {
  TokenRotationService,
  createTokenRotationService,
  type StaleSecret,
  type TokenRotationServiceOptions,
} from "./secrets/token-rotation.service";

// Split secrets services (for direct usage)
export { SecretCrudService } from "./secrets/services/secret-crud-service";
export { InstanceProvisioningService } from "./secrets/services/instance-provisioning-service";

// CloudWatch Logs
export {
  CloudWatchLogsService,
  createCloudWatchLogsService,
  type LogEvent,
} from "./cloudwatch/cloudwatch-service";

// Split CloudWatch services (for direct usage)
export { LogGroupService } from "./cloudwatch/services/log-group-service";
export { LogQueryService } from "./cloudwatch/services/log-query-service";
export { LogConsoleService } from "./cloudwatch/services/log-console-service";

// CloudFormation
export {
  CloudFormationService,
  createCloudFormationService,
  type CloudFormationCredentials,
  type CloudFormationServiceOptions,
  type StackEventInfo,
  type StackStatus,
  type WaitOptions,
  BackoffStrategy,
  FixedDelayStrategy,
  ExponentialBackoffStrategy,
  LinearBackoffStrategy,
} from "./cloudformation/cloudformation-service";

// Split CloudFormation services (for direct usage)
export { StackOperationsService } from "./cloudformation/services/stack-operations-service";
export { StackWaiterService } from "./cloudformation/services/stack-waiter-service";

// Re-export common types used by CloudFormation
export type { StackInfo, StackOutput } from "@clawster/adapters-common";

// AWS Config type
export interface AWSConfig {
  region: string;
  accountId?: string;
  ecsExecutionRoleArn?: string;
  ecsTaskRoleArn?: string;
}
