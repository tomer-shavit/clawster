import { Injectable, Inject, Logger } from "@nestjs/common";
import type { BotInstance } from "@clawster/database";
import {
  BOT_INSTANCE_REPOSITORY,
  type IBotInstanceRepository,
} from "@clawster/database";
import type { IdentityConfig } from "@clawster/core";
import type { IConfigInjector, ConfigSnapshot } from "./interfaces";
import {
  type IGatewayConnectionService,
  GATEWAY_CONNECTION_SERVICE,
} from "../../reconciler/interfaces/gateway-connection.interface";

// =============================================================================
// Config Injector Service
// =============================================================================

/**
 * ConfigInjectorService — injects configuration into running bot instances.
 *
 * Single Responsibility: Manage config injection via Gateway RPC.
 * Uses the existing GatewayConnectionService to obtain connected clients.
 */
@Injectable()
export class ConfigInjectorService implements IConfigInjector {
  private readonly logger = new Logger(ConfigInjectorService.name);

  constructor(
    @Inject(BOT_INSTANCE_REPOSITORY)
    private readonly botInstanceRepo: IBotInstanceRepository,
    @Inject(GATEWAY_CONNECTION_SERVICE)
    private readonly gatewayConnectionService: IGatewayConnectionService,
  ) {}

  /**
   * Get the current config and its hash from a bot instance.
   */
  async getConfig(instanceId: string): Promise<ConfigSnapshot> {
    const instance = await this.getInstance(instanceId);
    const client = await this.gatewayConnectionService.getGatewayClient(instance);

    const result = await client.configGet();
    return {
      config: result.config,
      hash: result.hash,
    };
  }

  /**
   * Apply a config patch to a bot instance.
   */
  async applyPatch(
    instanceId: string,
    patch: Record<string, unknown>,
    baseHash: string,
  ): Promise<void> {
    const instance = await this.getInstance(instanceId);
    const client = await this.gatewayConnectionService.getGatewayClient(instance);

    // Convert patch to JSON5 string for config.apply
    const raw = JSON.stringify(patch, null, 2);

    const result = await client.configApply({
      raw,
      baseHash,
    });

    if (result.validationErrors && result.validationErrors.length > 0) {
      throw new Error(
        `Config validation failed: ${result.validationErrors.join(", ")}`,
      );
    }

    this.logger.log(`Config applied to instance ${instanceId}`);
  }

  /**
   * Inject identity configuration into a bot instance.
   * Maps to agents.list[].identity in OpenClaw config.
   */
  async injectIdentity(
    instanceId: string,
    identity: IdentityConfig,
  ): Promise<void> {
    const { config, hash } = await this.getConfig(instanceId);

    // Build the identity patch
    const identityPatch = {
      name: identity.name,
      ...(identity.emoji && { emoji: identity.emoji }),
      ...(identity.theme && { theme: identity.theme }),
      ...(identity.avatar && { avatar: identity.avatar }),
    };

    // Deep merge into existing config
    const patchedConfig = this.deepMerge(config, {
      agents: {
        list: [
          {
            id: "main",
            identity: identityPatch,
          },
        ],
      },
    });

    await this.applyPatch(instanceId, patchedConfig, hash);
    this.logger.log(`Identity injected for instance ${instanceId}: ${identity.name}`);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async getInstance(instanceId: string): Promise<BotInstance> {
    const instance = await this.botInstanceRepo.findById(instanceId);
    if (!instance) {
      throw new Error(`Bot instance ${instanceId} not found`);
    }
    return instance;
  }

  /**
   * Deep merge source into target, returning a new object.
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...target };

    for (const key of Object.keys(source)) {
      const srcVal = source[key];
      const tgtVal = result[key];

      if (this.isPlainObject(srcVal) && this.isPlainObject(tgtVal)) {
        result[key] = this.deepMerge(
          tgtVal as Record<string, unknown>,
          srcVal as Record<string, unknown>,
        );
      } else if (Array.isArray(srcVal) && Array.isArray(tgtVal)) {
        // For agents.list, merge by id
        if (key === "list" && srcVal.length > 0 && this.hasIdField(srcVal[0])) {
          result[key] = this.mergeArrayById(
            tgtVal as Array<Record<string, unknown>>,
            srcVal as Array<Record<string, unknown>>,
          );
        } else {
          result[key] = srcVal;
        }
      } else {
        result[key] = srcVal;
      }
    }

    return result;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  }

  private hasIdField(item: unknown): boolean {
    return this.isPlainObject(item) && typeof item.id === "string";
  }

  private mergeArrayById(
    target: Array<Record<string, unknown>>,
    source: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    const result = [...target];

    for (const srcItem of source) {
      const srcId = srcItem.id as string;
      const existingIndex = result.findIndex((t) => t.id === srcId);

      if (existingIndex >= 0) {
        result[existingIndex] = this.deepMerge(result[existingIndex], srcItem);
      } else {
        result.push(srcItem);
      }
    }

    return result;
  }
}
