/**
 * AWS Error Codes
 *
 * Centralized constants for AWS SDK error codes.
 * Use these instead of string literals for type safety.
 */

export const AwsErrorCodes = {
  // Common
  RESOURCE_NOT_FOUND: "ResourceNotFoundException",
  RESOURCE_ALREADY_EXISTS: "ResourceAlreadyExistsException",
  ACCESS_DENIED: "AccessDeniedException",
  THROTTLING: "ThrottlingException",
  VALIDATION_ERROR: "ValidationException",

  // Secrets Manager
  SECRET_NOT_FOUND: "ResourceNotFoundException",
  SECRET_ALREADY_EXISTS: "ResourceAlreadyExistsException",
  INVALID_REQUEST: "InvalidRequestException",
  DECRYPTION_FAILURE: "DecryptionFailure",
  ENCRYPTION_FAILURE: "EncryptionFailure",

  // CloudFormation
  STACK_NOT_FOUND: "StackNotFoundException",
  INSUFFICIENT_CAPABILITIES: "InsufficientCapabilitiesException",
  LIMIT_EXCEEDED: "LimitExceededException",
  NO_UPDATES_TO_PERFORM: "No updates are to be performed",

  // CloudWatch Logs
  LOG_GROUP_ALREADY_EXISTS: "ResourceAlreadyExistsException",
  LOG_GROUP_NOT_FOUND: "ResourceNotFoundException",
  INVALID_PARAMETER: "InvalidParameterException",

  // ECS
  SERVICE_NOT_FOUND: "ServiceNotFoundException",
  CLUSTER_NOT_FOUND: "ClusterNotFoundException",
  SERVICE_NOT_ACTIVE: "ServiceNotActiveException",
} as const;

export type AwsErrorCode = (typeof AwsErrorCodes)[keyof typeof AwsErrorCodes];
