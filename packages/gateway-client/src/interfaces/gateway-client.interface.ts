// ---------------------------------------------------------------------------
// IGatewayClient — Interface for Gateway client operations
// ---------------------------------------------------------------------------

import type { EventEmitter } from "events";
import type {
  ConnectResult,
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
  AgentResult,
  AgentIdentityResult,
  CostUsageSummary,
  CronAddRequest,
  CronAddResult,
  CronListRequest,
  CronListResult,
  CronRemoveRequest,
  CronRemoveResult,
} from "../protocol";

/**
 * Interface for Gateway client operations.
 * Enables dependency injection and testing with mock implementations.
 */
export interface IGatewayClient extends EventEmitter {
  // Connection lifecycle
  connect(): Promise<ConnectResult>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // RPC methods
  health(): Promise<GatewayHealthSnapshot>;
  status(): Promise<GatewayStatusSummary>;
  configGet(): Promise<ConfigGetResult>;
  configApply(config: ConfigApplyRequest): Promise<ConfigApplyResult>;
  configPatch(patch: ConfigPatchRequest): Promise<ConfigPatchResult>;
  agentIdentityGet(agentId?: string): Promise<AgentIdentityResult>;
  usageCost(days?: number): Promise<CostUsageSummary>;
  send(message: SendRequest): Promise<SendResult>;
  agent(request: AgentRequest): Promise<AgentResult>;

  // Cron job management
  cronAdd(request: CronAddRequest): Promise<CronAddResult>;
  cronList(request?: CronListRequest): Promise<CronListResult>;
  cronRemove(request: CronRemoveRequest): Promise<CronRemoveResult>;
}
