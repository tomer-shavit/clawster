// ---------------------------------------------------------------------------
// Connection Interfaces — WebSocket connection lifecycle contracts
// ---------------------------------------------------------------------------

import type { ConnectResult, GatewayConnectionOptions } from "../protocol";

/**
 * Connection state machine states.
 */
export type ConnectionState = "disconnected" | "connecting" | "connected";

/**
 * Callbacks for WebSocket connection lifecycle events.
 * Implemented by the GatewayClient to handle connection state changes.
 */
export interface IConnectionCallbacks {
  /** Called when the connection is closed (intentionally or unexpectedly). */
  onDisconnected(): void;

  /** Called when a connection error occurs. */
  onError(error: Error): void;

  /** Called when a raw message is received after handshake is complete. */
  onMessage(data: string): void;
}

/**
 * Interface for WebSocket connection management.
 * Handles socket lifecycle, handshake, and cleanup.
 */
export interface IWebSocketConnection {
  /** Current connection state. */
  readonly state: ConnectionState;

  /**
   * Open the WebSocket, perform the protocol handshake, and return the
   * connect result (presence snapshot, health, state version).
   */
  connect(options: GatewayConnectionOptions, timeoutMs: number): Promise<ConnectResult>;

  /**
   * Gracefully close the WebSocket connection.
   */
  disconnect(): Promise<void>;

  /**
   * Check if the connection is established and ready.
   */
  isConnected(): boolean;

  /**
   * Send a raw message over the WebSocket.
   * Throws if not connected.
   */
  send(data: string): void;
}
