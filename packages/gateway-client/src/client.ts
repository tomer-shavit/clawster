// ---------------------------------------------------------------------------
// GatewayClient — WebSocket client for the OpenClaw Gateway protocol
// ---------------------------------------------------------------------------

import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";

import { InterceptorChain } from "./interceptors/chain";
import type { GatewayInterceptor, OutboundMessage, InboundMessage, GatewayInterceptorEvent } from "./interceptors/interface";
import { PendingRequestTracker } from "./connection/pending-request-tracker";
import { WebSocketConnection } from "./connection/websocket-connection";
import { MessageRouter } from "./routing/message-router";
import { ReconnectionManager } from "./reconnect/reconnection-manager";
import type { IConnectionCallbacks } from "./connection/interfaces";
import type { IMessageRouterCallbacks, ParsedResponse } from "./routing/interfaces";
import type { IReconnectionCallbacks } from "./reconnect/interfaces";
import type { IGatewayClient } from "./interfaces/gateway-client.interface";
import { type IWebSocketFactory, DefaultWebSocketFactory } from "./interfaces/websocket-factory.interface";

import type {
  GatewayConnectionOptions,
  GatewayEvent,
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
  AgentAck,
  AgentCompletion,
  AgentOutputEvent,
  PresenceEvent,
  ShutdownEvent,
  CostUsageSummary,
  AgentIdentityResult,
  CronAddRequest,
  CronAddResult,
  CronListRequest,
  CronListResult,
  CronRemoveRequest,
  CronRemoveResult,
} from "./protocol";
import { GatewayErrorCode } from "./protocol";
import {
  GatewayError,
  GatewayConnectionError,
  GatewayTimeoutError,
} from "./errors";

// ---- Defaults -------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;

// ---- Client ---------------------------------------------------------------

export class GatewayClient extends EventEmitter implements IGatewayClient {
  private readonly options: GatewayConnectionOptions;
  private readonly timeoutMs: number;

  private intentionalClose = false;

  private readonly pending: PendingRequestTracker;
  private readonly interceptorChain: InterceptorChain;
  private readonly connection: WebSocketConnection;
  private readonly router: MessageRouter;
  private readonly reconnector: ReconnectionManager;

  constructor(
    options: GatewayConnectionOptions,
    interceptors?: GatewayInterceptor[],
    wsFactory?: IWebSocketFactory,
  ) {
    super();
    this.options = options;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    this.interceptorChain = new InterceptorChain(interceptors);
    this.pending = new PendingRequestTracker();

    // Initialize connection with callbacks
    const connectionCallbacks: IConnectionCallbacks = {
      onDisconnected: () => {
        this.emit("disconnect");
        this.pending.rejectAll("Connection closed");
        if (!this.intentionalClose && this.reconnector.isEnabled) {
          this.reconnector.scheduleReconnect();
        }
      },
      onError: (err: Error) => {
        this.emit("error", new GatewayConnectionError(err.message));
      },
      onMessage: (data: string) => {
        this.router.route(data);
      },
    };
    this.connection = new WebSocketConnection(
      wsFactory ?? new DefaultWebSocketFactory(),
      connectionCallbacks,
    );

    // Initialize router with callbacks
    const routerCallbacks: IMessageRouterCallbacks = {
      onResponse: (response: ParsedResponse) => this.handleResponse(response),
      onEvent: (event: GatewayEvent) => this.handleEvent(event),
    };
    this.router = new MessageRouter((id: string) => this.pending.has(id));
    this.router.setCallbacks(routerCallbacks);

    // Initialize reconnection manager with callbacks
    const reconnectCallbacks: IReconnectionCallbacks = {
      onReconnectAttempt: (attempt: number) => this.emit("reconnect", attempt),
      onMaxAttemptsReached: (maxAttempts: number) => {
        this.emit(
          "error",
          new GatewayConnectionError(`Max reconnect attempts (${maxAttempts}) reached`),
        );
      },
      performReconnect: () => this.connect().then(() => {}),
    };
    this.reconnector = new ReconnectionManager(options.reconnect, reconnectCallbacks);
  }

