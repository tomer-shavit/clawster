import { PrismaClient, Fleet, Prisma } from "@prisma/client";
import type {
  IFleetRepository,
  FleetFilters,
  FleetWithInstanceCounts,
  FleetHealthSummary,
  FleetWithFullRelations,
} from "../interfaces/fleet.repository";
import type {
  PaginationOptions,
  PaginatedResult,
  TransactionClient,
} from "../interfaces/base";

type PrismaTransactionClient = TransactionClient | PrismaClient;

export class PrismaFleetRepository implements IFleetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: TransactionClient): PrismaTransactionClient {
    return tx ?? this.prisma;
  }

  private buildWhereClause(filters?: FleetFilters): Prisma.FleetWhereInput {
    if (!filters) return {};

    const where: Prisma.FleetWhereInput = {};

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    }

    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    if (filters.environment) {
      where.environment = filters.environment;
    }

    if (filters.name) {
      where.name = filters.name;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    return where;
  }

  async findById(
    id: string,
    tx?: TransactionClient
  ): Promise<FleetWithInstanceCounts | null> {
    const client = this.getClient(tx);
    return client.fleet.findUnique({
      where: { id },
      include: {
        _count: {
          select: { instances: true },
        },
      },
    });
  }

  async findMany(
    filters?: FleetFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<FleetWithInstanceCounts>> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      client.fleet.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { instances: true },
          },
        },
      }),
      client.fleet.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findFirst(
    filters: FleetFilters,
    tx?: TransactionClient
  ): Promise<Fleet | null> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);
    return client.fleet.findFirst({ where });
  }

  async create(
    data: Prisma.FleetCreateInput,
    tx?: TransactionClient
  ): Promise<Fleet> {
    const client = this.getClient(tx);
    return client.fleet.create({ data });
  }

  async update(
    id: string,
    data: Prisma.FleetUpdateInput,
    tx?: TransactionClient
  ): Promise<Fleet> {
    const client = this.getClient(tx);
    return client.fleet.update({
      where: { id },
      data,
    });
  }

  async delete(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.fleet.delete({ where: { id } });
  }

  async count(filters?: FleetFilters, tx?: TransactionClient): Promise<number> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);
    return client.fleet.count({ where });
  }

  async getHealthSummary(
    fleetId: string,
    tx?: TransactionClient
  ): Promise<FleetHealthSummary | null> {
    const client = this.getClient(tx);

    // First check if fleet exists
    const fleet = await client.fleet.findUnique({
      where: { id: fleetId },
      select: { id: true, name: true },
    });

    if (!fleet) {
      return null;
    }

    // Get all instances for this fleet
    const instances = await client.botInstance.findMany({
      where: { fleetId },
      select: { health: true, status: true },
    });

    const totalInstances = instances.length;

    // Aggregate health counts
    const healthyCounts = {
      healthy: 0,
      unhealthy: 0,
      degraded: 0,
      unknown: 0,
    };

    // Aggregate status counts
    const statusCounts = {
      running: 0,
      stopped: 0,
      error: 0,
      creating: 0,
      pending: 0,
      other: 0,
    };

    for (const instance of instances) {
      // Health counts
      const health = instance.health.toLowerCase();
      if (health === "healthy") {
        healthyCounts.healthy++;
      } else if (health === "unhealthy") {
        healthyCounts.unhealthy++;
      } else if (health === "degraded") {
        healthyCounts.degraded++;
      } else {
        healthyCounts.unknown++;
      }

      // Status counts
      const status = instance.status.toLowerCase();
      if (status === "running") {
        statusCounts.running++;
      } else if (status === "stopped" || status === "paused") {
        statusCounts.stopped++;
      } else if (status === "error") {
        statusCounts.error++;
      } else if (status === "creating") {
        statusCounts.creating++;
      } else if (status === "pending" || status === "reconciling") {
        statusCounts.pending++;
      } else {
        statusCounts.other++;
      }
    }

    return {
      fleetId: fleet.id,
      fleetName: fleet.name,
      totalInstances,
      healthyCounts,
      statusCounts,
    };
  }

  async findByIdWithInstances(
    id: string,
    tx?: TransactionClient
  ): Promise<FleetWithFullRelations | null> {
    const client = this.getClient(tx);
    return client.fleet.findUnique({
      where: { id },
      include: {
        instances: {
          select: {
            id: true,
            name: true,
            status: true,
            health: true,
            deploymentType: true,
            gatewayPort: true,
            runningSince: true,
            lastHealthCheckAt: true,
            createdAt: true,
            gatewayConnection: {
              select: {
                host: true,
                port: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        profiles: true,
      },
    }) as Promise<FleetWithFullRelations | null>;
  }

  async findManyWithInstances(
    filters?: FleetFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<FleetWithInstanceCounts[]> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    return client.fleet.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        instances: {
          select: { id: true, status: true, deploymentType: true },
        },
        _count: {
          select: { instances: true },
        },
      },
    });
  }
}
