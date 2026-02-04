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

// CloudWatch Logs
export {
  CloudWatchLogsService,
  createCloudWatchLogsService,
  type LogEvent,
} from "./cloudwatch/cloudwatch-service";

// CloudFormation
export {
  CloudFormationService,
  createCloudFormationService,
  type CloudFormationCredentials,
  type StackOutput,
  type StackEventInfo,
  type StackInfo,
  type StackStatus,
} from "./cloudformation/cloudformation-service";

// AWS Config type
export interface AWSConfig {
  region: string;
  accountId?: string;
  ecsExecutionRoleArn?: string;
  ecsTaskRoleArn?: string;
}
