import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import {
  prisma,
  CommunicationChannel,
  BotChannelBinding,
  ChannelType,
  ChannelStatus,
} from "@molthub/database";
import {
  CreateChannelDto,
  UpdateChannelDto,
  ListChannelsQueryDto,
  TestChannelDto,
  BindChannelToBotDto,
  UpdateBindingDto,
  SendTestMessageDto,
} from "./channels.dto";

@Injectable()
export class ChannelsService {
  // ==========================================
  // Channel Type Definitions
  // ==========================================

  private readonly channelTypeConfigs: Record<
    ChannelType,
    { label: string; requiredFields: string[]; optionalFields: string[]; testEndpoint?: string }
  > = {
    [ChannelType.SLACK]: {
      label: "Slack",
      requiredFields: ["token"],
      optionalFields: ["channelId", "channelName", "iconEmoji", "username"],
    },
    [ChannelType.TELEGRAM]: {
      label: "Telegram",
      requiredFields: ["botToken"],
      optionalFields: ["chatId", "parseMode"],
    },
    [ChannelType.DISCORD]: {
      label: "Discord",
      requiredFields: ["botToken"],
      optionalFields: ["guildId", "channelId", "webhookUrl"],
    },
    [ChannelType.EMAIL]: {
      label: "Email (SMTP)",
      requiredFields: ["smtpHost", "smtpPort", "username", "password", "fromAddress"],
      optionalFields: ["useTls", "useSsl"],
    },
    [ChannelType.WEBHOOK]: {
      label: "Webhook",
      requiredFields: ["url"],
      optionalFields: ["headers", "secret", "method", "timeoutMs"],
    },
    [ChannelType.SMS]: {
      label: "SMS",
      requiredFields: ["provider", "apiKey"],
      optionalFields: ["fromNumber", "apiSecret"],
    },
    [ChannelType.PUSHOVER]: {
      label: "Pushover",
      requiredFields: ["appToken", "userKey"],
      optionalFields: ["priority", "sound"],
    },
    [ChannelType.CUSTOM]: {
      label: "Custom",
      requiredFields: [],
      optionalFields: ["handlerUrl", "headers", "auth"],
    },
  };

  getChannelTypes(): { type: string; label: string; requiredFields: string[] }[] {
    return Object.entries(this.channelTypeConfigs).map(([type, config]) => ({
      type,
      label: config.label,
      requiredFields: config.requiredFields,
    }));
  }

  // ==========================================
  // CRUD Operations
  // ==========================================

