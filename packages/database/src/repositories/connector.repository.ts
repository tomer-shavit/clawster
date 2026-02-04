import {
  PrismaClient,
  IntegrationConnector,
  BotConnectorBinding,
  Prisma,
} from "@prisma/client";
import {
  IConnectorRepository,
  IntegrationConnectorFilters,
  IntegrationConnectorWithRelations,
  BotConnectorBindingFilters,
  BotConnectorBindingWithRelations,
} from "../interfaces/connector.repository";
import {
  PaginationOptions,
  PaginatedResult,
  TransactionClient,
} from "../interfaces/base";

export class PrismaConnectorRepository implements IConnectorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: TransactionClient): TransactionClient | PrismaClient {
    return tx ?? this.prisma;
  }

  // ============================================
  // WHERE CLAUSE BUILDERS
  // ============================================

  private buildConnectorWhereClause(
    filters?: IntegrationConnectorFilters
  ): Prisma.IntegrationConnectorWhereInput {
    if (!filters) return {};

    const where: Prisma.IntegrationConnectorWhereInput = {};

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    }

    if (filters.type) {
      where.type = Array.isArray(filters.type)
        ? { in: filters.type }
        : filters.type;
    }

    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    if (filters.isShared !== undefined) {
      where.isShared = filters.isShared;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    return where;
  }

  private buildBindingWhereClause(
    filters?: BotConnectorBindingFilters
  ): Prisma.BotConnectorBindingWhereInput {
    if (!filters) return {};

    const where: Prisma.BotConnectorBindingWhereInput = {};

    if (filters.botInstanceId) {
      where.botInstanceId = filters.botInstanceId;
    }

    if (filters.connectorId) {
      where.connectorId = filters.connectorId;
    }

    if (filters.purpose) {
      where.purpose = filters.purpose;
    }

    if (filters.healthStatus) {
      where.healthStatus = Array.isArray(filters.healthStatus)
        ? { in: filters.healthStatus }
        : filters.healthStatus;
    }

    return where;
  }

  // ============================================
  // INTEGRATION CONNECTOR METHODS
  // ============================================

  async findConnectorById(
    id: string,
    tx?: TransactionClient
  ): Promise<IntegrationConnectorWithRelations | null> {
    const client = this.getClient(tx);
    return client.integrationConnector.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            botBindings: true,
          },
        },
      },
    });
  }

  async findManyConnectors(
    filters?: IntegrationConnectorFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<IntegrationConnector>> {
    const client = this.getClient(tx);
    const where = this.buildConnectorWhereClause(filters);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      client.integrationConnector.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      client.integrationConnector.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findConnectorsByWorkspace(
    workspaceId: string,
    filters?: Omit<IntegrationConnectorFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<IntegrationConnector[]> {
    const client = this.getClient(tx);
    const where = this.buildConnectorWhereClause({ ...filters, workspaceId });

    return client.integrationConnector.findMany({
      where,
      orderBy: { name: "asc" },
    });
  }

  async countConnectors(
    filters?: IntegrationConnectorFilters,
    tx?: TransactionClient
  ): Promise<number> {
    const client = this.getClient(tx);
    const where = this.buildConnectorWhereClause(filters);
    return client.integrationConnector.count({ where });
  }

  async createConnector(
    data: Prisma.IntegrationConnectorCreateInput,
    tx?: TransactionClient
  ): Promise<IntegrationConnector> {
    const client = this.getClient(tx);
    return client.integrationConnector.create({ data });
  }

  async updateConnector(
    id: string,
    data: Prisma.IntegrationConnectorUpdateInput,
    tx?: TransactionClient
  ): Promise<IntegrationConnector> {
    const client = this.getClient(tx);
    return client.integrationConnector.update({
      where: { id },
      data,
    });
  }

  async deleteConnector(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.integrationConnector.delete({ where: { id } });
  }

  async updateConnectorStatus(
    id: string,
    status: string,
    statusMessage?: string | null,
    lastError?: string | null,
    tx?: TransactionClient
  ): Promise<IntegrationConnector> {
    const client = this.getClient(tx);
    return client.integrationConnector.update({
      where: { id },
      data: {
        status,
        statusMessage,
        lastError,
      },
    });
  }

  async recordTestResult(
    id: string,
    success: boolean,
    message?: string,
    tx?: TransactionClient
  ): Promise<IntegrationConnector> {
    const client = this.getClient(tx);
    return client.integrationConnector.update({
      where: { id },
      data: {
        status: success ? "ACTIVE" : "ERROR",
        lastTestedAt: new Date(),
        lastTestResult: message ?? (success ? "Success" : "Failed"),
        lastError: success ? null : message,
      },
    });
  }

  async incrementUsageCount(
    id: string,
    tx?: TransactionClient
  ): Promise<IntegrationConnector> {
    const client = this.getClient(tx);
    return client.integrationConnector.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  // ============================================
  // BOT CONNECTOR BINDING METHODS
  // ============================================

  async findBindingById(
    id: string,
    tx?: TransactionClient
  ): Promise<BotConnectorBindingWithRelations | null> {
    const client = this.getClient(tx);
    return client.botConnectorBinding.findUnique({
      where: { id },
      include: {
        connector: true,
        botInstance: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findBindingsByBotInstance(
    botInstanceId: string,
    filters?: Omit<BotConnectorBindingFilters, "botInstanceId">,
    tx?: TransactionClient
  ): Promise<BotConnectorBindingWithRelations[]> {
    const client = this.getClient(tx);
    const where = this.buildBindingWhereClause({ ...filters, botInstanceId });

    return client.botConnectorBinding.findMany({
      where,
      include: {
        connector: true,
        botInstance: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findBindingsByConnector(
    connectorId: string,
    filters?: Omit<BotConnectorBindingFilters, "connectorId">,
    tx?: TransactionClient
  ): Promise<BotConnectorBinding[]> {
    const client = this.getClient(tx);
    const where = this.buildBindingWhereClause({ ...filters, connectorId });

    return client.botConnectorBinding.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async createBinding(
    data: Prisma.BotConnectorBindingCreateInput,
    tx?: TransactionClient
  ): Promise<BotConnectorBinding> {
    const client = this.getClient(tx);
    return client.botConnectorBinding.create({ data });
  }

  async updateBinding(
    id: string,
    data: Prisma.BotConnectorBindingUpdateInput,
    tx?: TransactionClient
  ): Promise<BotConnectorBinding> {
    const client = this.getClient(tx);
    return client.botConnectorBinding.update({
      where: { id },
      data,
    });
  }

  async deleteBinding(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.botConnectorBinding.delete({ where: { id } });
  }

  async updateBindingHealth(
    id: string,
    healthStatus: string,
    tx?: TransactionClient
  ): Promise<BotConnectorBinding> {
    const client = this.getClient(tx);
    return client.botConnectorBinding.update({
      where: { id },
      data: {
        healthStatus,
        lastHealthCheck: new Date(),
      },
    });
  }
}
