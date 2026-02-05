/**
 * Shared error detection utilities.
 * Provides cross-provider error classification helpers.
 */

/**
 * Check if an error indicates a resource was not found.
 * Works across AWS, Azure, and GCP error formats.
 *
 * @param error - The error to check
 * @returns True if the error indicates resource not found
 */
export function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const errorName = (error as Error).name?.toLowerCase() ?? "";

  // Check common not-found patterns
  if (
    message.includes("not found") ||
    message.includes("not_found") ||
    message.includes("does not exist") ||
    message.includes("404")
  ) {
    return true;
  }

  // AWS-specific
  if (
    errorName === "resourcenotfoundexception" ||
    message.includes("resourcenotfoundexception")
  ) {
    return true;
  }

  // Azure-specific (statusCode property)
  if ((error as { statusCode?: number }).statusCode === 404) {
    return true;
  }

  // GCP-specific (gRPC code 5 = NOT_FOUND)
  if ((error as { code?: number }).code === 5) {
    return true;
  }

  return false;
}

/**
 * Check if an error indicates a resource already exists.
 * Works across AWS, Azure, and GCP error formats.
 *
 * @param error - The error to check
 * @returns True if the error indicates resource already exists
 */
export function isAlreadyExistsError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const errorName = (error as Error).name?.toLowerCase() ?? "";

  // Check common already-exists patterns
  if (
    message.includes("already exists") ||
    message.includes("alreadyexists") ||
    message.includes("already_exists") ||
    message.includes("conflict")
  ) {
    return true;
  }

  // AWS-specific
  if (
    errorName === "resourcealreadyexistsexception" ||
    message.includes("resourcealreadyexistsexception")
  ) {
    return true;
  }

  // Azure-specific
  if ((error as { statusCode?: number }).statusCode === 409) {
    return true;
  }

  // GCP-specific (gRPC code 6 = ALREADY_EXISTS)
  if ((error as { code?: number }).code === 6) {
    return true;
  }

  return false;
}

/**
 * Extract HTTP status code from an error if available.
 *
 * @param error - The error to check
 * @returns The status code if available, undefined otherwise
 */
export function extractStatusCode(error: unknown): number | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }

  // Direct statusCode property (Azure SDK style)
  const errorWithStatus = error as unknown as { statusCode?: number };
  if (typeof errorWithStatus.statusCode === "number") {
    return errorWithStatus.statusCode;
  }

  // $metadata.httpStatusCode (AWS SDK v3 style)
  const metadata = (error as { $metadata?: { httpStatusCode?: number } })
    .$metadata;
  if (metadata && typeof metadata.httpStatusCode === "number") {
    return metadata.httpStatusCode;
  }

  // HTTP error in message
  const match = error.message.match(/\b([45]\d{2})\b/);
  if (match) {
    return parseInt(match[1], 10);
  }

  return undefined;
}

/**
 * Check if an error is a validation/invalid request error.
 *
 * @param error - The error to check
 * @returns True if the error is a validation error
 */
export function isValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const errorName = (error as Error).name?.toLowerCase() ?? "";

  // Check common validation patterns
  if (
    message.includes("validation") ||
    message.includes("invalid") ||
    message.includes("malformed")
  ) {
    return true;
  }

  // AWS-specific
  if (
    errorName === "validationexception" ||
    errorName === "invalidparametervalue"
  ) {
    return true;
  }

  // HTTP 400 Bad Request
  const statusCode = extractStatusCode(error);
  if (statusCode === 400) {
    return true;
  }

  // GCP-specific (gRPC code 3 = INVALID_ARGUMENT)
  if ((error as { code?: number }).code === 3) {
    return true;
  }

  return false;
}
