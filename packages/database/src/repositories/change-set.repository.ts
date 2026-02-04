import { PrismaClient, ChangeSet, Prisma } from "@prisma/client";
import {
  IChangeSetRepository,
  ChangeSetFilters,
  ChangeSetWithRelations,
  ChangeSetStatusCount,
} from "../interfaces/change-set.repository";
import {
  PaginationOptions,
  PaginatedResult,
  TransactionClient,
} from "../interfaces/base";

export class PrismaChangeSetRepository implements IChangeSetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: TransactionClient): TransactionClient | PrismaClient {
    return tx ?? this.prisma;
  }

  private buildWhereClause(filters?: ChangeSetFilters): Prisma.ChangeSetWhereInput {
    if (!filters) return {};

    const where: Prisma.ChangeSetWhereInput = {};

    if (filters.botInstanceId) {
      where.botInstanceId = filters.botInstanceId;
    }

    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    if (filters.changeType) {
      where.changeType = Array.isArray(filters.changeType)
        ? { in: filters.changeType }
        : filters.changeType;
    }

    if (filters.createdBy) {
      where.createdBy = filters.createdBy;
    }

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) {
        where.createdAt.gte = filters.createdAfter;
      }
      if (filters.createdBefore) {
        where.createdAt.lte = filters.createdBefore;
      }
    }

    return where;
  }

  async findById(
    id: string,
    tx?: TransactionClient
  ): Promise<ChangeSetWithRelations | null> {
    const client = this.getClient(tx);
    return client.changeSet.findUnique({
      where: { id },
      include: {
        botInstance: {
          select: {
            id: true,
            name: true,
            fleetId: true,
          },
        },
        _count: {
          select: {
            auditEvents: true,
          },
        },
      },
    });
  }

  async findMany(
    filters?: ChangeSetFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<ChangeSet>> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      client.changeSet.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      client.changeSet.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByBotInstance(
    botInstanceId: string,
    filters?: Omit<ChangeSetFilters, "botInstanceId">,
    tx?: TransactionClient
  ): Promise<ChangeSet[]> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause({ ...filters, botInstanceId });

    return client.changeSet.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async count(filters?: ChangeSetFilters, tx?: TransactionClient): Promise<number> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);
    return client.changeSet.count({ where });
  }

  async create(
    data: Prisma.ChangeSetCreateInput,
    tx?: TransactionClient
  ): Promise<ChangeSet> {
    const client = this.getClient(tx);
    return client.changeSet.create({ data });
  }

  async update(
    id: string,
    data: Prisma.ChangeSetUpdateInput,
    tx?: TransactionClient
  ): Promise<ChangeSet> {
    const client = this.getClient(tx);
    return client.changeSet.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.changeSet.delete({ where: { id } });
  }

  async start(id: string, tx?: TransactionClient): Promise<ChangeSet> {
    const client = this.getClient(tx);
    return client.changeSet.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });
  }

  async complete(id: string, tx?: TransactionClient): Promise<ChangeSet> {
    const client = this.getClient(tx);
    return client.changeSet.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        canRollback: true,
      },
    });
  }

  async fail(id: string, tx?: TransactionClient): Promise<ChangeSet> {
    const client = this.getClient(tx);
    return client.changeSet.update({
      where: { id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
      },
    });
  }

  async rollback(
    id: string,
    rolledBackBy: string,
    tx?: TransactionClient
  ): Promise<ChangeSet> {
    const client = this.getClient(tx);
    return client.changeSet.update({
      where: { id },
      data: {
        status: "ROLLED_BACK",
        rolledBackAt: new Date(),
        rolledBackBy,
        canRollback: false,
      },
    });
  }

  async updateProgress(
    id: string,
    updatedInstances: number,
    failedInstances: number,
    tx?: TransactionClient
  ): Promise<ChangeSet> {
    const client = this.getClient(tx);
    return client.changeSet.update({
      where: { id },
      data: {
        updatedInstances,
        failedInstances,
      },
    });
  }

  async groupByStatus(
    filters?: ChangeSetFilters,
    tx?: TransactionClient
  ): Promise<ChangeSetStatusCount[]> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);

    const result = await client.changeSet.groupBy({
      by: ["status"],
      where,
      _count: true,
    });

    return result.map((item) => ({
      status: item.status,
      _count: item._count,
    }));
  }
}
