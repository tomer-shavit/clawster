/**
 * Stack Waiter Service
 *
 * Handles waiting for CloudFormation stacks to reach target states.
 * Uses pluggable backoff strategies (OCP compliance).
 * Part of SRP-compliant CloudFormation service split.
 */

import type {
  StackOperationsService,
  StackInfo,
  StackStatus,
  StackEventInfo,
} from "./stack-operations-service";
import { BackoffStrategy, FixedDelayStrategy } from "./backoff-strategy";

const DEFAULT_POLL_INTERVAL_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 600_000; // 10 minutes

export interface WaitOptions {
  pollIntervalMs?: number;
  timeoutMs?: number;
  onEvent?: (event: StackEventInfo) => void;
  backoffStrategy?: BackoffStrategy;
}

export class StackWaiterService {
  constructor(
    private readonly operationsService: StackOperationsService,
    private readonly defaultBackoffStrategy: BackoffStrategy = new FixedDelayStrategy()
  ) {}

  /**
   * Wait for a stack to reach a target status.
   */
  async waitForStackStatus(
    stackName: string,
    targetStatus: StackStatus,
    options?: WaitOptions
  ): Promise<StackInfo> {
    const pollInterval = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const backoffStrategy =
      options?.backoffStrategy ?? this.defaultBackoffStrategy;
    const startTime = Date.now();
    const seenEventIds = new Set<string>();
    let attempt = 0;

    while (Date.now() - startTime < timeout) {
      attempt++;

      // Poll stack events for progress updates
      if (options?.onEvent) {
        try {
          const events =
            await this.operationsService.describeStackEvents(stackName);
          for (const event of events.reverse()) {
            if (!seenEventIds.has(event.eventId)) {
              seenEventIds.add(event.eventId);
              options.onEvent(event);
            }
          }
        } catch {
          // Events may not be available yet
        }
      }

      // Check stack status
      const stack = await this.operationsService.describeStack(stackName);

      // Handle DELETE_COMPLETE - stack no longer exists
      if (targetStatus === "DELETE_COMPLETE" && !stack) {
        return {
          stackId: "",
          stackName,
          status: "DELETE_COMPLETE",
          creationTime: new Date(),
          outputs: [],
        };
      }

      if (!stack) {
        throw new Error(`Stack "${stackName}" not found`);
      }

      if (stack.status === targetStatus) {
        return stack;
      }

      // Check for terminal failure states
      if (
        stack.status.endsWith("_FAILED") ||
        stack.status === "ROLLBACK_COMPLETE" ||
        stack.status === "DELETE_FAILED"
      ) {
        throw new Error(
          `Stack "${stackName}" reached ${stack.status}: ${stack.statusReason ?? "Unknown error"}`
        );
      }

      const delay = backoffStrategy.getNextDelay(attempt, pollInterval);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    throw new Error(
      `Stack "${stackName}" timed out waiting for ${targetStatus}`
    );
  }
}
