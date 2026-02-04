import { PrismaClient, HealthAlert, Prisma } from "@prisma/client";
import type {
  IAlertRepository,
  AlertFilters,
  AlertSummary,
  AlertUpsertData,
} from "../interfaces/alert.repository";
import type {
  PaginationOptions,
  PaginatedResult,
  TransactionClient,
} from "../interfaces/base";

export class PrismaAlertRepository implements IAlertRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: TransactionClient): PrismaClient | TransactionClient {
    return tx ?? this.prisma;
  }

  private buildWhereClause(filters?: AlertFilters): Prisma.HealthAlertWhereInput {
    if (!filters) return {};

    const where: Prisma.HealthAlertWhereInput = {};

    if (filters.instanceId) {
      where.instanceId = filters.instanceId;
    }

    if (filters.fleetId) {
      where.fleetId = filters.fleetId;
    }

    if (filters.workspaceId) {
      where.instance = { workspaceId: filters.workspaceId };
    }

    if (filters.rule) {
      where.rule = Array.isArray(filters.rule)
        ? { in: filters.rule }
        : filters.rule;
    }

    if (filters.severity) {
      where.severity = Array.isArray(filters.severity)
        ? { in: filters.severity }
        : filters.severity;
    }

    if (filters.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
    }

    if (filters.fromDate || filters.toDate) {
      where.firstTriggeredAt = {};
      if (filters.fromDate) {
        where.firstTriggeredAt.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.firstTriggeredAt.lte = filters.toDate;
      }
    }

    return where;
  }

  async findById(
    id: string,
    tx?: TransactionClient
  ): Promise<HealthAlert | null> {
    const client = this.getClient(tx);
    return client.healthAlert.findUnique({
      where: { id },
      include: {
        instance: { select: { id: true, name: true, fleetId: true, health: true, status: true } },
        fleet: { select: { id: true, name: true } },
      },
    });
  }

  async findMany(
    filters?: AlertFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<HealthAlert>> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      client.healthAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastTriggeredAt: "desc" },
        include: {
          instance: { select: { id: true, name: true, fleetId: true } },
          fleet: { select: { id: true, name: true } },
        },
      }),
      client.healthAlert.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async upsertByKey(
    data: AlertUpsertData,
    tx?: TransactionClient
  ): Promise<HealthAlert> {
    const client = this.getClient(tx);

    // Find existing active alert with the same rule and instanceId
    const existing = await client.healthAlert.findFirst({
      where: {
        rule: data.rule,
        instanceId: data.instanceId ?? null,
        status: { not: "RESOLVED" },
      },
    });

    if (existing) {
      // Update the existing alert
      return client.healthAlert.update({
        where: { id: existing.id },
        data: {
          severity: data.severity,
          title: data.title,
          message: data.message,
          detail: data.detail,
          remediationAction: data.remediationAction,
          remediationNote: data.remediationNote,
          lastTriggeredAt: new Date(),
          consecutiveHits: { increment: 1 },
          // Re-activate if it was acknowledged or suppressed
          status: "ACTIVE",
          acknowledgedAt: null,
          acknowledgedBy: null,
        },
      });
    }

    // Create a new alert
    return client.healthAlert.create({
      data: {
        rule: data.rule,
        instanceId: data.instanceId,
        fleetId: data.fleetId,
        severity: data.severity,
        status: "ACTIVE",
        title: data.title,
        message: data.message,
        detail: data.detail,
        remediationAction: data.remediationAction,
        remediationNote: data.remediationNote,
        firstTriggeredAt: new Date(),
        lastTriggeredAt: new Date(),
        consecutiveHits: 1,
      },
    });
  }

  async acknowledge(
    id: string,
    acknowledgedBy: string,
    tx?: TransactionClient
  ): Promise<HealthAlert> {
    const client = this.getClient(tx);
    return client.healthAlert.update({
      where: { id },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
        acknowledgedBy,
      },
    });
  }

  async resolve(id: string, tx?: TransactionClient): Promise<HealthAlert> {
    const client = this.getClient(tx);
    return client.healthAlert.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });
  }

  async suppress(id: string, tx?: TransactionClient): Promise<HealthAlert> {
    const client = this.getClient(tx);
    return client.healthAlert.update({
      where: { id },
      data: {
        status: "SUPPRESSED",
      },
    });
  }

  async resolveByKey(
    rule: string,
    instanceId: string,
    tx?: TransactionClient
  ): Promise<HealthAlert | null> {
    const client = this.getClient(tx);

    const existing = await client.healthAlert.findFirst({
      where: {
        rule,
        instanceId,
        status: { in: ["ACTIVE", "ACKNOWLEDGED"] },
      },
    });

    if (!existing) {
      return null;
    }

    return client.healthAlert.update({
      where: { id: existing.id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });
  }

  async bulkAcknowledge(
    ids: string[],
    acknowledgedBy: string,
    tx?: TransactionClient
  ): Promise<number> {
    const client = this.getClient(tx);
    const result = await client.healthAlert.updateMany({
      where: {
        id: { in: ids },
        status: "ACTIVE",
      },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
        acknowledgedBy,
      },
    });
    return result.count;
  }

  async bulkResolve(ids: string[], tx?: TransactionClient): Promise<number> {
    const client = this.getClient(tx);
    const result = await client.healthAlert.updateMany({
      where: {
        id: { in: ids },
        status: { in: ["ACTIVE", "ACKNOWLEDGED"] },
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });
    return result.count;
  }

  async getSummary(
    filters?: AlertFilters,
    tx?: TransactionClient
  ): Promise<AlertSummary> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);

    const [bySeverityRaw, byStatusRaw, total] = await Promise.all([
      client.healthAlert.groupBy({
        by: ["severity"],
        where: { ...where, status: { not: "RESOLVED" } },
        _count: { id: true },
      }),
      client.healthAlert.groupBy({
        by: ["status"],
        where,
        _count: { id: true },
      }),
      client.healthAlert.count({
        where: { ...where, status: { not: "RESOLVED" } },
      }),
    ]);

    // Initialize with defaults
    const byStatus = {
      active: 0,
      acknowledged: 0,
      resolved: 0,
      suppressed: 0,
    };

    const bySeverity = {
      critical: 0,
      error: 0,
      warning: 0,
      info: 0,
    };

    // Map raw results to our structure
    for (const row of byStatusRaw) {
      const status = row.status.toLowerCase() as keyof typeof byStatus;
      if (status in byStatus) {
        byStatus[status] = row._count.id;
      }
    }

    for (const row of bySeverityRaw) {
      const severity = row.severity.toLowerCase() as keyof typeof bySeverity;
      if (severity in bySeverity) {
        bySeverity[severity] = row._count.id;
      }
    }

    return { total, byStatus, bySeverity };
  }

  async getActiveCount(
    filters?: AlertFilters,
    tx?: TransactionClient
  ): Promise<number> {
    const client = this.getClient(tx);
    const where = this.buildWhereClause(filters);
    return client.healthAlert.count({
      where: { ...where, status: "ACTIVE" },
    });
  }
}
