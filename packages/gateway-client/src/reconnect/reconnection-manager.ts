// ---------------------------------------------------------------------------
// ReconnectionManager — Auto-reconnect with exponential backoff
// ---------------------------------------------------------------------------

import type { ReconnectOptions } from "../protocol";
import type { IReconnectionManager, IReconnectionCallbacks } from "./interfaces";

/**
 * Default reconnection options.
 */
export const DEFAULT_RECONNECT_OPTIONS: ReconnectOptions = {
  enabled: true,
  maxAttempts: 10,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
};

/**
 * Manages automatic reconnection with exponential backoff.
 * Single responsibility: schedule and manage reconnection attempts.
 */
export class ReconnectionManager implements IReconnectionManager {
  private readonly options: ReconnectOptions;
  private readonly callbacks: IReconnectionCallbacks;
  private _currentAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: Partial<ReconnectOptions> | undefined, callbacks: IReconnectionCallbacks) {
    this.options = options
      ? { ...DEFAULT_RECONNECT_OPTIONS, ...options }
      : DEFAULT_RECONNECT_OPTIONS;
    this.callbacks = callbacks;
  }

  get currentAttempt(): number {
    return this._currentAttempt;
  }

  get isEnabled(): boolean {
    return this.options.enabled;
  }

  resetAttempts(): void {
    this._currentAttempt = 0;
  }

  cancelReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  scheduleReconnect(): void {
    if (!this.options.enabled) {
      return;
    }

    if (this._currentAttempt >= this.options.maxAttempts) {
      this.callbacks.onMaxAttemptsReached(this.options.maxAttempts);
      return;
    }

    const delay = Math.min(
      this.options.baseDelayMs * Math.pow(2, this._currentAttempt),
      this.options.maxDelayMs,
    );

    this._currentAttempt++;
    this.callbacks.onReconnectAttempt(this._currentAttempt);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.callbacks.performReconnect();
      } catch {
        // connect() failure will trigger another close -> scheduleReconnect
      }
    }, delay);
  }
}
