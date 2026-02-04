import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import {
  CONFIG_LAYER_REPOSITORY,
  IConfigLayerRepository,
  Profile,
} from "@clawster/database";
import { CreateProfileDto, UpdateProfileDto, ListProfilesQueryDto } from "./profiles.dto";

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(CONFIG_LAYER_REPOSITORY) private readonly configLayerRepo: IConfigLayerRepository,
  ) {}

  async create(dto: CreateProfileDto): Promise<Profile> {
    const profile = await this.configLayerRepo.createProfile({
      workspace: { connect: { id: dto.workspaceId } },
      name: dto.name,
      description: dto.description,
      fleetIds: JSON.stringify(dto.fleetIds || []),
      defaults: JSON.stringify(dto.defaults),
      mergeStrategy: JSON.stringify(dto.mergeStrategy || {}),
      allowInstanceOverrides: dto.allowInstanceOverrides ?? true,
      lockedFields: JSON.stringify(dto.lockedFields || []),
      priority: dto.priority || 0,
      createdBy: dto.createdBy || "system",
    });

    return profile;
  }

  async findAll(query: ListProfilesQueryDto): Promise<Profile[]> {
    const profiles = await this.configLayerRepo.findProfilesByWorkspace(
      query.workspaceId,
      { isActive: query.isActive },
    );

    // Apply fleetId filtering if specified (kept as post-filter for JSON field matching)
    if (query.fleetId) {
      return profiles.filter(profile => {
        const fleetIds = profile.fleetIds as string;
        return fleetIds === "[]" || fleetIds.includes(query.fleetId!);
      });
    }

    return profiles;
  }

  async findOne(id: string): Promise<Profile> {
    const profile = await this.configLayerRepo.findProfileById(id);

    if (!profile) {
      throw new NotFoundException(`Profile ${id} not found`);
    }

    return profile;
  }

  async update(id: string, dto: UpdateProfileDto): Promise<Profile> {
    await this.findOne(id);

    return this.configLayerRepo.updateProfile(id, {
      ...(dto.name && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.fleetIds && { fleetIds: JSON.stringify(dto.fleetIds) }),
      ...(dto.defaults && { defaults: JSON.stringify(dto.defaults) }),
      ...(dto.mergeStrategy && { mergeStrategy: JSON.stringify(dto.mergeStrategy) }),
      ...(dto.allowInstanceOverrides !== undefined && { allowInstanceOverrides: dto.allowInstanceOverrides }),
      ...(dto.lockedFields && { lockedFields: JSON.stringify(dto.lockedFields) }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.configLayerRepo.deleteProfile(id);
  }
}