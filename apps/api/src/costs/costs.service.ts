import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import {
  CostEvent,
  COST_REPOSITORY,
  ICostRepository,
  BOT_INSTANCE_REPOSITORY,
  IBotInstanceRepository,
} from "@clawster/database";
import { CreateCostEventDto, CostQueryDto, CostSummaryQueryDto } from "./costs.dto";

export interface CostSummaryByProvider {
  provider: string;
  _sum: {
    costCents: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
  };
  _count: {
    id: number;
  };
}

export interface CostSummaryByModel {
  model: string;
  provider: string;
  _sum: {
    costCents: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
  };
  _count: {
    id: number;
  };
}

export interface CostSummaryByChannel {
  channelType: string | null;
  _sum: {
    costCents: number | null;
  };
  _count: {
    id: number;
  };
}

export interface CostSummaryResult {
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEvents: number;
  byProvider: CostSummaryByProvider[];
  byModel: CostSummaryByModel[];
  byChannel: CostSummaryByChannel[];
}

export interface PaginatedCostEvents {
  data: CostEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class CostsService {
  constructor(
    @Inject(COST_REPOSITORY)
    private readonly costRepo: ICostRepository,
    @Inject(BOT_INSTANCE_REPOSITORY)
    private readonly botInstanceRepo: IBotInstanceRepository,
  ) {}

  async recordCostEvent(dto: CreateCostEventDto): Promise<CostEvent> {
    // Verify instance exists
    const instance = await this.botInstanceRepo.findById(dto.instanceId);

    if (!instance) {
      throw new NotFoundException(`Bot instance ${dto.instanceId} not found`);
    }

    // Create the cost event (repository handles budget updates internally)
    const costEvent = await this.costRepo.recordEvent({
      instanceId: dto.instanceId,
      provider: dto.provider,
      model: dto.model,
      inputTokens: dto.inputTokens,
      outputTokens: dto.outputTokens,
      costCents: dto.costCents,
      channelType: dto.channelType,
      traceId: dto.traceId,
    });

    return costEvent;
  }

  async getCostSummary(query: CostSummaryQueryDto): Promise<CostSummaryResult> {
    const startDate = query.from ? new Date(query.from) : new Date(0);
    const endDate = query.to ? new Date(query.to) : new Date();

    const filters = {
      instanceId: query.instanceId,
      startDate,
      endDate,
    };

    const [totals, byProvider, byModel] = await Promise.all([
      this.costRepo.getSummaryByDateRange(startDate, endDate, filters),
      this.costRepo.getSummaryByProvider(filters),
      this.costRepo.getSummaryByModel(filters),
    ]);

    // Transform repository results to match existing API response format
    const byProviderFormatted = byProvider.map((p) => ({
      provider: p.provider,
      _sum: {
        costCents: p.totalCostCents,
        inputTokens: p.totalInputTokens,
        outputTokens: p.totalOutputTokens,
      },
      _count: {
        id: p.totalEvents,
      },
    }));

    const byModelFormatted = byModel.map((m) => ({
      model: m.model,
      provider: m.provider,
      _sum: {
        costCents: m.totalCostCents,
        inputTokens: m.totalInputTokens,
        outputTokens: m.totalOutputTokens,
      },
      _count: {
        id: m.totalEvents,
      },
    }));

    // Note: byChannel is not directly supported by the repository interface
    // For now, return an empty array. This can be extended in the repository if needed.
    const byChannel: CostSummaryByChannel[] = [];

    return {
      totalCostCents: totals.totalCostCents,
      totalInputTokens: totals.totalInputTokens,
      totalOutputTokens: totals.totalOutputTokens,
      totalEvents: totals.totalEvents,
      byProvider: byProviderFormatted,
      byModel: byModelFormatted,
      byChannel,
    };
  }

  async getInstanceCosts(
    instanceId: string,
    from?: string,
    to?: string,
  ): Promise<CostSummaryResult> {
    // Verify instance exists
    const instance = await this.botInstanceRepo.findById(instanceId);

    if (!instance) {
      throw new NotFoundException(`Bot instance ${instanceId} not found`);
    }

    return this.getCostSummary({ instanceId, from, to });
  }

  async listCostEvents(query: CostQueryDto): Promise<PaginatedCostEvents> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const startDate = query.from ? new Date(query.from) : new Date(0);
    const endDate = query.to ? new Date(query.to) : new Date();

    const result = await this.costRepo.findByDateRange(
      startDate,
      endDate,
      {
        instanceId: query.instanceId,
        provider: query.provider,
      },
      { page, limit },
    );

    return {
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }
}