  /** Access the interceptor chain for adding/removing interceptors at runtime. */
  get interceptors(): InterceptorChain {
    return this.interceptorChain;
  }

  // ------------------------------------------------------------------
  // Connection lifecycle
  // ------------------------------------------------------------------

  /**
   * Open the WebSocket, perform the protocol handshake, and return the
   * connect result (presence snapshot, health, state version).
   */
  async connect(): Promise<ConnectResult> {
    this.intentionalClose = false;
    this.reconnector.resetAttempts();
    return this.connection.connect(this.options, this.timeoutMs);
  }

  /**
   * Gracefully close the WebSocket connection. Rejects all pending requests.
   */
  async disconnect(): Promise<void> {
    this.intentionalClose = true;
    this.reconnector.cancelReconnect();
    this.pending.rejectAll("Client disconnected");
    await this.connection.disconnect();
  }

  /** Returns `true` if the underlying WebSocket is open and handshake completed. */
  isConnected(): boolean {
    return this.connection.isConnected();
  }

  // ------------------------------------------------------------------
  // RPC methods
  // ------------------------------------------------------------------

  /** Request a health snapshot. */
  async health(): Promise<GatewayHealthSnapshot> {
    return this.request<GatewayHealthSnapshot>("health");
  }

  /** Request a status summary. */
  async status(): Promise<GatewayStatusSummary> {
    return this.request<GatewayStatusSummary>("status");
  }

  /** Get current configuration and its hash. */
  async configGet(): Promise<ConfigGetResult> {
    return this.request<ConfigGetResult>("config.get");
  }

  /** Replace the full configuration (optimistic concurrency via baseHash). */
  async configApply(config: ConfigApplyRequest): Promise<ConfigApplyResult> {
    return this.request<ConfigApplyResult>("config.apply", config as unknown as Record<string, unknown>);
  }

  /** Merge-patch the configuration (optimistic concurrency via baseHash). */
  async configPatch(patch: ConfigPatchRequest): Promise<ConfigPatchResult> {
    return this.request<ConfigPatchResult>("config.patch", patch as unknown as Record<string, unknown>);
  }

  /** Get the resolved agent identity (name + avatar from IDENTITY.md / config). */
  async agentIdentityGet(agentId?: string): Promise<AgentIdentityResult> {
    return this.request<AgentIdentityResult>(
      "agent.identity.get",
      agentId ? { agentId } : undefined,
    );
  }

  /** Request token usage / cost summary. */
  async usageCost(days?: number): Promise<CostUsageSummary> {
    return this.request<CostUsageSummary>("usage.cost", days ? { days } : undefined);
  }

  /** Send a message via an active channel. */
  async send(message: SendRequest): Promise<SendResult> {
    return this.request<SendResult>("send", message as unknown as Record<string, unknown>);
  }

  // ------------------------------------------------------------------
  // Cron job management
  // ------------------------------------------------------------------

  /** Add a new cron job. */
  async cronAdd(request: CronAddRequest): Promise<CronAddResult> {
    return this.request<CronAddResult>("cron.add", request as unknown as Record<string, unknown>);
  }

  /** List all cron jobs. */
  async cronList(request?: CronListRequest): Promise<CronListResult> {
    return this.request<CronListResult>("cron.list", request as Record<string, unknown> | undefined);
  }

  /** Remove a cron job by ID. */
  async cronRemove(request: CronRemoveRequest): Promise<CronRemoveResult> {
    return this.request<CronRemoveResult>("cron.remove", request as unknown as Record<string, unknown>);
  }

