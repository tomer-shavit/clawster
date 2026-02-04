import { Injectable, Inject, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import {
  SKILL_PACK_REPOSITORY,
  ISkillPackRepository,
  BOT_INSTANCE_REPOSITORY,
  IBotInstanceRepository,
} from '@clawster/database';
import { CreateSkillPackDto, UpdateSkillPackDto, AttachSkillPackDto, BulkAttachSkillPackDto } from './skill-packs.dto';
import { SkillPackResponse, SkillPackWithBots, BotAttachmentResponse, BulkAttachResult, SyncResult } from './skill-packs.types';
import { SkillVerificationService } from '../security/skill-verification.service';

@Injectable()
export class SkillPacksService {
  private readonly logger = new Logger(SkillPacksService.name);

  constructor(
    @Inject(SKILL_PACK_REPOSITORY) private readonly skillPackRepo: ISkillPackRepository,
    @Inject(BOT_INSTANCE_REPOSITORY) private readonly botRepo: IBotInstanceRepository,
    private readonly skillVerification: SkillVerificationService,
  ) {}
  async create(workspaceId: string, userId: string, dto: CreateSkillPackDto): Promise<SkillPackResponse> {
    // Check for duplicate name
    const existing = await this.skillPackRepo.findSkillPackByName(workspaceId, dto.name);

    if (existing) {
      throw new ConflictException(`SkillPack '${dto.name}' already exists`);
    }

    const skillPack = await this.skillPackRepo.createSkillPack({
      name: dto.name,
      description: dto.description,
      workspace: { connect: { id: workspaceId } },
      createdBy: userId,
      skills: JSON.stringify(dto.skills || []),
      mcps: JSON.stringify(dto.mcps || []),
      envVars: JSON.stringify(dto.envVars || {}),
    });

    // Warn about unverified skills from non-bundled sources
    const skills = (dto.skills || []) as Array<Record<string, unknown>>;
    const unverifiedSkills = skills.filter(
      (s) => s.source && s.source !== "bundled",
    );
    if (unverifiedSkills.length > 0) {
      this.logger.warn(
        `SkillPack '${dto.name}' contains ${unverifiedSkills.length} skill(s) from non-bundled sources that are unverified: ${unverifiedSkills.map((s) => s.name || s.source).join(", ")}`,
      );
    }

    return skillPack as unknown as SkillPackResponse;
  }

  async findAll(workspaceId: string): Promise<SkillPackResponse[]> {
    const skillPacks = await this.skillPackRepo.findSkillPacksByWorkspace(workspaceId);
    return skillPacks as unknown as SkillPackResponse[];
  }

  async findOne(workspaceId: string, id: string): Promise<SkillPackWithBots> {
    const skillPack = await this.skillPackRepo.findSkillPackById(id);

    if (!skillPack || skillPack.workspaceId !== workspaceId) {
      throw new NotFoundException(`SkillPack ${id} not found`);
    }

    // Get bot instances attached to this skill pack
    const botInstanceAssociations = await this.skillPackRepo.findBotInstancesBySkillPack(id);

    return {
      ...skillPack,
      botInstances: botInstanceAssociations,
    } as unknown as SkillPackWithBots;
  }

  async update(workspaceId: string, id: string, dto: UpdateSkillPackDto): Promise<SkillPackResponse> {
    const currentPack = await this.findOne(workspaceId, id);

    // Check name uniqueness if changing name
    if (dto.name && dto.name !== currentPack.name) {
      const existing = await this.skillPackRepo.findSkillPackByName(workspaceId, dto.name);
      if (existing) {
        throw new ConflictException(`SkillPack '${dto.name}' already exists`);
      }
    }

    // Increment version when content changes
    const shouldIncrementVersion = !!(dto.skills || dto.mcps || dto.envVars);

    const { skills, mcps, envVars, ...restDto } = dto;
    const updatedPack = await this.skillPackRepo.updateSkillPack(id, {
      ...restDto,
      ...(skills && { skills: JSON.stringify(skills) }),
      ...(mcps && { mcps: JSON.stringify(mcps) }),
      ...(envVars && { envVars: JSON.stringify(envVars) }),
      updatedAt: new Date(),
    });

    // Increment version if needed
    if (shouldIncrementVersion) {
      await this.skillPackRepo.incrementVersion(id);
    }

    return updatedPack as unknown as SkillPackResponse;
  }

  async remove(workspaceId: string, id: string): Promise<SkillPackResponse> {
    const skillPack = await this.findOne(workspaceId, id);

    await this.skillPackRepo.deleteSkillPack(id);

    return skillPack as unknown as SkillPackResponse;
  }

  async attachToBot(workspaceId: string, skillPackId: string, dto: AttachSkillPackDto): Promise<BotAttachmentResponse> {
    // Verify skill pack exists
    await this.findOne(workspaceId, skillPackId);

    // Verify bot exists
    const bot = await this.botRepo.findById(dto.botInstanceId);

    if (!bot || bot.workspaceId !== workspaceId) {
      throw new NotFoundException(`Bot ${dto.botInstanceId} not found`);
    }

    // Check if already attached
    const isAlreadyAttached = await this.skillPackRepo.isAttached(dto.botInstanceId, skillPackId);

    if (isAlreadyAttached) {
      throw new ConflictException(`SkillPack already attached to this bot`);
    }

    const attachment = await this.skillPackRepo.attachSkillPack(
      dto.botInstanceId,
      skillPackId,
      JSON.stringify(dto.envOverrides || {}),
    );

    return attachment as unknown as BotAttachmentResponse;
  }

  async bulkAttach(workspaceId: string, skillPackId: string, dto: BulkAttachSkillPackDto): Promise<BulkAttachResult> {
    // Verify skill pack exists
    await this.findOne(workspaceId, skillPackId);

    const results: BulkAttachResult = {
      successful: [],
      failed: [],
    };

    for (const botInstanceId of dto.botInstanceIds) {
      try {
        // Verify bot exists
        const bot = await this.botRepo.findById(botInstanceId);

        if (!bot || bot.workspaceId !== workspaceId) {
          results.failed.push({ botId: botInstanceId, error: 'Bot not found' });
          continue;
        }

        // Check if already attached
        const isAlreadyAttached = await this.skillPackRepo.isAttached(botInstanceId, skillPackId);

        if (isAlreadyAttached) {
          results.failed.push({ botId: botInstanceId, error: 'Already attached' });
          continue;
        }

        await this.skillPackRepo.attachSkillPack(
          botInstanceId,
          skillPackId,
          JSON.stringify(dto.envOverrides || {}),
        );

        results.successful.push(botInstanceId);
      } catch (error) {
        results.failed.push({ botId: botInstanceId, error: (error as Error).message });
      }
    }

    return results;
  }

  async detachFromBot(workspaceId: string, skillPackId: string, botInstanceId: string): Promise<BotAttachmentResponse> {
    // Verify skill pack exists
    await this.findOne(workspaceId, skillPackId);

    const isAttached = await this.skillPackRepo.isAttached(botInstanceId, skillPackId);

    if (!isAttached) {
      throw new NotFoundException(`SkillPack not attached to this bot`);
    }

    await this.skillPackRepo.detachSkillPack(botInstanceId, skillPackId);

    // Return a placeholder response since detachSkillPack returns void
    return {
      id: `${botInstanceId}_${skillPackId}`,
      botInstanceId,
      skillPackId,
    } as unknown as BotAttachmentResponse;
  }

  async getBotsWithPack(workspaceId: string, skillPackId: string): Promise<Array<{ id: string; name: string; status: string; health: string; envOverrides: Record<string, string>; attachedAt: Date }>> {
    await this.findOne(workspaceId, skillPackId);

    const attachments = await this.skillPackRepo.findBotInstancesBySkillPack(skillPackId);

    // Fetch bot details for each attachment
    const results: Array<{ id: string; name: string; status: string; health: string; envOverrides: Record<string, string>; attachedAt: Date }> = [];

    for (const attachment of attachments) {
      const bot = await this.botRepo.findById(attachment.botInstanceId);
      if (bot) {
        results.push({
          id: bot.id,
          name: bot.name,
          status: bot.status,
          health: bot.health,
          envOverrides: (typeof attachment.envOverrides === "string" ? JSON.parse(attachment.envOverrides) : attachment.envOverrides) as Record<string, string>,
          attachedAt: attachment.attachedAt,
        });
      }
    }

    return results;
  }

  async syncPackToBots(workspaceId: string, skillPackId: string): Promise<SyncResult> {
    const skillPack = await this.findOne(workspaceId, skillPackId);

    // Get all bots using this pack
    const bots = await this.getBotsWithPack(workspaceId, skillPackId);

    // Trigger sync for each bot (this would typically trigger a redeploy or config update)
    const results: SyncResult = {
      synced: bots.length,
      bots: bots.map(b => b.id),
      packVersion: skillPack.version,
    };

    return results;
  }
}
