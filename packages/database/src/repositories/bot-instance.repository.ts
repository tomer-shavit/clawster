import { PrismaClient, BotInstance, GatewayConnection, Prisma } from "@prisma/client";
import type {
  IBotInstanceRepository,
  BotInstanceFilters,
  BotInstanceWithRelations,
  StatusGroupResult,
  HealthGroupResult,
  GatewayConnectionUpsertData,
} from "../interfaces/bot-instance.repository";
import type {
  PaginationOptions,
  PaginatedResult,
  TransactionClient,
} from "../interfaces/base";

type PrismaTransactionClient = TransactionClient | PrismaClient;

export class PrismaBotInstanceRepository implements IBotInstanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: TransactionClient): PrismaTransactionClient {
    return tx ?? this.prisma;
  }

  private buildWhereClause(filters?: BotInstanceFilters): Prisma.BotInstanceWhereInput {
    if (!filters) return {};

    const where: Prisma.BotInstanceWhereInput = {};

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    }

    if (filters.fleetId) {
      where.fleetId = filters.fleetId;
    }

    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    if (filters.health) {
      where.health = Array.isArray(filters.health)
        ? { in: filters.health }
        : filters.health;
    }

    if (filters.deploymentType) {
      where.deploymentType = filters.deploymentType;
    }

    if (filters.templateId) {
      where.templateId = filters.templateId;
    }

    if (filters.search) {
      where.name = { contains: filters.search };
    }

    if (filters.gatewayPortNotNull) {
      where.gatewayPort = { not: null };
    }

    if (filters.hasGatewayConnection) {
      where.gatewayConnection = { isNot: null };
    }

    if (filters.tags && Object.keys(filters.tags).length > 0) {
      // SQLite doesn't support JSON queries directly, so we do a string contains
      // This is a simplified approach; for production, consider a more robust solution
      const tagConditions = Object.entries(filters.tags).map(([key, value]) => ({
        tags: { contains: `"${key}":"${value}"` },
      }));
      where.AND = tagConditions;
    }

    return where;
  }

  async findById(
    id: string,
    tx?: TransactionClient
  ): Promise<BotInstanceWithRelations | null> {
    const client = this.getClient(tx);
    return client.botInstance.findUnique({
      where: { id },
      include: {
        gatewayConnection: true,
        fleet: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findFirst(
    filters: BotInstanceFilters,
    tx?: TransactionClient
  ): Promise<BotInstance | null> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);
    return client.botInstance.findFirst({ where });
  }

  async findByIds(
    ids: string[],
    tx?: TransactionClient
  ): Promise<BotInstanceWithRelations[]> {
    const client = this.getClient(tx);
    return client.botInstance.findMany({
      where: { id: { in: ids } },
      include: {
        gatewayConnection: true,
        fleet: {
          select: { id: true, name: true, environment: true },
        },
        connectorBindings: {
          include: {
            connector: {
              select: {
                id: true,
                name: true,
                type: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  async findMany(
    filters?: BotInstanceFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<BotInstance>> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      client.botInstance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      client.botInstance.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByWorkspace(
    workspaceId: string,
    filters?: Omit<BotInstanceFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<BotInstance[]> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause({ ...filters, workspaceId });

    return client.botInstance.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async findByFleet(
    fleetId: string,
    filters?: Omit<BotInstanceFilters, "fleetId">,
    tx?: TransactionClient
  ): Promise<BotInstance[]> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause({ ...filters, fleetId });

    return client.botInstance.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async count(filters?: BotInstanceFilters, tx?: TransactionClient): Promise<number> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);
    return client.botInstance.count({ where });
  }

  async create(
    data: Prisma.BotInstanceCreateInput,
    tx?: TransactionClient
  ): Promise<BotInstance> {
    const client = this.getClient(tx);
    return client.botInstance.create({ data });
  }

  async update(
    id: string,
    data: Prisma.BotInstanceUpdateInput,
    tx?: TransactionClient
  ): Promise<BotInstance> {
    const client = this.getClient(tx);
    return client.botInstance.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.botInstance.delete({ where: { id } });
  }

  async updateStatus(
    id: string,
    status: string,
    lastError?: string | null,
    tx?: TransactionClient
  ): Promise<BotInstance> {
    const client = this.getClient(tx);
    return client.botInstance.update({
      where: { id },
      data: {
        status,
        lastError: lastError !== undefined ? lastError : undefined,
        ...(status === "ERROR" && { errorCount: { increment: 1 } }),
      },
    });
  }

  async updateHealth(
    id: string,
    health: string,
    lastHealthCheckAt?: Date,
    tx?: TransactionClient
  ): Promise<BotInstance> {
    const client = this.getClient(tx);
    return client.botInstance.update({
      where: { id },
      data: {
        health,
        lastHealthCheckAt: lastHealthCheckAt ?? new Date(),
      },
    });
  }

  async incrementRestartCount(
    id: string,
    tx?: TransactionClient
  ): Promise<BotInstance> {
    const client = this.getClient(tx);
    return client.botInstance.update({
      where: { id },
      data: { restartCount: { increment: 1 } },
    });
  }

  async incrementErrorCount(
    id: string,
    tx?: TransactionClient
  ): Promise<BotInstance> {
    const client = this.getClient(tx);
    return client.botInstance.update({
      where: { id },
      data: { errorCount: { increment: 1 } },
    });
  }

  async groupByStatus(
    filters?: BotInstanceFilters,
    tx?: TransactionClient
  ): Promise<StatusGroupResult[]> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);

    const results = await client.botInstance.groupBy({
      by: ["status"],
      where,
      _count: { status: true },
    });

    return results.map((r) => ({
      status: r.status,
      _count: r._count.status,
    }));
  }

  async groupByHealth(
    filters?: BotInstanceFilters,
    tx?: TransactionClient
  ): Promise<HealthGroupResult[]> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);

    const results = await client.botInstance.groupBy({
      by: ["health"],
      where,
      _count: { health: true },
    });

    return results.map((r) => ({
      health: r.health,
      _count: r._count.health,
    }));
  }

  async getGatewayConnection(
    instanceId: string,
    tx?: TransactionClient
  ): Promise<GatewayConnection | null> {
    const client = this.getClient(tx);
    return client.gatewayConnection.findUnique({
      where: { instanceId },
    });
  }

  async upsertGatewayConnection(
    instanceId: string,
    data: GatewayConnectionUpsertData,
    tx?: TransactionClient
  ): Promise<GatewayConnection> {
    const client = this.getClient(tx);
    return client.gatewayConnection.upsert({
      where: { instanceId },
      create: {
        instanceId,
        host: data.host ?? "localhost",
        port: data.port ?? 18789,
        authMode: data.authMode ?? "token",
        authToken: data.authToken,
        status: data.status ?? "DISCONNECTED",
        lastHeartbeat: data.lastHeartbeat,
        configHash: data.configHash,
        latencyMs: data.latencyMs,
        protocolVersion: data.protocolVersion,
        clientMetadata: data.clientMetadata,
      },
      update: {
        host: data.host,
        port: data.port,
        authMode: data.authMode,
        authToken: data.authToken,
        status: data.status,
        lastHeartbeat: data.lastHeartbeat,
        configHash: data.configHash,
        latencyMs: data.latencyMs,
        protocolVersion: data.protocolVersion,
        clientMetadata: data.clientMetadata,
      },
    });
  }

  async findManyWithRelations(
    filters?: BotInstanceFilters,
    tx?: TransactionClient
  ): Promise<BotInstanceWithRelations[]> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);

    return client.botInstance.findMany({
      where,
      include: {
        fleet: {
          select: {
            id: true,
            name: true,
            environment: true,
          },
        },
        deploymentTarget: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        _count: {
          select: { connectorBindings: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOneWithRelations(
    id: string,
    tx?: TransactionClient
  ): Promise<BotInstanceWithRelations | null> {
    const client = this.getClient(tx);
    return client.botInstance.findUnique({
      where: { id },
      include: {
        fleet: true,
        gatewayConnection: true,
        deploymentTarget: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        connectorBindings: {
          include: {
            connector: {
              select: {
                id: true,
                name: true,
                type: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  async groupByFleet(
    filters?: BotInstanceFilters,
    tx?: TransactionClient
  ): Promise<Array<{ fleetId: string; _count: number }>> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);

    const results = await client.botInstance.groupBy({
      by: ["fleetId"],
      where,
      _count: { fleetId: true },
    });

    return results.map((r) => ({
      fleetId: r.fleetId,
      _count: r._count.fleetId,
    }));
  }

  async countGatewayConnections(
    statuses?: string[],
    tx?: TransactionClient
  ): Promise<number> {
    const client = this.getClient(tx);
    return client.gatewayConnection.count({
      where: statuses ? { status: { in: statuses } } : undefined,
    });
  }

  async deleteGatewayConnection(
    instanceId: string,
    tx?: TransactionClient
  ): Promise<void> {
    const client = this.getClient(tx);
    await client.gatewayConnection.deleteMany({ where: { instanceId } });
  }

  async deleteRelatedRecords(
    instanceId: string,
    tx?: TransactionClient
  ): Promise<void> {
    const client = this.getClient(tx);
    // Delete related records in order (foreign key dependencies)
    await client.gatewayConnection.deleteMany({ where: { instanceId } });
    await client.openClawProfile.deleteMany({ where: { instanceId } });
    await client.healthSnapshot.deleteMany({ where: { instanceId } });
  }
}