  /**
   * Execute an agent prompt. The gateway acknowledges immediately, then
   * streams `agentOutput` events, and finally sends a completion response.
   * This method resolves with both the ack and the completion.
   */
  async agent(request: AgentRequest): Promise<AgentResult> {
    const id = uuidv4();

    // Strip _localTimeoutMs before sending — it's a client-only field.
    const { _localTimeoutMs, ...wireParams } = request;
    const msg: Record<string, unknown> = { type: "req", id, method: "agent", params: wireParams as unknown as Record<string, unknown> };

    this.ensureConnected();

    // Phase 1: Get the ack (first res frame).
    const ack = await new Promise<AgentAck>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.remove(id);
        reject(new GatewayTimeoutError("Agent ack timed out"));
      }, this.timeoutMs);

      this.pending.add(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });

      this.connection.send(JSON.stringify(msg));
    });

    // Phase 2: Wait for the completion (second res frame with the SAME id).
    const agentTimeoutMs = _localTimeoutMs ?? request.timeout ?? 60_000;
    const completion = await new Promise<AgentCompletion>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.remove(id);
        reject(new GatewayTimeoutError("Agent completion timed out"));
      }, agentTimeoutMs);

      this.pending.add(id, {
        resolve: (raw: unknown) => {
          clearTimeout(timer);
          const payload = raw as Record<string, unknown> | undefined;

          // Extract the agent text output from the completion payload.
          let output: string | undefined;
          const result = payload?.result as Record<string, unknown> | undefined;
          if (result) {
            const payloads = result.payloads as Array<Record<string, unknown>> | undefined;
            if (payloads?.[0]?.text) {
              output = payloads.map((p) => p.text as string).join("\n");
            } else if (typeof result === "string") {
              output = result;
            }
          }

          resolve({
            runId: (payload?.runId ?? ack.runId) as string,
            status: payload?.status === "error" ? "failed" : "completed",
            output,
            error: payload?.error as string | undefined,
          });
        },
        reject: (err: unknown) => {
          clearTimeout(timer);
          resolve({
            runId: ack.runId,
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          });
        },
        timer,
      });
    });

    return { ack, completion };
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private ensureConnected(): void {
    if (!this.isConnected()) {
      throw new GatewayConnectionError("Not connected to gateway");
    }
  }

  /**
   * Generic request/response helper. Sends a JSON message over the WebSocket
   * and returns a promise that resolves with the `result` field of the
   * response, or rejects with a typed error.
   */
  private async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    this.ensureConnected();

    const id = uuidv4();
    const outbound: OutboundMessage = { id, method, params };

    // Run outbound interceptors
    const processed = await this.interceptorChain.processOutbound(outbound);
    if (processed === null) {
      return null as unknown as T; // Short-circuited by interceptor
    }

    // OpenClaw expects: { type: "req", id, method, params }
    const msg: Record<string, unknown> = { type: "req", id: processed.id, method: processed.method };
    if (processed.params !== undefined) {
      msg.params = processed.params;
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.remove(id);
        reject(new GatewayTimeoutError(`Request "${method}" timed out`));
      }, this.timeoutMs);

      this.pending.add(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      });

      this.connection.send(JSON.stringify(msg));
    });
  }

  private handleResponse(response: ParsedResponse): void {
    const pendingReq = this.pending.get(response.id);
    if (!pendingReq) return;

    // Remove from tracker (clears timer)
    this.pending.remove(response.id);

    // Build inbound message for interceptor chain
    const inbound: InboundMessage = { id: response.id };
    if (!response.isOk && response.error) {
      inbound.error = { code: response.error.code, message: response.error.message };
    } else {
      inbound.result = response.result;
    }

    // Run inbound interceptors, then resolve/reject
    this.interceptorChain
      .processInbound(inbound)
      .then((processed) => {
        if (processed.error) {
          pendingReq.reject(
            new GatewayError(processed.error.message, processed.error.code as GatewayErrorCode),
          );
        } else {
          pendingReq.resolve(processed.result);
        }
      })
      .catch((err) => {
        pendingReq.reject(err);
      });
  }

  private handleEvent(event: GatewayEvent): void {
    // Run event interceptors (fire-and-forget)
    const interceptorEvent: GatewayInterceptorEvent = {
      type: event.type,
      data: event as unknown as Record<string, unknown>,
    };
    this.interceptorChain.processEvent(interceptorEvent).catch(() => {
      // Swallow interceptor errors for events
    });

    switch (event.type) {
      case "agentOutput":
        this.emit("agentOutput", event as AgentOutputEvent);
        break;
      case "presence":
        this.emit("presence", event as PresenceEvent);
        break;
      case "keepalive":
        this.emit("keepalive");
        break;
      case "shutdown":
        this.emit("shutdown", event as ShutdownEvent);
        break;
    }
  }
}
