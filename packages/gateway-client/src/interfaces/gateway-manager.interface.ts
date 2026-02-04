// ---------------------------------------------------------------------------
// IGatewayManager — Interface for managing a pool of Gateway client connections
// ---------------------------------------------------------------------------

import type { IGatewayClient } from "./gateway-client.interface";
import type { GatewayConnectionOptions } from "../protocol";
import type { GatewayInterceptor } from "../interceptors/interface";

/**
 * Interface for managing a pool of Gateway client connections.
 * Enables dependency injection and testing with mock implementations.
 */
export interface IGatewayManager {
  /**
   * Get an existing connected client for the given instance, or create and
   * connect a new one.
   */
  getClient(
    instanceId: string,
    options: GatewayConnectionOptions,
    interceptors?: GatewayInterceptor[],
  ): Promise<IGatewayClient>;

  /**
   * Disconnect and remove a specific client from the pool.
   */
  removeClient(instanceId: string): void;

  /**
   * Disconnect all clients and clear the pool.
   */
  disconnectAll(): Promise<void>;

  /**
   * Return the instance IDs of all currently connected clients.
   */
  getConnectedInstances(): string[];
}
