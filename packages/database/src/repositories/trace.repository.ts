import { PrismaClient, Trace, Prisma } from "@prisma/client";
import type {
  ITraceRepository,
  TraceFilters,
  TraceWithChildren,
  TraceTree,
  TraceStats,
  TraceStatsByType,
  TraceStatsByInstance,
  CreateTraceInput,
  UpdateTraceInput,
} from "../interfaces/trace.repository";
import type {
  PaginationOptions,
  PaginatedResult,
  TransactionClient,
} from "../interfaces/base";

export class PrismaTraceRepository implements ITraceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: TransactionClient): PrismaClient | TransactionClient {
    return tx ?? this.prisma;
  }

  private buildWhereClause(filters?: TraceFilters): Prisma.TraceWhereInput {
    if (!filters) return {};

    const where: Prisma.TraceWhereInput = {};

    if (filters.instanceId) {
      where.botInstanceId = filters.instanceId;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.parentTraceId !== undefined) {
      where.parentTraceId = filters.parentTraceId;
    }

    if (filters.startedAfter || filters.startedBefore) {
      where.startedAt = {};
      if (filters.startedAfter) {
        where.startedAt.gte = filters.startedAfter;
      }
      if (filters.startedBefore) {
        where.startedAt.lte = filters.startedBefore;
      }
    }

    if (filters.minDurationMs !== undefined || filters.maxDurationMs !== undefined) {
      where.durationMs = {};
      if (filters.minDurationMs !== undefined) {
        where.durationMs.gte = filters.minDurationMs;
      }
      if (filters.maxDurationMs !== undefined) {
        where.durationMs.lte = filters.maxDurationMs;
      }
    }

    return where;
  }

  async findById(id: string): Promise<Trace | null> {
    return this.prisma.trace.findUnique({
      where: { id },
      include: {
        botInstance: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findByTraceId(traceId: string): Promise<Trace | null> {
    return this.prisma.trace.findUnique({
      where: { traceId },
      include: {
        botInstance: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findMany(
    filters?: TraceFilters,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Trace>> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 100;
    const skip = (page - 1) * limit;
    const where = this.buildWhereClause(filters);

    const [data, total] = await Promise.all([
      this.prisma.trace.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: "desc" },
      }),
      this.prisma.trace.count({ where }),
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
    filters?: Omit<TraceFilters, "instanceId">,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Trace>> {
    return this.findMany({ ...filters, instanceId }, options);
  }

  async create(data: CreateTraceInput, tx?: TransactionClient): Promise<Trace> {
    const client = this.getClient(tx);
    return client.trace.create({
      data: {
        botInstanceId: data.botInstanceId,
        traceId: data.traceId,
        parentTraceId: data.parentTraceId,
        name: data.name,
        type: data.type,
        status: data.status ?? "PENDING",
        startedAt: data.startedAt ?? new Date(),
        endedAt: data.endedAt,
        durationMs: data.durationMs,
        input: data.input ? JSON.stringify(data.input) : undefined,
        output: data.output ? JSON.stringify(data.output) : undefined,
        error: data.error ? JSON.stringify(data.error) : undefined,
        metadata: JSON.stringify(data.metadata ?? {}),
        tags: JSON.stringify(data.tags ?? {}),
      },
    });
  }

  async update(
    id: string,
    data: UpdateTraceInput,
    tx?: TransactionClient
  ): Promise<Trace> {
    const client = this.getClient(tx);
    return client.trace.update({
      where: { id },
      data: {
        status: data.status,
        endedAt: data.endedAt,
        durationMs: data.durationMs,
        output: data.output,
        error: data.error,
        metadata: data.metadata,
        tags: data.tags,
      },
    });
  }

  async complete(
    id: string,
    status: "SUCCESS" | "ERROR",
    output?: string,
    error?: string,
    tx?: TransactionClient
  ): Promise<Trace> {
    const client = this.getClient(tx);
    const trace = await client.trace.findUnique({ where: { id } });

    if (!trace) {
      throw new Error(`Trace ${id} not found`);
    }

    const endedAt = new Date();
    const durationMs = endedAt.getTime() - trace.startedAt.getTime();

    return client.trace.update({
      where: { id },
      data: {
        status,
        endedAt,
        durationMs,
        output,
        error,
      },
    });
  }

  async delete(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.trace.delete({ where: { id } });
  }

  async deleteOlderThan(date: Date, tx?: TransactionClient): Promise<number> {
    const client = this.getClient(tx);
    const result = await client.trace.deleteMany({
      where: { startedAt: { lt: date } },
    });
    return result.count;
  }

  async findChildren(parentTraceId: string): Promise<Trace[]> {
    return this.prisma.trace.findMany({
      where: { parentTraceId },
      orderBy: { startedAt: "asc" },
    });
  }

  async findTree(rootTraceId: string, maxDepth = 10): Promise<TraceTree | null> {
    const root = await this.findByTraceId(rootTraceId);
    if (!root) {
      return null;
    }

    let totalNodes = 1;
    let currentMaxDepth = 0;

    // Recursively build the tree
    const buildTreeNode = async (
      trace: Trace,
      depth: number
    ): Promise<TraceWithChildren> => {
      if (depth > currentMaxDepth) {
        currentMaxDepth = depth;
      }

      if (depth >= maxDepth) {
        return { ...trace, children: [] };
      }

      const children = await this.findChildren(trace.traceId);
      totalNodes += children.length;

      const childrenWithSubtrees = await Promise.all(
        children.map((child) => buildTreeNode(child, depth + 1))
      );

      return {
        ...trace,
        children: childrenWithSubtrees,
      };
    };

    const rootWithChildren = await buildTreeNode(root, 0);

    return {
      root: rootWithChildren,
      totalNodes,
      maxDepth: currentMaxDepth,
    };
  }

  async findRootTraces(
    filters?: Omit<TraceFilters, "parentTraceId">,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Trace>> {
    return this.findMany({ ...filters, parentTraceId: null }, options);
  }

  async getStats(
    instanceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TraceStats> {
    const where: Prisma.TraceWhereInput = {
      botInstanceId: instanceId,
    };

    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = startDate;
      if (endDate) where.startedAt.lte = endDate;
    }

    const traces = await this.prisma.trace.findMany({
      where,
      select: { status: true, durationMs: true },
    });

    const totalTraces = traces.length;
    let successCount = 0;
    let errorCount = 0;
    let pendingCount = 0;
    const durations: number[] = [];

    for (const trace of traces) {
      if (trace.status === "SUCCESS") {
        successCount++;
      } else if (trace.status === "ERROR") {
        errorCount++;
      } else {
        pendingCount++;
      }

      if (trace.durationMs !== null) {
        durations.push(trace.durationMs);
      }
    }

    // Sort durations for percentile calculations
    durations.sort((a, b) => a - b);

    return {
      totalTraces,
      successCount,
      errorCount,
      pendingCount,
      avgDurationMs: durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null,
      minDurationMs: durations.length > 0 ? durations[0] : null,
      maxDurationMs: durations.length > 0 ? durations[durations.length - 1] : null,
      p50DurationMs: this.percentile(durations, 50),
      p95DurationMs: this.percentile(durations, 95),
      p99DurationMs: this.percentile(durations, 99),
    };
  }

  async getStatsByType(
    instanceId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TraceStatsByType[]> {
    const where: Prisma.TraceWhereInput = {
      botInstanceId: instanceId,
    };

    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = startDate;
      if (endDate) where.startedAt.lte = endDate;
    }

    const traces = await this.prisma.trace.findMany({
      where,
      select: { type: true, status: true, durationMs: true },
    });

    // Group traces by type
    const byType = new Map<string, { status: string; durationMs: number | null }[]>();
    for (const trace of traces) {
      const existing = byType.get(trace.type) ?? [];
      existing.push({ status: trace.status, durationMs: trace.durationMs });
      byType.set(trace.type, existing);
    }

    const results: TraceStatsByType[] = [];
    for (const [type, typeTraces] of byType) {
      const durations = typeTraces
        .filter((t) => t.durationMs !== null)
        .map((t) => t.durationMs as number)
        .sort((a, b) => a - b);

      results.push({
        type,
        totalTraces: typeTraces.length,
        successCount: typeTraces.filter((t) => t.status === "SUCCESS").length,
        errorCount: typeTraces.filter((t) => t.status === "ERROR").length,
        pendingCount: typeTraces.filter((t) => t.status === "PENDING").length,
        avgDurationMs: durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null,
        minDurationMs: durations.length > 0 ? durations[0] : null,
        maxDurationMs: durations.length > 0 ? durations[durations.length - 1] : null,
        p50DurationMs: this.percentile(durations, 50),
        p95DurationMs: this.percentile(durations, 95),
        p99DurationMs: this.percentile(durations, 99),
      });
    }

    return results;
  }

  async getStatsByInstance(
    workspaceId: string,
    fleetId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TraceStatsByInstance[]> {
    const where: Prisma.TraceWhereInput = {
      botInstance: {
        workspaceId,
        ...(fleetId && { fleetId }),
      },
    };

    if (startDate || endDate) {
      where.startedAt = {};
      if (startDate) where.startedAt.gte = startDate;
      if (endDate) where.startedAt.lte = endDate;
    }

    const traces = await this.prisma.trace.findMany({
      where,
      select: {
        botInstanceId: true,
        status: true,
        durationMs: true,
        botInstance: { select: { name: true } },
      },
    });

    // Group traces by instance
    const byInstance = new Map<
      string,
      { status: string; durationMs: number | null; instanceName?: string }[]
    >();

    for (const trace of traces) {
      const existing = byInstance.get(trace.botInstanceId) ?? [];
      existing.push({
        status: trace.status,
        durationMs: trace.durationMs,
        instanceName: trace.botInstance?.name,
      });
      byInstance.set(trace.botInstanceId, existing);
    }

    const results: TraceStatsByInstance[] = [];
    for (const [instanceId, instanceTraces] of byInstance) {
      const durations = instanceTraces
        .filter((t) => t.durationMs !== null)
        .map((t) => t.durationMs as number)
        .sort((a, b) => a - b);

      results.push({
        instanceId,
        instanceName: instanceTraces[0]?.instanceName,
        totalTraces: instanceTraces.length,
        successCount: instanceTraces.filter((t) => t.status === "SUCCESS").length,
        errorCount: instanceTraces.filter((t) => t.status === "ERROR").length,
        pendingCount: instanceTraces.filter((t) => t.status === "PENDING").length,
        avgDurationMs: durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null,
        minDurationMs: durations.length > 0 ? durations[0] : null,
        maxDurationMs: durations.length > 0 ? durations[durations.length - 1] : null,
        p50DurationMs: this.percentile(durations, 50),
        p95DurationMs: this.percentile(durations, 95),
        p99DurationMs: this.percentile(durations, 99),
      });
    }

    return results;
  }

  private percentile(sortedArr: number[], p: number): number | null {
    if (sortedArr.length === 0) return null;
    const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
    return sortedArr[Math.max(0, idx)];
  }
}
