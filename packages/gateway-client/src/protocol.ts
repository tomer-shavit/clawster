// ---------------------------------------------------------------------------
// Gateway Protocol – Message Types, Method Schemas, Event Types
// ---------------------------------------------------------------------------

/** Default Gateway port. */
export const DEFAULT_GATEWAY_PORT = 18789;

/** Current protocol version (must match OpenClaw gateway). */
export const PROTOCOL_VERSION = 3;

// ---- Error Codes ----------------------------------------------------------

export enum GatewayErrorCode {
  NOT_LINKED = "NOT_LINKED",
  AGENT_TIMEOUT = "AGENT_TIMEOUT",
  INVALID_REQUEST = "INVALID_REQUEST",
  UNAVAILABLE = "UNAVAILABLE",
}

// ---- Auth -----------------------------------------------------------------

export type GatewayAuth =
  | { mode: "token"; token: string }
  | { mode: "password"; password: string };

// ---- Connection Options ---------------------------------------------------

export interface ReconnectOptions {
  enabled: boolean;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface GatewayConnectionOptions {
  host: string;
  port: number;
  auth: GatewayAuth;
  protocolVersion?: { min: number; max: number };
  clientMetadata?: { name: string; version: string };
  reconnect?: ReconnectOptions;
  timeoutMs?: number;
}

// ---- Wire Messages --------------------------------------------------------

export interface GatewayMessage {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface GatewayResponseSuccess {
  id: string;
  result: unknown;
  error?: never;
}

export interface GatewayResponseError {
  id: string;
  result?: never;
  error: { code: GatewayErrorCode; message: string };
}

export type GatewayResponse = GatewayResponseSuccess | GatewayResponseError;

// ---- Connect Frame --------------------------------------------------------
// OpenClaw gateway uses { type: "req", id, method: "connect", params: {...} }

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    version: string;
    platform: string;
    mode: string;
    displayName?: string;
  };
  auth?: { token?: string; password?: string };
  caps?: string[];
  role?: string;
}

export interface ConnectFrame {
  type: "req";
  id: string;
  method: "connect";
  params: ConnectParams;
}

export interface ConnectResultSuccess {
  type: "res";
  id: string;
  ok: true;
  payload: {
    presence?: PresenceSnapshot;
    health?: GatewayHealthSnapshot;
    stateVersion?: number;
  };
}

export interface ConnectResultError {
  type: "res";
  id: string;
  ok: false;
  error: { code: string; message: string; retryable?: boolean };
}

export type ConnectResult = ConnectResultSuccess | ConnectResultError;

// ---- Health ---------------------------------------------------------------

export interface ChannelHealth {
  id: string;
  name: string;
  type: string;
  ok: boolean;
  latencyMs?: number;
}

export interface GatewayHealthSnapshot {
  ok: boolean;
  channels: ChannelHealth[];
  uptime: number;
}

// ---- Status ---------------------------------------------------------------

export interface GatewayStatusSummary {
  state: string;
  version: string;
  configHash: string;
}

// ---- Config ---------------------------------------------------------------

export interface ConfigGetResult {
  config: Record<string, unknown>;
  hash: string;
}

export interface ConfigApplyRequest {
  raw: string;
  baseHash: string;
  sessionKey?: string;
  restartDelayMs?: number;
}

export interface ConfigApplyResult {
  success: boolean;
  validationErrors?: string[];
}

export interface ConfigPatchRequest {
  patch: Record<string, unknown>;
  baseHash: string;
  sessionKey?: string;
}

export interface ConfigPatchResult {
  success: boolean;
  validationErrors?: string[];
}

// ---- Send -----------------------------------------------------------------

export interface SendRequest {
  channelId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SendResult {
  messageId: string;
  channelId: string;
  timestamp: string;
}

// ---- Agent ----------------------------------------------------------------

export interface AgentRequest {
  prompt: string;
  context?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface AgentAck {
  requestId: string;
  status: "accepted";
}

export interface AgentCompletion {
  requestId: string;
  status: "completed" | "failed";
  output?: string;
  error?: string;
}

export interface AgentResult {
  ack: AgentAck;
  completion: AgentCompletion;
}

// ---- Events ---------------------------------------------------------------

export interface AgentOutputEvent {
  type: "agentOutput";
  requestId: string;
  seq: number;
  chunk: string;
}

export interface PresenceSnapshot {
  users: PresenceUser[];
  stateVersion: number;
}

export interface PresenceUser {
  id: string;
  name: string;
  status: string;
}

export interface PresenceEvent {
  type: "presence";
  delta: PresenceDelta;
  stateVersion: number;
}

export interface PresenceDelta {
  joined?: PresenceUser[];
  left?: string[];
  updated?: PresenceUser[];
}

export interface ShutdownEvent {
  type: "shutdown";
  reason: string;
  gracePeriodMs: number;
}

export interface KeepaliveEvent {
  type: "keepalive";
  timestamp: number;
}

export type GatewayEvent =
  | AgentOutputEvent
  | PresenceEvent
  | ShutdownEvent
  | KeepaliveEvent;

// ---- Usage / Cost ---------------------------------------------------------

export interface CostUsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
}

export interface CostUsageDailyEntry {
  date: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
}

export interface CostUsageSummary {
  totals: CostUsageTotals;
  daily: CostUsageDailyEntry[];
}
