// ---------------------------------------------------------------------------
// WebSocketConnection — WebSocket lifecycle and handshake management
// ---------------------------------------------------------------------------

import WebSocket from "ws";
import type { GatewayConnectionOptions, ConnectResult } from "../protocol";
import { GatewayErrorCode } from "../protocol";
import { buildConnectFrame, buildGatewayUrl } from "../auth";
import {
  GatewayConnectionError,
  GatewayTimeoutError,
  GatewayAuthError,
} from "../errors";
import type { IWebSocketFactory } from "../interfaces/websocket-factory.interface";
import type { ConnectionState, IWebSocketConnection, IConnectionCallbacks } from "./interfaces";

/**
 * Manages WebSocket lifecycle and handshake.
 * Single responsibility: socket creation, handshake, and cleanup.
 */
export class WebSocketConnection implements IWebSocketConnection {
  private _state: ConnectionState = "disconnected";
  private _socket: WebSocket | null = null;
  private readonly wsFactory: IWebSocketFactory;
  private readonly callbacks: IConnectionCallbacks;

  constructor(wsFactory: IWebSocketFactory, callbacks: IConnectionCallbacks) {
    this.wsFactory = wsFactory;
    this.callbacks = callbacks;
  }

  get state(): ConnectionState {
    return this._state;
  }

  isConnected(): boolean {
    return this._state === "connected" && this._socket?.readyState === WebSocket.OPEN;
  }

  send(data: string): void {
    if (!this.isConnected() || !this._socket) {
      throw new GatewayConnectionError("Not connected to gateway");
    }
    this._socket.send(data);
  }

  connect(options: GatewayConnectionOptions, timeoutMs: number): Promise<ConnectResult> {
    return new Promise<ConnectResult>((resolve, reject) => {
      const url = buildGatewayUrl(options.host, options.port);
      this._state = "connecting";

      try {
        this._socket = this.wsFactory.create(url);
      } catch (err) {
        this._state = "disconnected";
        reject(
          new GatewayConnectionError(
            `Failed to create WebSocket: ${(err as Error).message}`,
          ),
        );
        return;
      }

      const connectTimeout = setTimeout(() => {
        if (this._socket) {
          this._socket.terminate();
        }
        this._state = "disconnected";
        reject(new GatewayTimeoutError("Connect handshake timed out"));
      }, timeoutMs);

      // OpenClaw handshake flow:
      // 1. WebSocket opens
      // 2. Gateway sends connect.challenge event with nonce
      // 3. Client sends connect frame
      // 4. Gateway responds with connect result
      this._socket.once("open", () => {
        // Don't send anything yet — wait for the challenge
      });

      // First message is the connect.challenge from the gateway
      this._socket.once("message", (challengeRaw: WebSocket.Data) => {
        try {
          // Validate that the challenge is valid JSON
          JSON.parse(challengeRaw.toString());
        } catch {
          clearTimeout(connectTimeout);
          this.cleanup();
          reject(new GatewayConnectionError("Invalid challenge message"));
          return;
        }

        // Send connect frame
        const frame = buildConnectFrame(options);
        this._socket!.send(JSON.stringify(frame));

        // Second message is the connect result
        this._socket!.once("message", (resultRaw: WebSocket.Data) => {
          clearTimeout(connectTimeout);

          let data: Record<string, unknown>;
          try {
            data = JSON.parse(resultRaw.toString()) as Record<string, unknown>;
          } catch {
            this.cleanup();
            reject(new GatewayConnectionError("Invalid connect response"));
            return;
          }

          // OpenClaw response format: { type: "res", id, ok, payload/error }
          if (data.type === "res" && data.ok === false) {
            this.cleanup();
            const err = data.error as { code?: string; message?: string } | undefined;
            const msg = err?.message ?? "Connection rejected";
            const code = err?.code ?? "";
            if (code === "UNAVAILABLE" || msg.toLowerCase().includes("auth")) {
              reject(new GatewayAuthError(msg, code as GatewayErrorCode));
            } else {
              reject(new GatewayConnectionError(msg, code as GatewayErrorCode));
            }
            return;
          }

          // Normalize to ConnectResult for callers
          const result: ConnectResult = data as unknown as ConnectResult;

          this._state = "connected";
          this.attachListeners();
          resolve(result);
        });
      });

      this._socket.once("error", (err: Error) => {
        clearTimeout(connectTimeout);
        this._state = "disconnected";
        reject(new GatewayConnectionError(err.message));
      });

      this._socket.once("close", () => {
        clearTimeout(connectTimeout);
        if (this._state !== "connected") {
          this._state = "disconnected";
          reject(new GatewayConnectionError("Connection closed before handshake completed"));
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    await this.closeSocket();
  }

  private attachListeners(): void {
    if (!this._socket) return;

    this._socket.on("message", (raw: WebSocket.Data) => {
      this.callbacks.onMessage(raw.toString());
    });

    this._socket.on("close", () => {
      this._state = "disconnected";
      this.callbacks.onDisconnected();
    });

    this._socket.on("error", (err: Error) => {
      this.callbacks.onError(err);
    });
  }

  private cleanup(): void {
    this._state = "disconnected";
    if (this._socket) {
      this._socket.removeAllListeners();
      if (
        this._socket.readyState === WebSocket.OPEN ||
        this._socket.readyState === WebSocket.CONNECTING
      ) {
        this._socket.terminate();
      }
      this._socket = null;
    }
  }

  private closeSocket(): Promise<void> {
    return new Promise((resolve) => {
      if (
        !this._socket ||
        this._socket.readyState === WebSocket.CLOSED ||
        this._socket.readyState === WebSocket.CLOSING
      ) {
        this.cleanup();
        resolve();
        return;
      }

      this._socket.once("close", () => {
        this.cleanup();
        resolve();
      });

      this._socket.close();

      // Safety: force-terminate if close doesn't complete quickly
      setTimeout(() => {
        this.cleanup();
        resolve();
      }, 3_000);
    });
  }
}
