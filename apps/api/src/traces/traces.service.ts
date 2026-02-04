import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import {
  Trace,
  TRACE_REPOSITORY,
  ITraceRepository,
  BOT_INSTANCE_REPOSITORY,
  IBotInstanceRepository,
} from "@clawster/database";
import { CreateTraceDto, ListTracesQueryDto } from "./traces.dto";

@Injectable()
export class TracesService {
  constructor(
    @Inject(TRACE_REPOSITORY) private readonly traceRepo: ITraceRepository,
    @Inject(BOT_INSTANCE_REPOSITORY) private readonly botInstanceRepo: IBotInstanceRepository,
  ) {}

  async create(dto: CreateTraceDto): Promise<Trace> {
    const trace = await this.traceRepo.create({
      botInstanceId: dto.botInstanceId,
      traceId: dto.traceId,
      parentTraceId: dto.parentTraceId,
      name: dto.name,
      type: dto.type,
      status: dto.status || "PENDING",
      startedAt: dto.startedAt || new Date(),
      endedAt: dto.endedAt,
      durationMs: dto.durationMs,
      input: dto.input ? JSON.stringify(dto.input) : undefined,
      output: dto.output ? JSON.stringify(dto.output) : undefined,
      error: dto.error ? JSON.stringify(dto.error) : undefined,
      metadata: JSON.stringify(dto.metadata || {}),
      tags: JSON.stringify(dto.tags || {}),
    });

    return trace;
  }

  async findAll(query: ListTracesQueryDto): Promise<Trace[]> {
    const result = await this.traceRepo.findMany(
      {
        instanceId: query.botInstanceId,
        type: query.type,
        status: query.status,
        parentTraceId: query.parentTraceId,
        startedAfter: query.from ? new Date(query.from) : undefined,
        startedBefore: query.to ? new Date(query.to) : undefined,
      },
      { limit: query.limit || 100 }
    );
    return result.data;
  }

  async findOne(id: string): Promise<Trace> {
    const trace = await this.traceRepo.findById(id);

    if (!trace) {
      throw new NotFoundException(`Trace ${id} not found`);
    }

    return trace;
  }

  async findByTraceId(traceId: string): Promise<Trace & { children: Trace[] }> {
    const trace = await this.traceRepo.findByTraceId(traceId);

    if (!trace) {
      throw new NotFoundException(`Trace with ID ${traceId} not found`);
    }

    // Get child traces
    const children = await this.traceRepo.findChildren(traceId);

    return { ...trace, children };
  }

  async complete(id: string, output?: Record<string, unknown>): Promise<Trace> {
    // Verify trace exists first
    await this.findOne(id);

    return this.traceRepo.complete(
      id,
      "SUCCESS",
      output ? JSON.stringify(output) : undefined
    );
  }

  async fail(id: string, error: Record<string, unknown>): Promise<Trace> {
    // Verify trace exists first
    await this.findOne(id);

    return this.traceRepo.complete(
      id,
      "ERROR",
      undefined,
      JSON.stringify(error)
    );
  }

  async getTraceTree(traceId: string): Promise<Record<string, unknown>> {
    const tree = await this.traceRepo.findTree(traceId);

    if (!tree) {
      throw new NotFoundException(`Trace with ID ${traceId} not found`);
    }

    return tree.root as unknown as Record<string, unknown>;
  }

  async getStats(botInstanceId: string, from: Date, to: Date): Promise<{
    total: number;
    success: number;
    error: number;
    pending: number;
    avgDuration: number;
    byType: Record<string, number>;
  }> {
    const stats = await this.traceRepo.getStats(botInstanceId, from, to);
    const statsByType = await this.traceRepo.getStatsByType(botInstanceId, from, to);

    const byType: Record<string, number> = {};
    for (const typeStat of statsByType) {
      byType[typeStat.type] = typeStat.totalTraces;
    }

    return {
      total: stats.totalTraces,
      success: stats.successCount,
      error: stats.errorCount,
      pending: stats.pendingCount,
      avgDuration: stats.avgDurationMs ?? 0,
      byType,
    };
  }
}