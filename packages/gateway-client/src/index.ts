// ---------------------------------------------------------------------------
// @clawster/gateway-client — Public API
// ---------------------------------------------------------------------------

// Client
export { GatewayClient } from "./client";

// Manager
export { GatewayManager } from "./manager";

// Interfaces for DI
export type { IGatewayClient } from "./interfaces/gateway-client.interface";
export type { IGatewayManager } from "./interfaces/gateway-manager.interface";
export {
  type IWebSocketFactory,
  DefaultWebSocketFactory,
} from "./interfaces/websocket-factory.interface";

// Interceptors
export * from "./interceptors";

// Auth helpers
export { buildConnectFrame, buildGatewayUrl } from "./auth";

// Errors
export {
  GatewayError,
  GatewayConnectionError,
  GatewayTimeoutError,
  GatewayAuthError,
} from "./errors";

// Protocol types & constants
export {
  DEFAULT_GATEWAY_PORT,
  PROTOCOL_VERSION,
  GatewayErrorCode,
} from "./protocol";

export type {
  GatewayAuth,
  GatewayConnectionOptions,
  ReconnectOptions,
  ConnectFrame,
  ConnectResult,
  ConnectResultSuccess,
  ConnectResultError,
  ChannelHealth,
  GatewayHealthSnapshot,
  GatewayStatusSummary,
  ConfigGetResult,
  ConfigApplyRequest,
  ConfigApplyResult,
  ConfigPatchRequest,
  ConfigPatchResult,
  SendRequest,
  SendResult,
  AgentRequest,
  AgentAck,
  AgentCompletion,
  AgentResult,
  AgentOutputEvent,
  PresenceEvent,
  GatewayEvent,
  AgentIdentityResult,
  CostUsageTotals,
  CostUsageDailyEntry,
  CostUsageSummary,
} from "./protocol";
