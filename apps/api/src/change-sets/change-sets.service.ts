import { Injectable, NotFoundException, BadRequestException, Inject } from "@nestjs/common";
import {
  ChangeSet,
  CHANGE_SET_REPOSITORY,
  IChangeSetRepository,
  BOT_INSTANCE_REPOSITORY,
  IBotInstanceRepository,
} from "@clawster/database";
import { CreateChangeSetDto, RollbackChangeSetDto, ListChangeSetsQueryDto } from "./change-sets.dto";

@Injectable()
export class ChangeSetsService {
  constructor(
    @Inject(CHANGE_SET_REPOSITORY) private readonly changeSetRepo: IChangeSetRepository,
    @Inject(BOT_INSTANCE_REPOSITORY) private readonly botInstanceRepo: IBotInstanceRepository,
  ) {}

  async create(dto: CreateChangeSetDto): Promise<ChangeSet> {
    // Verify bot instance exists
    const bot = await this.botInstanceRepo.findById(dto.botInstanceId);

    if (!bot) {
      throw new NotFoundException(`Bot instance ${dto.botInstanceId} not found`);
    }

    const changeSet = await this.changeSetRepo.create({
      botInstance: { connect: { id: dto.botInstanceId } },
      changeType: dto.changeType,
      description: dto.description,
      fromManifest: JSON.stringify(dto.fromManifest),
      toManifest: JSON.stringify(dto.toManifest),
      rolloutStrategy: dto.rolloutStrategy || "ALL",
      rolloutPercentage: dto.rolloutPercentage,
      canaryInstances: dto.canaryInstances ? JSON.stringify(dto.canaryInstances) : null,
      status: "PENDING",
      totalInstances: dto.totalInstances || 1,
      createdBy: dto.createdBy || "system",
    });

    return changeSet;
  }

  async findAll(query: ListChangeSetsQueryDto): Promise<ChangeSet[]> {
    const result = await this.changeSetRepo.findMany({
      botInstanceId: query.botInstanceId,
      status: query.status,
      changeType: query.changeType,
    });
    return result.data;
  }

  async findOne(id: string): Promise<ChangeSet> {
    const changeSet = await this.changeSetRepo.findById(id);

    if (!changeSet) {
      throw new NotFoundException(`Change set ${id} not found`);
    }

    return changeSet;
  }

  async startRollout(id: string): Promise<ChangeSet> {
    const changeSet = await this.findOne(id);

    if (changeSet.status !== "PENDING") {
      throw new BadRequestException(`Cannot start rollout from status ${changeSet.status}`);
    }

    return this.changeSetRepo.start(id);
  }

  async updateProgress(id: string, updated: number, failed: number): Promise<ChangeSet> {
    const changeSet = await this.findOne(id);

    if (changeSet.status !== "IN_PROGRESS") {
      throw new BadRequestException(`Cannot update progress for status ${changeSet.status}`);
    }

    const newUpdated = changeSet.updatedInstances + updated;
    const newFailed = changeSet.failedInstances + failed;
    const total = changeSet.totalInstances;

    // Update progress first
    await this.changeSetRepo.updateProgress(id, newUpdated, newFailed);

    // Check if rollout is complete and update status accordingly
    if (newUpdated + newFailed >= total) {
      if (newFailed > 0) {
        return this.changeSetRepo.fail(id);
      } else {
        return this.changeSetRepo.complete(id);
      }
    }

    // Return the updated change set
    return this.findOne(id);
  }

  async complete(id: string): Promise<ChangeSet> {
    // Verify change set exists
    await this.findOne(id);

    return this.changeSetRepo.complete(id);
  }

  async fail(id: string, error: string): Promise<ChangeSet> {
    // Verify change set exists
    await this.findOne(id);

    return this.changeSetRepo.fail(id);
  }

  async rollback(id: string, dto: RollbackChangeSetDto): Promise<ChangeSet> {
    const changeSet = await this.findOne(id);

    if (!changeSet.canRollback) {
      throw new BadRequestException("This change set cannot be rolled back");
    }

    if (changeSet.rolledBackAt) {
      throw new BadRequestException("Change set has already been rolled back");
    }

    // Create a new change set for the rollback
    const rollbackChangeSet = await this.changeSetRepo.create({
      botInstance: { connect: { id: changeSet.botInstanceId } },
      changeType: "ROLLBACK",
      description: `Rollback of ${changeSet.id}: ${dto.reason}`,
      fromManifest: changeSet.toManifest,
      toManifest: changeSet.fromManifest,
      rolloutStrategy: "ALL",
      status: "PENDING",
      totalInstances: changeSet.totalInstances,
      createdBy: dto.rolledBackBy || "system",
    });

    // Mark original as rolled back
    await this.changeSetRepo.rollback(id, dto.rolledBackBy || "system");

    return rollbackChangeSet;
  }

  async getRolloutStatus(id: string): Promise<{
    changeSetId: string;
    status: string;
    progress: {
      total: number;
      updated: number;
      failed: number;
      remaining: number;
      percentage: number;
    };
    canRollback: boolean;
  }> {
    const changeSet = await this.findOne(id);

    return {
      changeSetId: id,
      status: changeSet.status,
      progress: {
        total: changeSet.totalInstances,
        updated: changeSet.updatedInstances,
        failed: changeSet.failedInstances,
        remaining: changeSet.totalInstances - changeSet.updatedInstances - changeSet.failedInstances,
        percentage: Math.round(
          ((changeSet.updatedInstances + changeSet.failedInstances) / changeSet.totalInstances) * 100
        ),
      },
      canRollback: changeSet.canRollback && !changeSet.rolledBackAt,
    };
  }
}