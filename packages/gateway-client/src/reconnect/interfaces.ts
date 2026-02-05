// ---------------------------------------------------------------------------
// Reconnection Interfaces — Auto-reconnect with exponential backoff contracts
// ---------------------------------------------------------------------------

import type { ReconnectOptions } from "../protocol";

/**
 * Callbacks for reconnection events.
 * Implemented by the GatewayClient to handle reconnection lifecycle.
 */
export interface IReconnectionCallbacks {
  /** Called when a reconnection attempt is about to start. */
  onReconnectAttempt(attempt: number): void;

  /** Called when max reconnection attempts have been reached. */
  onMaxAttemptsReached(maxAttempts: number): void;

  /** Execute the actual reconnection (connect to the gateway). */
  performReconnect(): Promise<void>;
}

/**
 * Interface for reconnection management.
 * Handles exponential backoff and retry logic.
 */
export interface IReconnectionManager {
  /**
   * Schedule a reconnection attempt.
   * Uses exponential backoff based on the current attempt count.
   */
  scheduleReconnect(): void;

  /**
   * Cancel any pending reconnection timer.
   */
  cancelReconnect(): void;

  /**
   * Reset the reconnection attempt counter.
   * Call this after a successful connection.
   */
  resetAttempts(): void;

  /**
   * Get the current reconnection attempt count.
   */
  readonly currentAttempt: number;

  /**
   * Check if reconnection is enabled.
   */
  readonly isEnabled: boolean;
}
