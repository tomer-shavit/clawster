// ---------------------------------------------------------------------------
// Connection — Barrel exports for connection management components
// ---------------------------------------------------------------------------

export { PendingRequestTracker } from "./pending-request-tracker";
export type { PendingRequest } from "./pending-request-tracker";

export { WebSocketConnection } from "./websocket-connection";
export type {
  ConnectionState,
  IWebSocketConnection,
  IConnectionCallbacks,
} from "./interfaces";
