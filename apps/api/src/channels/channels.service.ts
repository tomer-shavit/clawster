import { Injectable, Inject, NotFoundException, BadRequestException } from "@nestjs/common";
import {
  CommunicationChannel,
  BotChannelBinding,
  CHANNEL_REPOSITORY,
  IChannelRepository,
  BOT_INSTANCE_REPOSITORY,
  IBotInstanceRepository,
} from "@clawster/database";
import {
  CreateChannelDto,
  UpdateChannelDto,
  ListChannelsQueryDto,
  TestChannelDto,
  BindChannelToBotDto,
  UpdateBindingDto,
  SendTestMessageDto,
} from "./channels.dto";
import {
  OpenClawChannelType,
  OPENCLAW_CHANNEL_TYPES,
  CHANNEL_TYPE_META,
  NODE_REQUIRED_CHANNELS,
  DEFAULT_COMMON_CONFIG,
  ChannelTypeMeta,
} from "./channel-types";
import { ChannelAuthService } from "./channel-auth.service";
import { ChannelConfigGenerator, ChannelData } from "./channel-config-generator";

// ============================================
// Map OpenClawChannelType -> existing ChannelType enum
// ============================================

const OPENCLAW_TO_DB_TYPE: Partial<Record<OpenClawChannelType, string>> = {
  slack: "SLACK",
  telegram: "TELEGRAM",
  discord: "DISCORD",
};

function resolveDbChannelType(openclawType: OpenClawChannelType, explicit?: string): string {
  if (explicit) return explicit;
  return OPENCLAW_TO_DB_TYPE[openclawType] ?? "CUSTOM";
}

