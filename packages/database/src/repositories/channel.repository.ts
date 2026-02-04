import {
  PrismaClient,
  CommunicationChannel,
  BotChannelBinding,
  ChannelAuthSession,
  Prisma,
} from "@prisma/client";
import {
  IChannelRepository,
  CommunicationChannelFilters,
  CommunicationChannelWithRelations,
  BotChannelBindingFilters,
  BotChannelBindingWithRelations,
  ChannelAuthSessionFilters,
} from "../interfaces/channel.repository";
import {
  PaginationOptions,
  PaginatedResult,
  TransactionClient,
} from "../interfaces/base";

export class PrismaChannelRepository implements IChannelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: TransactionClient): TransactionClient | PrismaClient {
    return tx ?? this.prisma;
  }

  // ============================================
  // COMMUNICATION CHANNEL WHERE CLAUSES
  // ============================================

  private buildChannelWhereClause(
    filters?: CommunicationChannelFilters
  ): Prisma.CommunicationChannelWhereInput {
    if (!filters) return {};

    const where: Prisma.CommunicationChannelWhereInput = {};

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
      ];
    }

    return where;
  }

  private buildBindingWhereClause(
    filters?: BotChannelBindingFilters
  ): Prisma.BotChannelBindingWhereInput {
    if (!filters) return {};

    const where: Prisma.BotChannelBindingWhereInput = {};

    if (filters.botId) {
      where.botId = filters.botId;
    }

    if (filters.channelId) {
      where.channelId = filters.channelId;
    }

    if (filters.purpose) {
      where.purpose = filters.purpose;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.healthStatus) {
      where.healthStatus = Array.isArray(filters.healthStatus)
        ? { in: filters.healthStatus }
        : filters.healthStatus;
    }

    return where;
  }

  private buildAuthSessionWhereClause(
    filters?: ChannelAuthSessionFilters
  ): Prisma.ChannelAuthSessionWhereInput {
    if (!filters) return {};

    const where: Prisma.ChannelAuthSessionWhereInput = {};

    if (filters.instanceId) {
      where.instanceId = filters.instanceId;
    }

    if (filters.channelType) {
      where.channelType = Array.isArray(filters.channelType)
        ? { in: filters.channelType }
        : filters.channelType;
    }

    if (filters.state) {
      where.state = Array.isArray(filters.state)
        ? { in: filters.state }
        : filters.state;
    }

    return where;
  }

  // ============================================
  // COMMUNICATION CHANNEL METHODS
  // ============================================

  async findChannelById(
    id: string,
    tx?: TransactionClient
  ): Promise<CommunicationChannelWithRelations | null> {
    const client = this.getClient(tx);
    return client.communicationChannel.findUnique({
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

  async findManyChannels(
    filters?: CommunicationChannelFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<CommunicationChannel>> {
    const client = this.getClient(tx);
    const where = this.buildChannelWhereClause(filters);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      client.communicationChannel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      client.communicationChannel.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findChannelsByWorkspace(
    workspaceId: string,
    filters?: Omit<CommunicationChannelFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<CommunicationChannel[]> {
    const client = this.getClient(tx);
    const where = this.buildChannelWhereClause({ ...filters, workspaceId });

    return client.communicationChannel.findMany({
      where,
      orderBy: { name: "asc" },
    });
  }

  async createChannel(
    data: Prisma.CommunicationChannelCreateInput,
    tx?: TransactionClient
  ): Promise<CommunicationChannel> {
    const client = this.getClient(tx);
    return client.communicationChannel.create({ data });
  }

  async updateChannel(
    id: string,
    data: Prisma.CommunicationChannelUpdateInput,
    tx?: TransactionClient
  ): Promise<CommunicationChannel> {
    const client = this.getClient(tx);
    return client.communicationChannel.update({
      where: { id },
      data,
    });
  }

  async deleteChannel(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.communicationChannel.delete({ where: { id } });
  }

  async updateChannelStatus(
    id: string,
    status: string,
    statusMessage?: string | null,
    lastError?: string | null,
    tx?: TransactionClient
  ): Promise<CommunicationChannel> {
    const client = this.getClient(tx);
    return client.communicationChannel.update({
      where: { id },
      data: {
        status,
        statusMessage,
        lastError,
        lastTestedAt: new Date(),
        ...(lastError && { errorCount: { increment: 1 } }),
      },
    });
  }

  async recordMessageSent(
    id: string,
    tx?: TransactionClient
  ): Promise<CommunicationChannel> {
    const client = this.getClient(tx);
    return client.communicationChannel.update({
      where: { id },
      data: {
        messagesSent: { increment: 1 },
        lastMessageAt: new Date(),
        lastActivityAt: new Date(),
      },
    });
  }

  async recordMessageFailed(
    id: string,
    tx?: TransactionClient
  ): Promise<CommunicationChannel> {
    const client = this.getClient(tx);
    return client.communicationChannel.update({
      where: { id },
      data: {
        messagesFailed: { increment: 1 },
        lastActivityAt: new Date(),
      },
    });
  }

  // ============================================
  // BOT CHANNEL BINDING METHODS
  // ============================================

  async findBindingById(
    id: string,
    tx?: TransactionClient
  ): Promise<BotChannelBindingWithRelations | null> {
    const client = this.getClient(tx);
    return client.botChannelBinding.findUnique({
      where: { id },
      include: {
        channel: true,
        bot: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findBindingsByBot(
    botId: string,
    filters?: Omit<BotChannelBindingFilters, "botId">,
    tx?: TransactionClient
  ): Promise<BotChannelBindingWithRelations[]> {
    const client = this.getClient(tx);
    const where = this.buildBindingWhereClause({ ...filters, botId });

    return client.botChannelBinding.findMany({
      where,
      include: {
        channel: true,
        bot: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findBindingsByChannel(
    channelId: string,
    filters?: Omit<BotChannelBindingFilters, "channelId">,
    tx?: TransactionClient
  ): Promise<BotChannelBinding[]> {
    const client = this.getClient(tx);
    const where = this.buildBindingWhereClause({ ...filters, channelId });

    return client.botChannelBinding.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async createBinding(
    data: Prisma.BotChannelBindingCreateInput,
    tx?: TransactionClient
  ): Promise<BotChannelBinding> {
    const client = this.getClient(tx);
    return client.botChannelBinding.create({ data });
  }

  async updateBinding(
    id: string,
    data: Prisma.BotChannelBindingUpdateInput,
    tx?: TransactionClient
  ): Promise<BotChannelBinding> {
    const client = this.getClient(tx);
    return client.botChannelBinding.update({
      where: { id },
      data,
    });
  }

  async deleteBinding(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.botChannelBinding.delete({ where: { id } });
  }

  async updateBindingHealth(
    id: string,
    healthStatus: string,
    tx?: TransactionClient
  ): Promise<BotChannelBinding> {
    const client = this.getClient(tx);
    return client.botChannelBinding.update({
      where: { id },
      data: {
        healthStatus,
        lastHealthCheck: new Date(),
      },
    });
  }

  // ============================================
  // CHANNEL AUTH SESSION METHODS
  // ============================================

  async findAuthSessionById(
    id: string,
    tx?: TransactionClient
  ): Promise<ChannelAuthSession | null> {
    const client = this.getClient(tx);
    return client.channelAuthSession.findUnique({
      where: { id },
    });
  }

  async findAuthSessionsByInstance(
    instanceId: string,
    filters?: Omit<ChannelAuthSessionFilters, "instanceId">,
    tx?: TransactionClient
  ): Promise<ChannelAuthSession[]> {
    const client = this.getClient(tx);
    const where = this.buildAuthSessionWhereClause({ ...filters, instanceId });

    return client.channelAuthSession.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async findLatestAuthSession(
    instanceId: string,
    channelType: string,
    tx?: TransactionClient
  ): Promise<ChannelAuthSession | null> {
    const client = this.getClient(tx);
    return client.channelAuthSession.findFirst({
      where: { instanceId, channelType },
      orderBy: { createdAt: "desc" },
    });
  }

  async createAuthSession(
    data: Prisma.ChannelAuthSessionCreateInput,
    tx?: TransactionClient
  ): Promise<ChannelAuthSession> {
    const client = this.getClient(tx);
    return client.channelAuthSession.create({ data });
  }

  async updateAuthSession(
    id: string,
    data: Prisma.ChannelAuthSessionUpdateInput,
    tx?: TransactionClient
  ): Promise<ChannelAuthSession> {
    const client = this.getClient(tx);
    return client.channelAuthSession.update({
      where: { id },
      data,
    });
  }

  async deleteAuthSession(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.channelAuthSession.delete({ where: { id } });
  }

  async markAuthSessionPaired(
    id: string,
    tx?: TransactionClient
  ): Promise<ChannelAuthSession> {
    const client = this.getClient(tx);
    return client.channelAuthSession.update({
      where: { id },
      data: {
        state: "PAIRED",
        pairedAt: new Date(),
      },
    });
  }

  async markAuthSessionExpired(
    id: string,
    tx?: TransactionClient
  ): Promise<ChannelAuthSession> {
    const client = this.getClient(tx);
    return client.channelAuthSession.update({
      where: { id },
      data: {
        state: "EXPIRED",
      },
    });
  }

  async markAuthSessionError(
    id: string,
    error: string,
    tx?: TransactionClient
  ): Promise<ChannelAuthSession> {
    const client = this.getClient(tx);
    return client.channelAuthSession.update({
      where: { id },
      data: {
        state: "ERROR",
        lastError: error,
        attemptCount: { increment: 1 },
      },
    });
  }

  async upsertChannel(
    workspaceId: string,
    name: string,
    data: {
      type: string;
      config: string;
      status: string;
      createdBy?: string;
    },
    tx?: TransactionClient
  ): Promise<CommunicationChannel> {
    const client = this.getClient(tx);
    return client.communicationChannel.upsert({
      where: {
        workspaceId_name: {
          workspaceId,
          name,
        },
      },
      update: {
        type: data.type,
        config: data.config,
        status: data.status,
      },
      create: {
        workspaceId,
        name,
        type: data.type,
        config: data.config,
        status: data.status,
        createdBy: data.createdBy ?? "system",
      },
    });
  }

  async deleteChannelsByNamePrefix(
    workspaceId: string,
    namePrefix: string,
    tx?: TransactionClient
  ): Promise<number> {
    const client = this.getClient(tx);
    const result = await client.communicationChannel.deleteMany({
      where: {
        workspaceId,
        name: { startsWith: namePrefix },
      },
    });
    return result.count;
  }
}
