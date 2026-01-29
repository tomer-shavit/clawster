// ---------------------------------------------------------------------------
// Gateway Error Classes
// ---------------------------------------------------------------------------

import { GatewayErrorCode } from "./protocol";

/**
 * Base error for all gateway-related errors.
 */
export class GatewayError extends Error {
  public readonly code: GatewayErrorCode;

  constructor(message: string, code: GatewayErrorCode) {
    super(message);
    this.name = "GatewayError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Raised when the WebSocket connection cannot be established or is lost
 * unexpectedly.
 */
export class GatewayConnectionError extends GatewayError {
  constructor(message: string, code: GatewayErrorCode = GatewayErrorCode.UNAVAILABLE) {
    super(message, code);
    this.name = "GatewayConnectionError";
  }
}

/**
 * Raised when a request or connection attempt exceeds the configured timeout.
 */
export class GatewayTimeoutError extends GatewayError {
  constructor(message: string, code: GatewayErrorCode = GatewayErrorCode.AGENT_TIMEOUT) {
    super(message, code);
    this.name = "GatewayTimeoutError";
  }
}

/**
 * Raised when authentication fails during the connect handshake.
 */
export class GatewayAuthError extends GatewayError {
  constructor(message: string, code: GatewayErrorCode = GatewayErrorCode.UNAVAILABLE) {
    super(message, code);
    this.name = "GatewayAuthError";
  }
}