@Injectable()
export class ChannelsService {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channelRepo: IChannelRepository,
    @Inject(BOT_INSTANCE_REPOSITORY) private readonly botRepo: IBotInstanceRepository,
    private readonly authService: ChannelAuthService,
    private readonly configGenerator: ChannelConfigGenerator,
  ) {}

  // ==========================================
  // Channel Type Definitions (OpenClaw-native)
  // ==========================================

  getChannelTypes(): ChannelTypeMeta[] {
    return OPENCLAW_CHANNEL_TYPES.map((type) => CHANNEL_TYPE_META[type]);
  }

  // ==========================================
  // CRUD Operations
  // ==========================================

  async create(dto: CreateChannelDto): Promise<CommunicationChannel> {
    const meta = CHANNEL_TYPE_META[dto.openclawType];
    if (!meta) {
      throw new BadRequestException(`Unknown OpenClaw channel type: ${dto.openclawType}`);
    }

    // Runtime compatibility check
    if (dto.botInstanceId && NODE_REQUIRED_CHANNELS.includes(dto.openclawType)) {
      await this.authService.validateRuntimeCompatibility(dto.botInstanceId, dto.openclawType);
    }

    // Check for duplicate name in workspace
    const existingChannels = await this.channelRepo.findChannelsByWorkspace(dto.workspaceId, {
      search: dto.name,
    });
    const existing = existingChannels.find((ch) => ch.name === dto.name);

    if (existing) {
      throw new BadRequestException(`Channel with name '${dto.name}' already exists in this workspace`);
    }

    // Build the config JSON that stores all OpenClaw-specific data
    const config = this.buildStoredConfig(dto);

    const dbType = resolveDbChannelType(dto.openclawType, dto.type);

    return this.channelRepo.createChannel({
      name: dto.name,
      workspace: { connect: { id: dto.workspaceId } },
      type: dbType,
      config: JSON.stringify(config),
      defaults: JSON.stringify({}),
      isShared: dto.isShared ?? true,
      tags: JSON.stringify(dto.tags || {}),
      createdBy: dto.createdBy || "system",
      status: "PENDING",
    });
  }

  async findAll(query: ListChannelsQueryDto): Promise<CommunicationChannel[]> {
    const result = await this.channelRepo.findManyChannels({
      workspaceId: query.workspaceId,
      type: query.type,
      status: query.status,
    });

    let channels = result.data;

    // Filter by openclawType if specified
    if (query.openclawType) {
      channels = channels.filter((ch) => {
        const cfg = (typeof ch.config === "string" ? JSON.parse(ch.config) : ch.config) as Record<string, unknown> | null;
        return cfg?.openclawType === query.openclawType;
      });
    }

    return channels;
  }

  async findOne(id: string): Promise<CommunicationChannel & { botBindings: BotChannelBinding[] }> {
    const channel = await this.channelRepo.findChannelById(id);

    if (!channel) {
      throw new NotFoundException(`Channel ${id} not found`);
    }

    // Get bindings separately since the repository doesn't include full bot relations
    const bindings = await this.channelRepo.findBindingsByChannel(id);

    return {
      ...channel,
      botBindings: bindings,
    };
  }

  async update(id: string, dto: UpdateChannelDto): Promise<CommunicationChannel> {
    const channel = await this.findOne(id);
    const existingConfig = (typeof channel.config === "string" ? JSON.parse(channel.config) : channel.config || {}) as Record<string, unknown>;

    // Merge policies
    if (dto.policies) {
      existingConfig.policies = {
        ...((existingConfig.policies as Record<string, unknown>) || {}),
        ...dto.policies,
      };
    }

    // Merge type-specific config
    if (dto.typeConfig) {
      existingConfig.typeConfig = {
        ...((existingConfig.typeConfig as Record<string, unknown>) || {}),
        ...dto.typeConfig,
      };
    }

    // Merge secrets (never overwrite with empty)
    if (dto.secrets) {
      existingConfig.secrets = {
        ...((existingConfig.secrets as Record<string, unknown>) || {}),
        ...dto.secrets,
      };
    }

    // Update enabled flag
    if (dto.enabled !== undefined) {
      existingConfig.enabled = dto.enabled;
    }

    return this.channelRepo.updateChannel(id, {
      ...(dto.name && { name: dto.name }),
      config: JSON.stringify(existingConfig),
      ...(dto.isShared !== undefined && { isShared: dto.isShared }),
      ...(dto.status && { status: dto.status }),
      ...(dto.tags && { tags: JSON.stringify(dto.tags) }),
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    // Check if channel has active bindings
    const bindings = await this.channelRepo.findBindingsByChannel(id);

    if (bindings.length > 0) {
      throw new BadRequestException(
        `Cannot delete channel with ${bindings.length} active bot bindings. Unbind all bots first.`,
      );
    }

    await this.channelRepo.deleteChannel(id);
  }

  // ==========================================
  // Bot Channel Bindings
  // ==========================================

  async bindToBot(channelId: string, dto: BindChannelToBotDto): Promise<BotChannelBinding> {
    const channel = await this.channelRepo.findChannelById(channelId);

    if (!channel) {
      throw new NotFoundException(`Channel ${channelId} not found`);
    }

    const bot = await this.botRepo.findById(dto.botId);

    if (!bot) {
      throw new NotFoundException(`Bot ${dto.botId} not found`);
    }

    // Runtime check for Node-required channels
    const config = (typeof channel.config === "string" ? JSON.parse(channel.config) : channel.config) as Record<string, unknown> | null;
    const openclawType = config?.openclawType as OpenClawChannelType | undefined;
    if (openclawType && NODE_REQUIRED_CHANNELS.includes(openclawType)) {
      await this.authService.validateRuntimeCompatibility(dto.botId, openclawType);
    }

    // Check for existing binding with same purpose
    const existingBindings = await this.channelRepo.findBindingsByBot(dto.botId, { purpose: dto.purpose });
    const existing = existingBindings.find((b) => b.channelId === channelId);

    if (existing) {
      throw new BadRequestException(
        `Bot already has a '${dto.purpose}' binding to this channel. Use a different purpose or update the existing binding.`,
      );
    }

    return this.channelRepo.createBinding({
      bot: { connect: { id: dto.botId } },
      channel: { connect: { id: channelId } },
      purpose: dto.purpose,
      settings: JSON.stringify(dto.settings || {}),
      targetDestination: dto.targetDestination ? JSON.stringify(dto.targetDestination) : null,
      isActive: dto.isActive ?? true,
    });
  }

  async unbindFromBot(bindingId: string): Promise<void> {
    await this.channelRepo.deleteBinding(bindingId);
  }

  async updateBinding(bindingId: string, dto: UpdateBindingDto): Promise<BotChannelBinding> {
    return this.channelRepo.updateBinding(bindingId, {
      ...(dto.purpose && { purpose: dto.purpose }),
      ...(dto.settings && { settings: JSON.stringify(dto.settings) }),
      ...(dto.targetDestination && { targetDestination: JSON.stringify(dto.targetDestination) }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
  }

  async getBoundBots(channelId: string): Promise<BotChannelBinding[]> {
    return this.channelRepo.findBindingsByChannel(channelId);
  }

  async getBotChannels(botId: string): Promise<BotChannelBinding[]> {
    const bindings = await this.channelRepo.findBindingsByBot(botId);
    return bindings;
  }

  // ==========================================
  // Config Generation
  // ==========================================

  async generateConfig(
    instanceId: string,
    channelIds?: string[],
  ): Promise<Record<string, unknown>> {
    // Get all channels bound to this bot instance
    const bindings = await this.channelRepo.findBindingsByBot(instanceId, { isActive: true });

    // Filter by channelIds if specified
    const filteredBindings = channelIds && channelIds.length > 0
      ? bindings.filter((b) => channelIds.includes(b.channelId))
      : bindings;

    const channelDataList: ChannelData[] = filteredBindings
      .map((binding) => {
        const channel = binding.channel;
        if (!channel) return null;
        const config = (typeof channel.config === "string" ? JSON.parse(channel.config) : channel.config) as Record<string, unknown> | null;
        if (!config?.openclawType) return null;

        return {
          id: channel.id,
          name: channel.name,
          openclawType: config.openclawType as OpenClawChannelType,
          enabled: config.enabled ?? true,
          policies: config.policies || {},
          typeConfig: config.typeConfig || {},
          secrets: config.secrets || {},
        };
      })
      .filter((d): d is ChannelData => d !== null);

    return this.configGenerator.generateChannelConfig(channelDataList);
  }

  // ==========================================
  // Testing & Health
  // ==========================================

  async testConnection(id: string, dto: TestChannelDto): Promise<Record<string, unknown>> {
    const channel = await this.channelRepo.findChannelById(id);

    if (!channel) {
      throw new NotFoundException(`Channel ${id} not found`);
    }

    const config = dto.config || (typeof channel.config === "string" ? JSON.parse(channel.config) : channel.config) as Record<string, unknown>;
    const openclawType = config?.openclawType as OpenClawChannelType | undefined;

    if (!openclawType) {
      return {
        success: false,
        error: "Channel does not have an openclawType configured",
      };
    }

    const meta = CHANNEL_TYPE_META[openclawType];
    const secrets = config?.secrets as Record<string, string> | undefined;

    // Validate required secrets are present
    const missingSecrets = meta.requiredSecrets.filter(
      (s) => !secrets?.[s] || secrets[s].length === 0,
    );

    if (missingSecrets.length > 0) {
      const testResult = {
        success: false,
        error: `Missing required secrets: ${missingSecrets.join(", ")}`,
      };

      await this.channelRepo.updateChannelStatus(id, "ERROR", testResult.error, testResult.error);

      return testResult;
    }

    // Simulate connection test
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

    const testResult = {
      success: true,
      openclawType,
      authMethod: meta.authMethod,
      latencyMs: Math.floor(Math.random() * 100),
    };

    await this.channelRepo.updateChannelStatus(id, "ACTIVE", "Connection test successful");

    return testResult;
  }

  async sendTestMessage(id: string, dto: SendTestMessageDto): Promise<Record<string, unknown>> {
    const channel = await this.channelRepo.findChannelById(id);

    if (!channel) {
      throw new NotFoundException(`Channel ${id} not found`);
    }

    // Simulate sending test message
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

    const result = {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    };

    if (result.success) {
      await this.channelRepo.recordMessageSent(id);
    }

    return result;
  }

  async checkBotChannelsHealth(botId: string): Promise<Record<string, unknown>> {
    const bindings = await this.channelRepo.findBindingsByBot(botId, { isActive: true });

    const results = await Promise.all(
      bindings.map(async (binding) => {
        const channel = binding.channel;
        const config = channel ? (typeof channel.config === "string" ? JSON.parse(channel.config) : channel.config) as Record<string, unknown> | null : null;
        const openclawType = config?.openclawType as string | undefined;

        // Simulate health check
        await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));
        const healthy = true;

        await this.channelRepo.updateBindingHealth(binding.id, healthy ? "HEALTHY" : "UNHEALTHY");

        return {
          bindingId: binding.id,
          channelId: binding.channelId,
          channelName: channel?.name || "unknown",
          type: channel?.type || "unknown",
          openclawType: openclawType || "unknown",
          purpose: binding.purpose,
          healthy,
        };
      }),
    );

    const healthy = results.filter((r) => r.healthy).length;
    const unhealthy = results.filter((r) => !r.healthy).length;

    return {
      botId,
      total: results.length,
      healthy,
      unhealthy,
      channels: results,
    };
  }

  // ==========================================
  // Stats
  // ==========================================

  async getChannelStats(id: string): Promise<Record<string, unknown>> {
    const channel = await this.channelRepo.findChannelById(id);

    if (!channel) {
      throw new NotFoundException(`Channel ${id} not found`);
    }

    const config = (typeof channel.config === "string" ? JSON.parse(channel.config) : channel.config) as Record<string, unknown> | null;

    const bindings = await this.channelRepo.findBindingsByChannel(id);
    const recentBindings = bindings.slice(0, 10);

    return {
      channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        openclawType: config?.openclawType || null,
        status: channel.status,
        enabled: config?.enabled ?? true,
      },
      metrics: {
        messagesSent: channel.messagesSent,
        messagesFailed: channel.messagesFailed,
        errorCount: channel.errorCount,
        successRate:
          channel.messagesSent + channel.messagesFailed > 0
            ? (channel.messagesSent / (channel.messagesSent + channel.messagesFailed)) * 100
            : 0,
      },
      bindings: {
        total: channel._count?.botBindings ?? bindings.length,
        recent: recentBindings,
      },
      health: {
        lastTestedAt: channel.lastTestedAt,
        lastActivityAt: channel.lastActivityAt,
        lastError: channel.lastError,
      },
    };
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  private buildStoredConfig(dto: CreateChannelDto): Record<string, unknown> {
    return {
      openclawType: dto.openclawType,
      enabled: dto.enabled ?? true,
      policies: {
        dmPolicy: dto.policies?.dmPolicy ?? DEFAULT_COMMON_CONFIG.dmPolicy,
        groupPolicy: dto.policies?.groupPolicy ?? DEFAULT_COMMON_CONFIG.groupPolicy,
        allowFrom: dto.policies?.allowFrom ?? DEFAULT_COMMON_CONFIG.allowFrom,
        groupAllowFrom: dto.policies?.groupAllowFrom ?? DEFAULT_COMMON_CONFIG.groupAllowFrom,
        historyLimit: dto.policies?.historyLimit ?? DEFAULT_COMMON_CONFIG.historyLimit,
        mediaMaxMb: dto.policies?.mediaMaxMb ?? DEFAULT_COMMON_CONFIG.mediaMaxMb,
      },
      typeConfig: dto.typeConfig || {},
      secrets: dto.secrets || {},
    };
  }
}
