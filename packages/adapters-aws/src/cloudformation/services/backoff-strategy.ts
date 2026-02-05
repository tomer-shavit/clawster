/**
 * Backoff Strategy Interface and Implementations
 *
 * Pluggable backoff strategies for polling operations (OCP fix).
 */

/**
 * Interface for backoff strategies.
 * Allows extending polling behavior without modifying the waiter.
 */
export interface BackoffStrategy {
  /**
   * Get the delay before the next attempt.
   * @param attempt - The current attempt number (1-based)
   * @param baseDelayMs - The base delay in milliseconds
   * @returns The delay in milliseconds
   */
  getNextDelay(attempt: number, baseDelayMs: number): number;
}

/**
 * Fixed delay backoff strategy.
 * Always returns the same delay regardless of attempt count.
 */
export class FixedDelayStrategy implements BackoffStrategy {
  getNextDelay(_attempt: number, baseDelayMs: number): number {
    return baseDelayMs;
  }
}

/**
 * Exponential backoff strategy with optional jitter.
 * Delay doubles with each attempt up to a maximum.
 */
export class ExponentialBackoffStrategy implements BackoffStrategy {
  constructor(
    private readonly maxDelayMs: number = 60000,
    private readonly jitterFactor: number = 0.1
  ) {}

  getNextDelay(attempt: number, baseDelayMs: number): number {
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelayMs);

    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * this.jitterFactor * (Math.random() - 0.5);
    return Math.max(1, Math.floor(cappedDelay + jitter));
  }
}

/**
 * Linear backoff strategy.
 * Delay increases linearly with each attempt.
 */
export class LinearBackoffStrategy implements BackoffStrategy {
  constructor(
    private readonly incrementMs: number = 1000,
    private readonly maxDelayMs: number = 60000
  ) {}

  getNextDelay(attempt: number, baseDelayMs: number): number {
    const linearDelay = baseDelayMs + (attempt - 1) * this.incrementMs;
    return Math.min(linearDelay, this.maxDelayMs);
  }
}
