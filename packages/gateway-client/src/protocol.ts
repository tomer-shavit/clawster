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
  /** Gateway returns `ok` (not `success`) on the wire */
  ok?: boolean;
  success?: boolean;
  path?: string;
  config?: Record<string, unknown>;
  restart?: Record<string, unknown>;
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
  message: string;
  idempotencyKey: string;
  agentId?: string;
  to?: string;
  sessionId?: string;
  sessionKey?: string;
  timeout?: number;
  deliver?: boolean;
  extraSystemPrompt?: string;
  /** Local-only: override completion wait timeout (not sent to gateway). */
  _localTimeoutMs?: number;
}

export interface AgentAck {
  runId: string;
  status: "accepted";
  acceptedAt?: number;
}

export interface AgentCompletion {
  runId: string;
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

// ---- Agent Identity -------------------------------------------------------

export interface AgentIdentityResult {
  agentId: string;
  name: string;
  avatar?: string;
}

// ---- Cron Jobs (OpenClaw cron.* RPCs) --------------------------------------

export interface CronScheduleAt {
  kind: "at";
  at: string;
}

export interface CronScheduleEvery {
  kind: "every";
  everyMs: number;
  anchorMs?: number;
}

export interface CronScheduleCron {
  kind: "cron";
  expr: string;
  tz?: string;
}

export type CronSchedule = CronScheduleAt | CronScheduleEvery | CronScheduleCron;

export interface CronPayloadSystemEvent {
  kind: "systemEvent";
  text: string;
}

export interface CronPayloadAgentTurn {
  kind: "agentTurn";
  message: string;
  model?: string;
  thinking?: string;
  timeoutSeconds?: number;
}

export type CronPayload = CronPayloadSystemEvent | CronPayloadAgentTurn;

export interface CronDelivery {
  channel?: string;
  to?: string;
}

export interface CronJobState {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "skipped";
  lastError?: string;
  lastDurationMs?: number;
}

export interface CronJob {
  id: string;
  name: string;
  agentId?: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: "main" | "isolated";
  wakeMode: "next-heartbeat" | "now";
  payload: CronPayload;
  delivery?: CronDelivery;
  state: CronJobState;
}

export interface CronAddRequest {
  name: string;
  schedule: CronSchedule;
  payload: CronPayload;
  agentId?: string;
  description?: string;
  enabled?: boolean;
  deleteAfterRun?: boolean;
  sessionTarget?: "main" | "isolated";
  wakeMode?: "next-heartbeat" | "now";
  delivery?: CronDelivery;
}

export interface CronAddResult {
  job: CronJob;
}

export interface CronListRequest {
  includeDisabled?: boolean;
}

export interface CronListResult {
  jobs: CronJob[];
}

export interface CronRemoveRequest {
  id?: string;
  jobId?: string;
}

export interface CronRemoveResult {
  removed: boolean;
}

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
