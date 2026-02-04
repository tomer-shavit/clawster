// ---------------------------------------------------------------------------
// PendingRequestTracker — Tracks pending RPC requests and their timeouts
// ---------------------------------------------------------------------------

import { GatewayConnectionError } from "../errors";

/**
 * Represents a pending request awaiting a response.
 */
export interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Tracks pending RPC requests by their message ID.
 * Handles timeout management and cleanup on disconnection.
 */
export class PendingRequestTracker {
  private readonly pending = new Map<string, PendingRequest>();

  /**
   * Add a pending request to track.
   */
  add(id: string, request: PendingRequest): void {
    this.pending.set(id, request);
  }

  /**
   * Get a pending request by ID.
   */
  get(id: string): PendingRequest | undefined {
    return this.pending.get(id);
  }

  /**
   * Check if a request ID is being tracked.
   */
  has(id: string): boolean {
    return this.pending.has(id);
  }

  /**
   * Remove a pending request by ID.
   * Returns true if the request was found and removed.
   */
  remove(id: string): boolean {
    const pending = this.pending.get(id);
    if (pending) {
      clearTimeout(pending.timer);
      this.pending.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Resolve a pending request with a value.
   */
  resolve(id: string, value: unknown): boolean {
    const pending = this.pending.get(id);
    if (!pending) return false;

    clearTimeout(pending.timer);
    this.pending.delete(id);
    pending.resolve(value);
    return true;
  }

  /**
   * Reject a pending request with an error.
   */
  reject(id: string, reason: unknown): boolean {
    const pending = this.pending.get(id);
    if (!pending) return false;

    clearTimeout(pending.timer);
    this.pending.delete(id);
    pending.reject(reason);
    return true;
  }

  /**
   * Reject all pending requests with the given reason.
   * Used on disconnection or cleanup.
   */
  rejectAll(reason: string): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new GatewayConnectionError(reason));
      this.pending.delete(id);
    }
  }

  /**
   * Get the number of pending requests.
   */
  get size(): number {
    return this.pending.size;
  }

  /**
   * Clear all pending requests without rejecting them.
   */
  clear(): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
    }
    this.pending.clear();
  }
}
