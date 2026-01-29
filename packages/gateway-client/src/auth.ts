// ---------------------------------------------------------------------------
// Auth Helpers — build connect-frame auth payloads
// ---------------------------------------------------------------------------

import type { GatewayAuth, ConnectFrame, GatewayConnectionOptions } from "./protocol";
import { PROTOCOL_VERSION } from "./protocol";

/**
 * Build the auth section for the connect frame based on connection options.
 */
export function buildAuth(auth: GatewayAuth): GatewayAuth {
  if (auth.mode === "token") {
    return { mode: "token", token: auth.token };
  }
  return { mode: "password", password: auth.password };
}

/**
 * Build the full connect frame sent as the first message after the WebSocket
 * connection opens.
 */
export function buildConnectFrame(options: GatewayConnectionOptions): ConnectFrame {
  const frame: ConnectFrame = {
    type: "connect",
    protocolVersion: options.protocolVersion ?? {
      min: PROTOCOL_VERSION,
      max: PROTOCOL_VERSION,
    },
    auth: buildAuth(options.auth),
  };

  if (options.clientMetadata) {
    frame.clientMetadata = options.clientMetadata;
  }

  return frame;
}

/**
 * Build the WebSocket URL for a gateway host and port.
 */
export function buildGatewayUrl(host: string, port: number): string {
  return `ws://${host}:${port}`;
}
