// ---------------------------------------------------------------------------
// Message Routing Interfaces — Message parsing and response handling contracts
// ---------------------------------------------------------------------------

import type { GatewayEvent } from "../protocol";

/**
 * Parsed response from the Gateway.
 */
export interface ParsedResponse {
  id: string;
  isOk: boolean;
  result?: unknown;
  error?: { code: string; message: string };
}

/**
 * Callbacks for message routing events.
 * Implemented by the GatewayClient to handle routed messages.
 */
export interface IMessageRouterCallbacks {
  /** Called when a response message is parsed and ready for handling. */
  onResponse(response: ParsedResponse): void;

  /** Called when an event is parsed and ready for handling. */
  onEvent(event: GatewayEvent): void;
}

/**
 * Interface for message routing.
 * Parses raw WebSocket messages and routes them to appropriate handlers.
 */
export interface IMessageRouter {
  /**
   * Set the callbacks for handling routed messages.
   */
  setCallbacks(callbacks: IMessageRouterCallbacks): void;

  /**
   * Route a raw message string.
   * Parses the message and invokes the appropriate callback.
   */
  route(raw: string): void;

  /**
   * Check if a message ID is expected as a response.
   */
  isExpectedResponse(id: string): boolean;
}
