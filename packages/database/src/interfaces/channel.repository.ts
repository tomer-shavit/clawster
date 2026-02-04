import {
  CommunicationChannel,
  BotChannelBinding,
  ChannelAuthSession,
  Prisma,
} from "@prisma/client";
import { PaginationOptions, PaginatedResult, TransactionClient } from "./base";

// ============================================
// COMMUNICATION CHANNEL TYPES
// ============================================

export interface CommunicationChannelFilters {
  workspaceId?: string;
  type?: string | string[];
  status?: string | string[];
  isShared?: boolean;
  search?: string;
}

export interface CommunicationChannelWithRelations extends CommunicationChannel {
  _count?: {
    botBindings: number;
  };
}

// ============================================
// BOT CHANNEL BINDING TYPES
// ============================================

export interface BotChannelBindingFilters {
  botId?: string;
  channelId?: string;
  purpose?: string;
  isActive?: boolean;
  healthStatus?: string | string[];
}

export interface BotChannelBindingWithRelations extends BotChannelBinding {
  channel?: CommunicationChannel | null;
  bot?: {
    id: string;
    name: string;
  } | null;
}

// ============================================
// CHANNEL AUTH SESSION TYPES
// ============================================

export interface ChannelAuthSessionFilters {
  instanceId?: string;
  channelType?: string | string[];
  state?: string | string[];
}

export interface IChannelRepository {
  // ============================================
  // COMMUNICATION CHANNEL METHODS
  // ============================================

  /**
   * Find a communication channel by ID
   */
  findChannelById(
    id: string,
    tx?: TransactionClient
  ): Promise<CommunicationChannelWithRelations | null>;

  /**
   * Find multiple channels with optional filters and pagination
   */
  findManyChannels(
    filters?: CommunicationChannelFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<CommunicationChannel>>;

  /**
   * Find channels by workspace
   */
  findChannelsByWorkspace(
    workspaceId: string,
    filters?: Omit<CommunicationChannelFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<CommunicationChannel[]>;

  /**
   * Create a new communication channel
   */
  createChannel(
    data: Prisma.CommunicationChannelCreateInput,
    tx?: TransactionClient
  ): Promise<CommunicationChannel>;

  /**
   * Update a communication channel
   */
  updateChannel(
    id: string,
    data: Prisma.CommunicationChannelUpdateInput,
    tx?: TransactionClient
  ): Promise<CommunicationChannel>;

  /**
   * Delete a communication channel
   */
  deleteChannel(id: string, tx?: TransactionClient): Promise<void>;

  /**
   * Update channel status
   */
  updateChannelStatus(
    id: string,
    status: string,
    statusMessage?: string | null,
    lastError?: string | null,
    tx?: TransactionClient
  ): Promise<CommunicationChannel>;

  /**
   * Record a successful message sent
   */
  recordMessageSent(id: string, tx?: TransactionClient): Promise<CommunicationChannel>;

  /**
   * Record a failed message
   */
  recordMessageFailed(id: string, tx?: TransactionClient): Promise<CommunicationChannel>;

  // ============================================
  // BOT CHANNEL BINDING METHODS
  // ============================================

  /**
   * Find a binding by ID
   */
  findBindingById(
    id: string,
    tx?: TransactionClient
  ): Promise<BotChannelBindingWithRelations | null>;

  /**
   * Find bindings for a bot
   */
  findBindingsByBot(
    botId: string,
    filters?: Omit<BotChannelBindingFilters, "botId">,
    tx?: TransactionClient
  ): Promise<BotChannelBindingWithRelations[]>;

  /**
   * Find bindings for a channel
   */
  findBindingsByChannel(
    channelId: string,
    filters?: Omit<BotChannelBindingFilters, "channelId">,
    tx?: TransactionClient
  ): Promise<BotChannelBinding[]>;

  /**
   * Create a bot channel binding
   */
  createBinding(
    data: Prisma.BotChannelBindingCreateInput,
    tx?: TransactionClient
  ): Promise<BotChannelBinding>;

  /**
   * Update a bot channel binding
   */
  updateBinding(
    id: string,
    data: Prisma.BotChannelBindingUpdateInput,
    tx?: TransactionClient
  ): Promise<BotChannelBinding>;

  /**
   * Delete a bot channel binding
   */
  deleteBinding(id: string, tx?: TransactionClient): Promise<void>;

  /**
   * Update binding health status
   */
  updateBindingHealth(
    id: string,
    healthStatus: string,
    tx?: TransactionClient
  ): Promise<BotChannelBinding>;

  // ============================================
  // CHANNEL AUTH SESSION METHODS
  // ============================================

  /**
   * Find an auth session by ID
   */
  findAuthSessionById(
    id: string,
    tx?: TransactionClient
  ): Promise<ChannelAuthSession | null>;

  /**
   * Find auth sessions for an instance
   */
  findAuthSessionsByInstance(
    instanceId: string,
    filters?: Omit<ChannelAuthSessionFilters, "instanceId">,
    tx?: TransactionClient
  ): Promise<ChannelAuthSession[]>;

  /**
   * Find the latest auth session for an instance and channel type
   */
  findLatestAuthSession(
    instanceId: string,
    channelType: string,
    tx?: TransactionClient
  ): Promise<ChannelAuthSession | null>;

  /**
   * Create an auth session
   */
  createAuthSession(
    data: Prisma.ChannelAuthSessionCreateInput,
    tx?: TransactionClient
  ): Promise<ChannelAuthSession>;

  /**
   * Update an auth session
   */
  updateAuthSession(
    id: string,
    data: Prisma.ChannelAuthSessionUpdateInput,
    tx?: TransactionClient
  ): Promise<ChannelAuthSession>;

  /**
   * Delete an auth session
   */
  deleteAuthSession(id: string, tx?: TransactionClient): Promise<void>;

  /**
   * Mark auth session as paired
   */
  markAuthSessionPaired(id: string, tx?: TransactionClient): Promise<ChannelAuthSession>;

  /**
   * Mark auth session as expired
   */
  markAuthSessionExpired(id: string, tx?: TransactionClient): Promise<ChannelAuthSession>;

  /**
   * Mark auth session as error
   */
  markAuthSessionError(
    id: string,
    error: string,
    tx?: TransactionClient
  ): Promise<ChannelAuthSession>;

  /**
   * Upsert a communication channel (create or update by workspaceId+name)
   */
  upsertChannel(
    workspaceId: string,
    name: string,
    data: {
      type: string;
      config: string;
      status: string;
      createdBy?: string;
    },
    tx?: TransactionClient
  ): Promise<CommunicationChannel>;

  /**
   * Delete channels by workspace and name prefix
   */
  deleteChannelsByNamePrefix(
    workspaceId: string,
    namePrefix: string,
    tx?: TransactionClient
  ): Promise<number>;
}