  async create(dto: CreateChannelDto): Promise<CommunicationChannel> {
    // Validate required fields for channel type
    this.validateChannelConfig(dto.type, dto.config);

    // Check for duplicate name in workspace
    const existing = await prisma.communicationChannel.findFirst({
      where: {
        workspaceId: dto.workspaceId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new BadRequestException(`Channel with name '${dto.name}' already exists in this workspace`);
    }

    return prisma.communicationChannel.create({
      data: {
        name: dto.name,
        workspaceId: dto.workspaceId,
        type: dto.type,
        config: dto.config as any,
        defaults: (dto.defaults || {}) as any,
        isShared: dto.isShared ?? true,
        tags: (dto.tags || {}) as any,
        createdBy: dto.createdBy || "system",
        status: ChannelStatus.PENDING,
      },
    });
  }

  async findAll(query: ListChannelsQueryDto): Promise<CommunicationChannel[]> {
    return prisma.communicationChannel.findMany({
      where: {
        workspaceId: query.workspaceId,
        ...(query.type && { type: query.type }),
        ...(query.status && { status: query.status }),
      },
      include: {
        _count: {
          select: { botBindings: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string): Promise<CommunicationChannel & { botBindings: any[] }> {
    const channel = await prisma.communicationChannel.findUnique({
      where: { id },
      include: {
        botBindings: {
          include: {
            bot: {
              select: {
                id: true,
                name: true,
                status: true,
                fleet: {
                  select: { name: true, environment: true },
                },
              },
            },
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException(`Channel ${id} not found`);
    }

    return channel;
  }

  async update(id: string, dto: UpdateChannelDto): Promise<CommunicationChannel> {
    const channel = await this.findOne(id);

    // Validate config if provided
    if (dto.config) {
      this.validateChannelConfig(channel.type, dto.config);
    }

    return prisma.communicationChannel.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.config && { config: dto.config as any }),
        ...(dto.defaults && { defaults: dto.defaults as any }),
        ...(dto.isShared !== undefined && { isShared: dto.isShared }),
        ...(dto.status && { status: dto.status }),
        ...(dto.tags && { tags: dto.tags as any }),
      },
    });
  }

  async remove(id: string): Promise<void> {
    const channel = await this.findOne(id);

    // Check if channel has active bindings
    const bindingCount = await prisma.botChannelBinding.count({
      where: { channelId: id },
    });

    if (bindingCount > 0) {
      throw new BadRequestException(
        `Cannot delete channel with ${bindingCount} active bot bindings. Unbind all bots first.`
      );
    }

    await prisma.communicationChannel.delete({ where: { id } });
  }

  // ==========================================
  // Bot Channel Bindings
  // ==========================================

  async bindToBot(channelId: string, dto: BindChannelToBotDto): Promise<BotChannelBinding> {
    // Verify channel exists
    const channel = await prisma.communicationChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new NotFoundException(`Channel ${channelId} not found`);
    }

    // Verify bot exists
    const bot = await prisma.botInstance.findUnique({
      where: { id: dto.botId },
    });

    if (!bot) {
      throw new NotFoundException(`Bot ${dto.botId} not found`);
    }

    // Check for existing binding with same purpose
    const existing = await prisma.botChannelBinding.findFirst({
      where: {
        botId: dto.botId,
        channelId,
        purpose: dto.purpose,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Bot already has a '${dto.purpose}' binding to this channel. Use a different purpose or update the existing binding.`
      );
    }

    return prisma.botChannelBinding.create({
      data: {
        botId: dto.botId,
        channelId,
        purpose: dto.purpose,
        settings: (dto.settings || {}) as any,
        targetDestination: dto.targetDestination as any,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async unbindFromBot(bindingId: string): Promise<void> {
    await prisma.botChannelBinding.delete({
      where: { id: bindingId },
    });
  }

  async updateBinding(bindingId: string, dto: UpdateBindingDto): Promise<BotChannelBinding> {
    return prisma.botChannelBinding.update({
      where: { id: bindingId },
      data: {
        ...(dto.purpose && { purpose: dto.purpose }),
        ...(dto.settings && { settings: dto.settings as any }),
        ...(dto.targetDestination && { targetDestination: dto.targetDestination as any }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async getBoundBots(channelId: string): Promise<any[]> {
    const bindings = await prisma.botChannelBinding.findMany({
      where: { channelId },
      include: {
        bot: {
          select: {
            id: true,
            name: true,
            status: true,
            health: true,
            fleet: {
              select: { name: true, environment: true },
            },
          },
        },
      },
    });

    return bindings;
  }

  async getBotChannels(botId: string): Promise<any[]> {
    const bindings = await prisma.botChannelBinding.findMany({
      where: { botId },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            config: true,
          },
        },
      },
    });

    return bindings;
  }

  // ==========================================
  // Testing & Health
  // ==========================================

  async testConnection(id: string, dto: TestChannelDto): Promise<any> {
    const channel = await prisma.communicationChannel.findUnique({
      where: { id },
    });

    if (!channel) {
      throw new NotFoundException(`Channel ${id} not found`);
    }

    const config = dto.config || (channel.config as Record<string, any>);
    const validation = this.validateChannelConfig(channel.type, config, false);

    if (!validation.valid) {
      return {
        success: false,
        error: `Configuration validation failed: ${validation.errors.join(", ")}`,
      };
    }

    // Simulate connection test (in production, this would actually connect)
    const testResult = await this.simulateConnectionTest(channel.type, config);

    // Update channel status based on test result
    await prisma.communicationChannel.update({
      where: { id },
      data: {
        status: testResult.success ? ChannelStatus.ACTIVE : ChannelStatus.ERROR,
        statusMessage: testResult.success ? "Connection test successful" : testResult.error,
        lastTestedAt: new Date(),
        ...(testResult.success
          ? { errorCount: 0 }
          : { errorCount: { increment: 1 }, lastError: testResult.error }),
      },
    });

    return testResult;
  }

  async sendTestMessage(id: string, dto: SendTestMessageDto): Promise<any> {
    const channel = await prisma.communicationChannel.findUnique({
      where: { id },
    });

    if (!channel) {
      throw new NotFoundException(`Channel ${id} not found`);
    }

    // Simulate sending test message
    const result = await this.simulateSendMessage(
      channel.type,
      channel.config as Record<string, any>,
      dto.message,
      dto.targetDestination
    );

    // Update metrics
    await prisma.communicationChannel.update({
      where: { id },
      data: {
        messagesSent: result.success ? { increment: 1 } : undefined,
        messagesFailed: result.success ? undefined : { increment: 1 },
        lastMessageAt: result.success ? new Date() : undefined,
        lastActivityAt: new Date(),
      },
    });

    return result;
  }

  async checkBotChannelsHealth(botId: string): Promise<any> {
    const bindings = await prisma.botChannelBinding.findMany({
      where: { botId, isActive: true },
      include: { channel: true },
    });

    const results = await Promise.all(
      bindings.map(async (binding) => {
        const healthCheck = await this.simulateConnectionTest(
          binding.channel.type,
          binding.channel.config as Record<string, any>
        );

        await prisma.botChannelBinding.update({
          where: { id: binding.id },
          data: {
            healthStatus: healthCheck.success ? "HEALTHY" : "UNHEALTHY",
            lastHealthCheck: new Date(),
          },
        });

        return {
          bindingId: binding.id,
          channelId: binding.channelId,
          channelName: binding.channel.name,
          type: binding.channel.type,
          purpose: binding.purpose,
          healthy: healthCheck.success,
          error: healthCheck.error,
        };
      })
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

  async getChannelStats(id: string): Promise<any> {
    const channel = await prisma.communicationChannel.findUnique({
      where: { id },
      include: {
        _count: { select: { botBindings: true } },
      },
    });

    if (!channel) {
      throw new NotFoundException(`Channel ${id} not found`);
    }

    // Get recent bindings activity
    const recentBindings = await prisma.botChannelBinding.findMany({
      where: { channelId: id },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: {
        bot: { select: { id: true, name: true, status: true } },
      },
    });

    return {
      channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        status: channel.status,
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
        total: channel._count.botBindings,
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

  private validateChannelConfig(
    type: ChannelType,
    config: Record<string, any>,
    throwOnError = true
  ): { valid: boolean; errors: string[] } {
    const typeConfig = this.channelTypeConfigs[type];
    const errors: string[] = [];

    if (!typeConfig) {
      errors.push(`Unknown channel type: ${type}`);
      if (throwOnError) throw new BadRequestException(errors[0]);
      return { valid: false, errors };
    }

    for (const field of typeConfig.requiredFields) {
      if (!config[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    if (throwOnError && errors.length > 0) {
      throw new BadRequestException(`Configuration validation failed: ${errors.join(", ")}`);
    }

    return { valid: errors.length === 0, errors };
  }

  private async simulateConnectionTest(
    type: ChannelType,
    config: Record<string, any>
  ): Promise<{ success: boolean; error?: string; latencyMs?: number }> {
    // In production, this would actually test the connection
    // For now, we simulate success/failure based on config validity
    const requiredFields = this.channelTypeConfigs[type]?.requiredFields || [];
    const hasAllFields = requiredFields.every((field) => config[field]);

    if (!hasAllFields) {
      return {
        success: false,
        error: `Missing required configuration fields: ${requiredFields.filter((f) => !config[f]).join(", ")}`,
      };
    }

    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

    return {
      success: true,
      latencyMs: Math.floor(Math.random() * 100),
    };
  }

  private async simulateSendMessage(
    type: ChannelType,
    config: Record<string, any>,
    message: string,
    targetDestination?: Record<string, any>
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    // In production, this would actually send the message
    // Simulate success
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

    return {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }
}
