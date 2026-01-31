// ---------------------------------------------------------------------------
// Auth Helpers — build connect-frame auth payloads
// ---------------------------------------------------------------------------

import { v4 as uuidv4 } from "uuid";
import type { GatewayAuth, ConnectFrame, GatewayConnectionOptions } from "./protocol";
import { PROTOCOL_VERSION } from "./protocol";

/**
 * Build the auth section for the connect frame params.
 * OpenClaw expects { token?: string; password?: string } — no "mode" field.
 */
export function buildAuth(auth: GatewayAuth): { token?: string; password?: string } {
  if (auth.mode === "token") {
    return { token: auth.token };
  }
  return { password: auth.password };
}

/**
 * Build the full connect frame sent as the first message after the WebSocket
 * connection opens.
 *
 * OpenClaw expects: { type: "req", id: UUID, method: "connect", params: { ... } }
 */
export function buildConnectFrame(options: GatewayConnectionOptions): ConnectFrame {
  const params: ConnectFrame["params"] = {
    minProtocol: options.protocolVersion?.min ?? PROTOCOL_VERSION,
    maxProtocol: options.protocolVersion?.max ?? PROTOCOL_VERSION,
    client: {
      id: options.clientMetadata?.name ?? "gateway-client",
      version: options.clientMetadata?.version ?? "0.1.0",
      platform: "node",
      mode: "backend",
    },
    auth: buildAuth(options.auth),
    role: "operator",
  };

  return {
    type: "req",
    id: uuidv4(),
    method: "connect",
    params,
  };
}

/**
 * Build the WebSocket URL for a gateway host and port.
 */
export function buildGatewayUrl(host: string, port: number): string {
  return `ws://${host}:${port}`;
}
