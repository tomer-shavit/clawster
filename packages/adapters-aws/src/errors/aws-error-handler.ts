/**
 * AWS Error Handler
 *
 * Utility class for classifying and handling AWS SDK errors.
 */

import { AwsErrorCodes } from "./aws-error-codes";

export class AwsErrorHandler {
  /**
   * Check if an error indicates a resource was not found.
   */
  static isResourceNotFound(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const name = (error as Error).name;
    const message = error.message;

    return (
      name === AwsErrorCodes.RESOURCE_NOT_FOUND ||
      name === AwsErrorCodes.SECRET_NOT_FOUND ||
      name === AwsErrorCodes.STACK_NOT_FOUND ||
      name === AwsErrorCodes.SERVICE_NOT_FOUND ||
      name === AwsErrorCodes.CLUSTER_NOT_FOUND ||
      name === AwsErrorCodes.LOG_GROUP_NOT_FOUND ||
      message.includes("does not exist") ||
      message.includes("not found")
    );
  }

  /**
   * Check if an error indicates a resource already exists.
   */
  static isResourceAlreadyExists(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const name = (error as Error).name;
    const message = error.message;

    return (
      name === AwsErrorCodes.RESOURCE_ALREADY_EXISTS ||
      name === AwsErrorCodes.SECRET_ALREADY_EXISTS ||
      name === AwsErrorCodes.LOG_GROUP_ALREADY_EXISTS ||
      message.includes("already exists")
    );
  }

  /**
   * Check if an error indicates no updates are needed (CloudFormation).
   */
  static isNoUpdatesNeeded(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return error.message.includes(AwsErrorCodes.NO_UPDATES_TO_PERFORM);
  }

  /**
   * Check if an error is due to throttling.
   */
  static isThrottlingError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const name = (error as Error).name;
    return (
      name === AwsErrorCodes.THROTTLING ||
      name === "TooManyRequestsException" ||
      name === "ProvisionedThroughputExceededException"
    );
  }

  /**
   * Check if an error is due to access being denied.
   */
  static isAccessDenied(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const name = (error as Error).name;
    return (
      name === AwsErrorCodes.ACCESS_DENIED ||
      name === "UnauthorizedException" ||
      name === "ForbiddenException"
    );
  }

  /**
   * Check if an error is a validation error.
   */
  static isValidationError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const name = (error as Error).name;
    return (
      name === AwsErrorCodes.VALIDATION_ERROR ||
      name === AwsErrorCodes.INVALID_PARAMETER ||
      name === AwsErrorCodes.INVALID_REQUEST
    );
  }

  /**
   * Extract the AWS error code from an error.
   */
  static getErrorCode(error: unknown): string | undefined {
    if (!(error instanceof Error)) {
      return undefined;
    }

    return (error as Error).name;
  }

  /**
   * Extract the HTTP status code from an AWS SDK error.
   */
  static getStatusCode(error: unknown): number | undefined {
    if (!(error instanceof Error)) {
      return undefined;
    }

    const metadata = (error as { $metadata?: { httpStatusCode?: number } })
      .$metadata;
    return metadata?.httpStatusCode;
  }
}
