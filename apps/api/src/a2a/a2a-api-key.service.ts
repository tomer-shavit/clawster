import { Injectable, Inject, Logger } from "@nestjs/common";
import {
  ROUTING_REPOSITORY,
  IRoutingRepository,
} from "@clawster/database";
import * as crypto from "crypto";

@Injectable()
export class A2aApiKeyService {
  private readonly logger = new Logger(A2aApiKeyService.name);

  constructor(
    @Inject(ROUTING_REPOSITORY) private readonly routingRepo: IRoutingRepository,
  ) {}

  /**
   * Generate a new API key for a bot instance.
   * Returns the plaintext key once — it is never stored.
   */
  async generate(
    botInstanceId: string,
    label?: string,
  ): Promise<{ key: string; id: string }> {
    const randomBytes = crypto.randomBytes(32);
    const encoded = randomBytes
      .toString("base64url")
      .replace(/[=]/g, "");
    const key = `mh_a2a_${encoded}`;

    const keyHash = crypto.createHash("sha256").update(key).digest("hex");
    const keyPrefix = key.slice(0, 12) + "...";

    const record = await this.routingRepo.createApiKey({
      keyHash,
      keyPrefix,
      label: label || null,
      botInstance: { connect: { id: botInstanceId } },
    });

    this.logger.log(
      `Generated API key ${keyPrefix} for bot ${botInstanceId}`,
    );

    return { key, id: record.id };
  }

  /**
   * Validate an API key for a specific bot instance.
   * Returns true if valid, false otherwise.
   */
  async validate(botInstanceId: string, key: string): Promise<boolean> {
    const verified = await this.routingRepo.verifyApiKey(key);

    if (!verified) return false;

    // Ensure the key belongs to the correct bot instance
    if (verified.botInstanceId !== botInstanceId) {
      return false;
    }

    // Update last used timestamp (fire-and-forget)
    this.routingRepo.recordApiKeyUsage(verified.id).catch(() => {});

    return true;
  }

  /**
   * List all API keys for a bot instance (no hashes returned).
   */
  async list(botInstanceId: string) {
    const keys = await this.routingRepo.findApiKeysByBotInstance(botInstanceId);
    // Return without sensitive hash data
    return keys.map((k) => ({
      id: k.id,
      keyPrefix: k.keyPrefix,
      label: k.label,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      isActive: k.isActive,
      createdAt: k.createdAt,
    }));
  }

  /**
   * Revoke an API key by setting isActive to false.
   */
  async revoke(keyId: string): Promise<void> {
    await this.routingRepo.revokeApiKey(keyId);
    this.logger.log(`Revoked API key ${keyId}`);
  }
}
