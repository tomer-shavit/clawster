/**
 * GCP Operation Utilities
 *
 * Shared utilities for waiting on GCP operations and error handling.
 * Extracted to follow DRY principle and provide consistent behavior.
 */

import { ZoneOperationsClient } from "@google-cloud/compute";

/**
 * Configuration for operation polling.
 */
export interface OperationWaitOptions {
  /** Polling interval in milliseconds (default: 2000) */
  pollIntervalMs?: number;
  /** Maximum wait time in milliseconds (default: 300000 = 5 minutes) */
  timeoutMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 300000; // 5 minutes

// Shared operations client instance (lazy initialized)
let sharedOperationsClient: ZoneOperationsClient | null = null;

/**
 * Get or create a shared ZoneOperationsClient instance.
 * Reuses the same client to avoid connection overhead.
 */
function getOperationsClient(): ZoneOperationsClient {
  if (!sharedOperationsClient) {
    sharedOperationsClient = new ZoneOperationsClient();
  }
  return sharedOperationsClient;
}

/**
 * Wait for a GCP zone operation to complete.
 *
 * @param projectId - GCP project ID
 * @param zone - GCP zone
 * @param operationName - Operation name to wait for
 * @param options - Polling configuration options
 * @throws Error if operation fails or times out
 */
export async function waitForZoneOperation(
  projectId: string,
  zone: string,
  operationName: string | null | undefined,
  options?: OperationWaitOptions
): Promise<void> {
  if (!operationName) return;

  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const operationsClient = getOperationsClient();

  const startTime = Date.now();
  let status: string = "RUNNING";

  while (status === "RUNNING" || status === "PENDING") {
    // Check for timeout
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(
        `Operation ${operationName} timed out after ${timeoutMs}ms. Last status: ${status}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

    const [operation] = await operationsClient.get({
      project: projectId,
      zone: zone,
      operation: operationName,
    });

    status = String(operation.status ?? "DONE");

    if (operation.error?.errors?.length) {
      const errorMessages = operation.error.errors
        .map((e) => e.message)
        .join(", ");
      throw new Error(`Operation failed: ${errorMessages}`);
    }
  }
}

/**
 * Check if an error indicates a resource was not found.
 *
 * @param error - The error to check
 * @returns True if the error indicates "not found"
 */
export function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("not_found") ||
    message.includes("404") ||
    message.includes("was not found")
  );
}

/**
 * Reset the shared operations client (useful for testing).
 */
export function resetOperationsClient(): void {
  sharedOperationsClient = null;
}
