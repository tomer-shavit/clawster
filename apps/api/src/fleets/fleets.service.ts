import { Injectable, Inject, NotFoundException, BadRequestException } from "@nestjs/common";
import {
  Fleet,
  BotInstance,
  FLEET_REPOSITORY,
  IFleetRepository,
  BOT_INSTANCE_REPOSITORY,
  IBotInstanceRepository,
  WORKSPACE_REPOSITORY,
  IWorkspaceRepository,
} from "@clawster/database";
import { CreateFleetDto, UpdateFleetDto, ListFleetsQueryDto } from "./fleets.dto";

@Injectable()
export class FleetService {
  constructor(
    @Inject(FLEET_REPOSITORY) private readonly fleetRepo: IFleetRepository,
    @Inject(BOT_INSTANCE_REPOSITORY) private readonly botInstanceRepo: IBotInstanceRepository,
    @Inject(WORKSPACE_REPOSITORY) private readonly workspaceRepo: IWorkspaceRepository,
  ) {}
  async create(dto: CreateFleetDto): Promise<Fleet> {
    // Resolve workspaceId — default to first workspace if not provided
    let workspaceId = dto.workspaceId;
    if (!workspaceId) {
      const workspace = await this.workspaceRepo.findFirstWorkspace();
      if (!workspace) {
        throw new BadRequestException("No workspace found. Deploy a bot first to create a default workspace.");
      }
      workspaceId = workspace.id;
    }

    // Check for duplicate name in workspace
    const existing = await this.fleetRepo.findFirst({
      workspaceId,
      name: dto.name,
    });

    if (existing) {
      throw new BadRequestException(`Fleet with name '${dto.name}' already exists in workspace`);
    }

    // Create fleet record
    const fleet = await this.fleetRepo.create({
      workspace: { connect: { id: workspaceId } },
      name: dto.name,
      environment: dto.environment,
      description: dto.description,
      status: "ACTIVE",
      tags: JSON.stringify(dto.tags || {}),
    });

    return fleet;
  }

  async findAll(query: ListFleetsQueryDto): Promise<Fleet[]> {
    return this.fleetRepo.findManyWithInstances({
      workspaceId: query.workspaceId,
      environment: query.environment,
      status: query.status,
    });
  }

  async findOne(id: string): Promise<Fleet & { instances: Pick<BotInstance, 'id' | 'name' | 'status' | 'health' | 'createdAt'>[] }> {
    const fleet = await this.fleetRepo.findByIdWithInstances(id);

    if (!fleet) {
      throw new NotFoundException(`Fleet ${id} not found`);
    }

    return fleet as Fleet & { instances: Pick<BotInstance, 'id' | 'name' | 'status' | 'health' | 'createdAt'>[] };
  }

  async update(id: string, dto: UpdateFleetDto): Promise<Fleet> {
    await this.findOne(id);

    return this.fleetRepo.update(id, {
      ...(dto.name && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.tags && { tags: JSON.stringify(dto.tags) }),
      ...(dto.defaultProfileId !== undefined && { defaultProfileId: dto.defaultProfileId }),
    });
  }

  async updateStatus(id: string, status: string): Promise<Fleet> {
    const fleet = await this.findOne(id);

    // Validate status transitions
    if (fleet.status === "DRAINING" && status !== "ACTIVE") {
      throw new BadRequestException("Cannot transition from DRAINING to any status except ACTIVE");
    }

    return this.fleetRepo.update(id, { status });
  }

  async getHealth(id: string): Promise<{
    fleetId: string;
    totalInstances: number;
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
    unknownCount: number;
    status: string;
  }> {
    const fleet = await this.findOne(id);

    const healthSummary = await this.fleetRepo.getHealthSummary(id);

    if (!healthSummary) {
      throw new NotFoundException(`Fleet ${id} not found`);
    }

    return {
      fleetId: id,
      totalInstances: healthSummary.totalInstances,
      healthyCount: healthSummary.healthyCounts.healthy,
      degradedCount: healthSummary.healthyCounts.degraded,
      unhealthyCount: healthSummary.healthyCounts.unhealthy,
      unknownCount: healthSummary.healthyCounts.unknown,
      status: fleet.status,
    };
  }

  async promote(id: string, targetEnvironment: string): Promise<{ fleet: Fleet; botsReconciling: number }> {
    const fleet = await this.findOne(id);

    // Validate environment transition
    const validTransitions: Record<string, string> = {
      dev: "staging",
      staging: "prod",
    };

    const expectedTarget = validTransitions[fleet.environment];
    if (!expectedTarget) {
      throw new BadRequestException(
        `Fleet is already in '${fleet.environment}' environment and cannot be promoted further`
      );
    }

    if (targetEnvironment !== expectedTarget) {
      throw new BadRequestException(
        `Fleet in '${fleet.environment}' can only be promoted to '${expectedTarget}', not '${targetEnvironment}'`
      );
    }

    // Update fleet environment
    const updatedFleet = await this.fleetRepo.update(id, { environment: targetEnvironment });

    // Update all bot instances' manifests and trigger reconciliation
    const instances = await this.botInstanceRepo.findByFleet(id);

    let botsReconciling = 0;

    for (const instance of instances) {
      try {
        const manifest = typeof instance.desiredManifest === "string"
          ? JSON.parse(instance.desiredManifest)
          : instance.desiredManifest;

        // Update environment in manifest metadata
        if (manifest?.metadata) {
          manifest.metadata.environment = targetEnvironment;
        }

        await this.botInstanceRepo.update(instance.id, {
          desiredManifest: JSON.stringify(manifest),
          status: instance.status === "RUNNING" || instance.status === "DEGRADED"
            ? "PENDING"
            : instance.status,
        });

        if (instance.status === "RUNNING" || instance.status === "DEGRADED") {
          botsReconciling++;
        }
      } catch {
        // Skip instances with invalid manifests
      }
    }

    return { fleet: updatedFleet, botsReconciling };
  }

  async reconcileAll(id: string): Promise<{ queued: number; skipped: number }> {
    await this.findOne(id);

    const instances = await this.botInstanceRepo.findByFleet(id);

    let queued = 0;
    let skipped = 0;

    for (const instance of instances) {
      // Skip instances already being reconciled or in CREATING state
      if (instance.status === "RECONCILING" || instance.status === "CREATING") {
        skipped++;
        continue;
      }

      await this.botInstanceRepo.update(instance.id, { status: "PENDING" });
      queued++;
    }

    return { queued, skipped };
  }

  async remove(id: string): Promise<void> {
    const fleet = await this.findOne(id);

    // Check if fleet has instances
    const instanceCount = await this.botInstanceRepo.count({ fleetId: id });

    if (instanceCount > 0) {
      throw new BadRequestException(
        `Cannot delete fleet with ${instanceCount} instances. Move or delete instances first.`
      );
    }

    if (fleet.environment === "prod") {
      throw new BadRequestException(
        "Cannot delete a production fleet. Demote or move instances first."
      );
    }

    await this.fleetRepo.delete(id);
  }
}