// ---------------------------------------------------------------------------
// Interfaces — Barrel exports
// ---------------------------------------------------------------------------

export type { IGatewayClient } from "./gateway-client.interface";
export type { IGatewayManager } from "./gateway-manager.interface";
export {
  type IWebSocketFactory,
  DefaultWebSocketFactory,
} from "./websocket-factory.interface";
