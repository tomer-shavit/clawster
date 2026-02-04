import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import {
  SloDefinition,
  SLO_REPOSITORY,
  ISloRepository,
  BOT_INSTANCE_REPOSITORY,
  IBotInstanceRepository,
} from "@clawster/database";
import { CreateSloDto, UpdateSloDto, SloQueryDto } from "./slos.dto";

@Injectable()
export class SlosService {
  constructor(
    @Inject(SLO_REPOSITORY)
    private readonly sloRepo: ISloRepository,
    @Inject(BOT_INSTANCE_REPOSITORY)
    private readonly botInstanceRepo: IBotInstanceRepository,
  ) {}

  async create(dto: CreateSloDto): Promise<SloDefinition> {
    // Verify the bot instance exists
    const instance = await this.botInstanceRepo.findById(dto.instanceId);

    if (!instance) {
      throw new NotFoundException(`Bot instance ${dto.instanceId} not found`);
    }

    return this.sloRepo.create({
      instance: { connect: { id: dto.instanceId } },
      name: dto.name,
      description: dto.description,
      metric: dto.metric,
      targetValue: dto.targetValue,
      window: dto.window,
      createdBy: dto.createdBy || "system",
    });
  }

  async findAll(query: SloQueryDto): Promise<SloDefinition[]> {
    return this.sloRepo.findManyWithRelations({
      instanceId: query.instanceId,
      isBreached: query.isBreached,
      isActive: query.isActive,
    });
  }

  async findOne(id: string): Promise<SloDefinition> {
    const slo = await this.sloRepo.findById(id);

    if (!slo) {
      throw new NotFoundException(`SLO definition ${id} not found`);
    }

    return slo;
  }

  async findByInstance(instanceId: string): Promise<SloDefinition[]> {
    return this.sloRepo.findByInstanceWithRelations(instanceId);
  }

  async update(id: string, dto: UpdateSloDto): Promise<SloDefinition> {
    await this.findOne(id);

    return this.sloRepo.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.instanceId !== undefined && { instance: { connect: { id: dto.instanceId } } }),
      ...(dto.metric !== undefined && { metric: dto.metric }),
      ...(dto.targetValue !== undefined && { targetValue: dto.targetValue }),
      ...(dto.window !== undefined && { window: dto.window }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.sloRepo.delete(id);
  }

  async getSummary(): Promise<{
    total: number;
    breached: number;
    healthy: number;
    compliancePercent: number;
  }> {
    const [total, breached] = await Promise.all([
      this.sloRepo.count({ isActive: true }),
      this.sloRepo.count({ isActive: true, isBreached: true }),
    ]);

    const healthy = total - breached;
    const compliancePercent = total > 0 ? (healthy / total) * 100 : 100;

    return {
      total,
      breached,
      healthy,
      compliancePercent: Math.round(compliancePercent * 100) / 100,
    };
  }
}
