// ---------------------------------------------------------------------------
// MessageRouter — Parse and route incoming WebSocket messages
// ---------------------------------------------------------------------------

import type { GatewayEvent } from "../protocol";
import type { IMessageRouter, IMessageRouterCallbacks, ParsedResponse } from "./interfaces";

/**
 * Callback to check if a message ID is expected as a response.
 */
export type PendingIdChecker = (id: string) => boolean;

/**
 * Routes incoming WebSocket messages to appropriate handlers.
 * Single responsibility: parse messages and invoke callbacks.
 */
export class MessageRouter implements IMessageRouter {
  private callbacks: IMessageRouterCallbacks | null = null;
  private readonly pendingIdChecker: PendingIdChecker;

  constructor(pendingIdChecker: PendingIdChecker) {
    this.pendingIdChecker = pendingIdChecker;
  }

  setCallbacks(callbacks: IMessageRouterCallbacks): void {
    this.callbacks = callbacks;
  }

  isExpectedResponse(id: string): boolean {
    return this.pendingIdChecker(id);
  }

  route(raw: string): void {
    if (!this.callbacks) return;

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      return; // silently drop unparseable frames
    }

    // Check if this is a response to a pending request
    // OpenClaw response: { type: "res", id, ok, payload/error }
    // Legacy response: { id, result/error }
    if (typeof data.id === "string" && this.pendingIdChecker(data.id)) {
      const response = this.parseResponse(data);
      this.callbacks.onResponse(response);
      return;
    }

    // OpenClaw event: { type: "event", event: "...", payload: {...} }
    // Legacy event: { type: "agentOutput" | "presence" | ... }
    if (data.type === "event" && typeof data.event === "string") {
      // Normalize OpenClaw event format to legacy format
      const normalized = {
        type: data.event as string,
        ...(data.payload as Record<string, unknown> ?? {}),
      };
      this.callbacks.onEvent(normalized as unknown as GatewayEvent);
      return;
    }

    if (typeof data.type === "string" && data.type !== "res") {
      this.callbacks.onEvent(data as unknown as GatewayEvent);
    }
  }

  private parseResponse(data: Record<string, unknown>): ParsedResponse {
    const id = data.id as string;

    // OpenClaw uses { type: "res", id, ok, payload/error }
    // Legacy format uses { id, result/error }
    const isOk = data.ok !== undefined ? data.ok === true : !data.error;
    const result = data.payload ?? data.result;
    const error = data.error as { code?: string; message?: string } | undefined;

    return {
      id,
      isOk,
      result,
      error: !isOk && error
        ? { code: error.code ?? "UNKNOWN", message: error.message ?? "Unknown error" }
        : undefined,
    };
  }
}
