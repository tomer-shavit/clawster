import { PrismaClient, SloDefinition, Prisma } from "@prisma/client";
import type {
  ISloRepository,
  SloFilters,
  SloWithRelations,
  SloBreachSummary,
  SloMetricGroupResult,
} from "../interfaces/slo.repository";
import {
  PaginationOptions,
  PaginatedResult,
  TransactionClient,
} from "../interfaces/base";

export class PrismaSloRepository implements ISloRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: TransactionClient): TransactionClient | PrismaClient {
    return tx ?? this.prisma;
  }

  private buildWhereClause(filters?: SloFilters): Prisma.SloDefinitionWhereInput {
    if (!filters) return {};

    const where: Prisma.SloDefinitionWhereInput = {};

    if (filters.instanceId) {
      where.instanceId = filters.instanceId;
    }

    if (filters.metric) {
      where.metric = Array.isArray(filters.metric)
        ? { in: filters.metric }
        : filters.metric;
    }

    if (filters.isBreached !== undefined) {
      where.isBreached = filters.isBreached;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return where;
  }

  async findById(
    id: string,
    tx?: TransactionClient
  ): Promise<SloWithRelations | null> {
    const client = this.getClient(tx);
    return client.sloDefinition.findUnique({
      where: { id },
      include: {
        instance: {
          select: {
            id: true,
            name: true,
            fleetId: true,
          },
        },
      },
    });
  }

  async findMany(
    filters?: SloFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<SloDefinition>> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      client.sloDefinition.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      client.sloDefinition.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByInstance(
    instanceId: string,
    filters?: Omit<SloFilters, "instanceId">,
    tx?: TransactionClient
  ): Promise<SloDefinition[]> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause({ ...filters, instanceId });

    return client.sloDefinition.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async findManyWithRelations(
    filters?: SloFilters,
    tx?: TransactionClient
  ): Promise<SloWithRelations[]> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);

    return client.sloDefinition.findMany({
      where,
      include: {
        instance: {
          select: {
            id: true,
            name: true,
            fleetId: true,
            status: true,
            health: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findByInstanceWithRelations(
    instanceId: string,
    filters?: Omit<SloFilters, "instanceId">,
    tx?: TransactionClient
  ): Promise<SloWithRelations[]> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause({ ...filters, instanceId });

    return client.sloDefinition.findMany({
      where,
      include: {
        instance: {
          select: {
            id: true,
            name: true,
            fleetId: true,
            status: true,
            health: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findBreached(tx?: TransactionClient): Promise<SloDefinition[]> {
    const client = this.getClient(tx);
    return client.sloDefinition.findMany({
      where: {
        isBreached: true,
        isActive: true,
      },
      orderBy: { breachedAt: "desc" },
    });
  }

  async count(filters?: SloFilters, tx?: TransactionClient): Promise<number> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);
    return client.sloDefinition.count({ where });
  }

  async create(
    data: Prisma.SloDefinitionCreateInput,
    tx?: TransactionClient
  ): Promise<SloDefinition> {
    const client = this.getClient(tx);
    return client.sloDefinition.create({ data });
  }

  async update(
    id: string,
    data: Prisma.SloDefinitionUpdateInput,
    tx?: TransactionClient
  ): Promise<SloDefinition> {
    const client = this.getClient(tx);
    return client.sloDefinition.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.sloDefinition.delete({ where: { id } });
  }

  async updateEvaluation(
    id: string,
    currentValue: number,
    isBreached: boolean,
    tx?: TransactionClient
  ): Promise<SloDefinition> {
    const client = this.getClient(tx);
    const updateData: Prisma.SloDefinitionUpdateInput = {
      currentValue,
      isBreached,
      lastEvaluatedAt: new Date(),
    };

    if (isBreached) {
      // Get current state to check if this is a new breach
      const current = await client.sloDefinition.findUnique({ where: { id } });
      if (current && !current.isBreached) {
        updateData.breachedAt = new Date();
        updateData.breachCount = { increment: 1 };
      }
    }

    return client.sloDefinition.update({
      where: { id },
      data: updateData,
    });
  }

  async markBreached(id: string, tx?: TransactionClient): Promise<SloDefinition> {
    const client = this.getClient(tx);
    return client.sloDefinition.update({
      where: { id },
      data: {
        isBreached: true,
        breachedAt: new Date(),
        breachCount: { increment: 1 },
      },
    });
  }

  async clearBreach(id: string, tx?: TransactionClient): Promise<SloDefinition> {
    const client = this.getClient(tx);
    return client.sloDefinition.update({
      where: { id },
      data: {
        isBreached: false,
      },
    });
  }

  async getBreachSummary(
    instanceId: string,
    tx?: TransactionClient
  ): Promise<SloBreachSummary> {
    const client = this.getClient(tx);

    const [totalSlos, breachedSlos] = await Promise.all([
      client.sloDefinition.count({
        where: { instanceId, isActive: true },
      }),
      client.sloDefinition.count({
        where: { instanceId, isActive: true, isBreached: true },
      }),
    ]);

    return {
      totalSlos,
      breachedSlos,
      breachRate: totalSlos > 0 ? (breachedSlos / totalSlos) * 100 : 0,
    };
  }

  async groupByMetric(
    filters?: SloFilters,
    tx?: TransactionClient
  ): Promise<SloMetricGroupResult[]> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);

    const [allByMetric, breachedByMetric] = await Promise.all([
      client.sloDefinition.groupBy({
        by: ["metric"],
        where,
        _count: true,
      }),
      client.sloDefinition.groupBy({
        by: ["metric"],
        where: { ...where, isBreached: true },
        _count: true,
      }),
    ]);

    const breachedMap = new Map(
      breachedByMetric.map((item) => [item.metric, item._count])
    );

    return allByMetric.map((item) => ({
      metric: item.metric,
      _count: item._count,
      breachedCount: breachedMap.get(item.metric) ?? 0,
    }));
  }
}
