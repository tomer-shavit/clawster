// ---------------------------------------------------------------------------
// IWebSocketFactory — Factory interface for creating WebSocket instances
// ---------------------------------------------------------------------------

import WebSocket from "ws";

/**
 * Factory interface for creating WebSocket instances.
 * Enables dependency injection for testing and alternative transports.
 */
export interface IWebSocketFactory {
  create(url: string): WebSocket;
}

/**
 * Default implementation using the ws library.
 */
export class DefaultWebSocketFactory implements IWebSocketFactory {
  create(url: string): WebSocket {
    return new WebSocket(url);
  }
}
