import {
  PrismaClient,
  SkillPack,
  BotInstanceSkillPack,
  Prisma,
} from "@prisma/client";
import {
  ISkillPackRepository,
  SkillPackFilters,
  SkillPackWithRelations,
  BotInstanceSkillPackWithRelations,
} from "../interfaces/skill-pack.repository";
import {
  PaginationOptions,
  PaginatedResult,
  TransactionClient,
} from "../interfaces/base";

export class PrismaSkillPackRepository implements ISkillPackRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: TransactionClient): TransactionClient | PrismaClient {
    return tx ?? this.prisma;
  }

  private buildSkillPackWhereClause(
    filters?: SkillPackFilters
  ): Prisma.SkillPackWhereInput {
    if (!filters) return {};

    const where: Prisma.SkillPackWhereInput = {};

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    }

    if (filters.isBuiltin !== undefined) {
      where.isBuiltin = filters.isBuiltin;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    return where;
  }

  // ============================================
  // SKILL PACK METHODS
  // ============================================

  async findSkillPackById(
    id: string,
    tx?: TransactionClient
  ): Promise<SkillPackWithRelations | null> {
    const client = this.getClient(tx);
    return client.skillPack.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            botInstances: true,
          },
        },
      },
    });
  }

  async findSkillPackByName(
    workspaceId: string,
    name: string,
    tx?: TransactionClient
  ): Promise<SkillPack | null> {
    const client = this.getClient(tx);
    return client.skillPack.findUnique({
      where: {
        workspaceId_name: {
          workspaceId,
          name,
        },
      },
    });
  }

  async findManySkillPacks(
    filters?: SkillPackFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<SkillPack>> {
    const client = this.getClient(tx);
    const where = this.buildSkillPackWhereClause(filters);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      client.skillPack.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      client.skillPack.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findSkillPacksByWorkspace(
    workspaceId: string,
    filters?: Omit<SkillPackFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<SkillPack[]> {
    const client = this.getClient(tx);
    const where = this.buildSkillPackWhereClause({ ...filters, workspaceId });

    return client.skillPack.findMany({
      where,
      orderBy: [{ isBuiltin: "desc" }, { name: "asc" }],
    });
  }

  async findBuiltinSkillPacks(tx?: TransactionClient): Promise<SkillPack[]> {
    const client = this.getClient(tx);
    return client.skillPack.findMany({
      where: { isBuiltin: true },
      orderBy: { name: "asc" },
    });
  }

  async countSkillPacks(
    filters?: SkillPackFilters,
    tx?: TransactionClient
  ): Promise<number> {
    const client = this.getClient(tx);
    const where = this.buildSkillPackWhereClause(filters);
    return client.skillPack.count({ where });
  }

  async createSkillPack(
    data: Prisma.SkillPackCreateInput,
    tx?: TransactionClient
  ): Promise<SkillPack> {
    const client = this.getClient(tx);
    return client.skillPack.create({ data });
  }

  async updateSkillPack(
    id: string,
    data: Prisma.SkillPackUpdateInput,
    tx?: TransactionClient
  ): Promise<SkillPack> {
    const client = this.getClient(tx);
    return client.skillPack.update({
      where: { id },
      data,
    });
  }

  async deleteSkillPack(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.skillPack.delete({ where: { id } });
  }

  async incrementVersion(id: string, tx?: TransactionClient): Promise<SkillPack> {
    const client = this.getClient(tx);
    return client.skillPack.update({
      where: { id },
      data: {
        version: { increment: 1 },
      },
    });
  }

  // ============================================
  // BOT INSTANCE SKILL PACK METHODS
  // ============================================

  async findAssociationById(
    id: string,
    tx?: TransactionClient
  ): Promise<BotInstanceSkillPackWithRelations | null> {
    const client = this.getClient(tx);
    return client.botInstanceSkillPack.findUnique({
      where: { id },
      include: {
        skillPack: true,
        botInstance: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findSkillPacksByBotInstance(
    botInstanceId: string,
    tx?: TransactionClient
  ): Promise<BotInstanceSkillPackWithRelations[]> {
    const client = this.getClient(tx);
    return client.botInstanceSkillPack.findMany({
      where: { botInstanceId },
      include: {
        skillPack: true,
        botInstance: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { attachedAt: "desc" },
    });
  }

  async findBotInstancesBySkillPack(
    skillPackId: string,
    tx?: TransactionClient
  ): Promise<BotInstanceSkillPack[]> {
    const client = this.getClient(tx);
    return client.botInstanceSkillPack.findMany({
      where: { skillPackId },
      orderBy: { attachedAt: "desc" },
    });
  }

  async attachSkillPack(
    botInstanceId: string,
    skillPackId: string,
    envOverrides?: string,
    tx?: TransactionClient
  ): Promise<BotInstanceSkillPack> {
    const client = this.getClient(tx);
    return client.botInstanceSkillPack.create({
      data: {
        botInstance: { connect: { id: botInstanceId } },
        skillPack: { connect: { id: skillPackId } },
        envOverrides: envOverrides ?? "{}",
      },
    });
  }

  async detachSkillPack(
    botInstanceId: string,
    skillPackId: string,
    tx?: TransactionClient
  ): Promise<void> {
    const client = this.getClient(tx);
    await client.botInstanceSkillPack.delete({
      where: {
        botInstanceId_skillPackId: {
          botInstanceId,
          skillPackId,
        },
      },
    });
  }

  async updateEnvOverrides(
    botInstanceId: string,
    skillPackId: string,
    envOverrides: string,
    tx?: TransactionClient
  ): Promise<BotInstanceSkillPack> {
    const client = this.getClient(tx);
    return client.botInstanceSkillPack.update({
      where: {
        botInstanceId_skillPackId: {
          botInstanceId,
          skillPackId,
        },
      },
      data: { envOverrides },
    });
  }

  async isAttached(
    botInstanceId: string,
    skillPackId: string,
    tx?: TransactionClient
  ): Promise<boolean> {
    const client = this.getClient(tx);
    const count = await client.botInstanceSkillPack.count({
      where: {
        botInstanceId,
        skillPackId,
      },
    });
    return count > 0;
  }
}
