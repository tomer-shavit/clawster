import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { prisma } from "@clawster/database";
import { CredentialEncryptionService } from "./credential-encryption.service";
import { SaveCredentialDto, ListSavedCredentialsQueryDto } from "./credential-vault.dto";

@Injectable()
export class CredentialVaultService {
  private readonly logger = new Logger(CredentialVaultService.name);

  constructor(private readonly encryption: CredentialEncryptionService) {}

  /** Save credentials encrypted, return masked version */
  async save(dto: SaveCredentialDto, userId: string) {
    this.validateCredentialShape(dto.type, dto.credentials);

    const encrypted = this.encryption.encrypt(dto.credentials);
    const masked = this.encryption.mask(dto.type, dto.credentials);

    const connector = await prisma.integrationConnector.create({
      data: {
        workspaceId: dto.workspaceId,
        name: dto.name,
        description: `Saved ${dto.type} credential`,
        type: dto.type,
        config: encrypted,
        status: "ACTIVE",
        isShared: true,
        tags: JSON.stringify({ credentialVault: true }),
        createdBy: userId,
      },
    });

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        workspaceId: dto.workspaceId,
        action: "credential.save",
        resourceType: "IntegrationConnector",
        resourceId: connector.id,
        actor: userId,
        metadata: JSON.stringify({ type: dto.type, name: dto.name }),
      },
    });

    this.logger.debug(`Saved ${dto.type} credential "${dto.name}" (${connector.id})`);

    return {
      id: connector.id,
      name: connector.name,
      type: connector.type,
      maskedConfig: masked,
      createdAt: connector.createdAt.toISOString(),
    };
  }

  /** List saved credentials with masked configs */
  async listSaved(query: ListSavedCredentialsQueryDto) {
    const connectors = await prisma.integrationConnector.findMany({
      where: {
        workspaceId: query.workspaceId,
        ...(query.type ? { type: query.type } : { type: { in: ["aws-account", "api-key"] } }),
        tags: { contains: "credentialVault" },
      },
      orderBy: { createdAt: "desc" },
    });

    return connectors.map((c) => {
      let maskedConfig: Record<string, unknown> = {};
      try {
        const decrypted = this.encryption.decrypt(c.config);
        maskedConfig = this.encryption.mask(c.type, decrypted);
      } catch (err) {
        this.logger.warn(`Failed to decrypt credential ${c.id}: ${err instanceof Error ? err.message : "unknown"}`);
        maskedConfig = {};
      }

      return {
        id: c.id,
        name: c.name,
        type: c.type,
        maskedConfig,
        createdAt: c.createdAt.toISOString(),
      };
    });
  }

  /** Resolve credentials for internal use only (returns plaintext). Never expose via HTTP. */
  async resolve(id: string, userId: string, workspaceId: string): Promise<Record<string, unknown>> {
    const connector = await prisma.integrationConnector.findUnique({
      where: { id },
    });

    if (!connector || connector.workspaceId !== workspaceId) {
      throw new NotFoundException(`Saved credential ${id} not found`);
    }

    // Increment usage
    await prisma.integrationConnector.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    // Audit the access
    await prisma.auditEvent.create({
      data: {
        workspaceId: connector.workspaceId,
        action: "credential.access",
        resourceType: "IntegrationConnector",
        resourceId: id,
        actor: userId,
        metadata: JSON.stringify({ type: connector.type, name: connector.name }),
      },
    });

    return this.encryption.decrypt(connector.config);
  }

  /** Delete a saved credential */
  async delete(id: string, userId: string, workspaceId: string): Promise<void> {
    const connector = await prisma.integrationConnector.findUnique({
      where: { id },
    });

    if (!connector || connector.workspaceId !== workspaceId) {
      throw new NotFoundException(`Saved credential ${id} not found`);
    }

    await prisma.integrationConnector.delete({ where: { id } });

    await prisma.auditEvent.create({
      data: {
        workspaceId: connector.workspaceId,
        action: "credential.delete",
        resourceType: "IntegrationConnector",
        resourceId: id,
        actor: userId,
        metadata: JSON.stringify({ type: connector.type, name: connector.name }),
      },
    });

    this.logger.debug(`Deleted saved credential "${connector.name}" (${id})`);
  }

  /** Validate that credential objects contain required fields for their type */
  private validateCredentialShape(type: string, credentials: Record<string, unknown>): void {
    if (type === "aws-account") {
      if (!credentials.accessKeyId || typeof credentials.accessKeyId !== "string") {
        throw new BadRequestException("AWS credentials must include accessKeyId");
      }
      if (!credentials.secretAccessKey || typeof credentials.secretAccessKey !== "string") {
        throw new BadRequestException("AWS credentials must include secretAccessKey");
      }
    } else if (type === "api-key") {
      if (!credentials.apiKey || typeof credentials.apiKey !== "string") {
        throw new BadRequestException("API key credentials must include apiKey");
      }
      if (!credentials.provider || typeof credentials.provider !== "string") {
        throw new BadRequestException("API key credentials must include provider");
      }
    }
  }
}
