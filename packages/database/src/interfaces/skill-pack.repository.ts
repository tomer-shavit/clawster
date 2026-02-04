import {
  SkillPack,
  BotInstanceSkillPack,
  Prisma,
} from "@prisma/client";
import { PaginationOptions, PaginatedResult, TransactionClient } from "./base";

// ============================================
// SKILL PACK TYPES
// ============================================

export interface SkillPackFilters {
  workspaceId?: string;
  isBuiltin?: boolean;
  search?: string;
}

export interface SkillPackWithRelations extends SkillPack {
  _count?: {
    botInstances: number;
  };
}

// ============================================
// BOT INSTANCE SKILL PACK TYPES
// ============================================

export interface BotInstanceSkillPackFilters {
  botInstanceId?: string;
  skillPackId?: string;
}

export interface BotInstanceSkillPackWithRelations extends BotInstanceSkillPack {
  skillPack?: SkillPack | null;
  botInstance?: {
    id: string;
    name: string;
  } | null;
}

export interface ISkillPackRepository {
  // ============================================
  // SKILL PACK METHODS
  // ============================================

  /**
   * Find a skill pack by ID
   */
  findSkillPackById(
    id: string,
    tx?: TransactionClient
  ): Promise<SkillPackWithRelations | null>;

  /**
   * Find skill pack by name within a workspace
   */
  findSkillPackByName(
    workspaceId: string,
    name: string,
    tx?: TransactionClient
  ): Promise<SkillPack | null>;

  /**
   * Find multiple skill packs with optional filters and pagination
   */
  findManySkillPacks(
    filters?: SkillPackFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<SkillPack>>;

  /**
   * Find skill packs by workspace
   */
  findSkillPacksByWorkspace(
    workspaceId: string,
    filters?: Omit<SkillPackFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<SkillPack[]>;

  /**
   * Find all built-in skill packs
   */
  findBuiltinSkillPacks(tx?: TransactionClient): Promise<SkillPack[]>;

  /**
   * Count skill packs matching filters
   */
  countSkillPacks(
    filters?: SkillPackFilters,
    tx?: TransactionClient
  ): Promise<number>;

  /**
   * Create a skill pack
   */
  createSkillPack(
    data: Prisma.SkillPackCreateInput,
    tx?: TransactionClient
  ): Promise<SkillPack>;

  /**
   * Update a skill pack
   */
  updateSkillPack(
    id: string,
    data: Prisma.SkillPackUpdateInput,
    tx?: TransactionClient
  ): Promise<SkillPack>;

  /**
   * Delete a skill pack
   */
  deleteSkillPack(id: string, tx?: TransactionClient): Promise<void>;

  /**
   * Increment skill pack version
   */
  incrementVersion(id: string, tx?: TransactionClient): Promise<SkillPack>;

  // ============================================
  // BOT INSTANCE SKILL PACK METHODS
  // ============================================

  /**
   * Find a bot-skill pack association by ID
   */
  findAssociationById(
    id: string,
    tx?: TransactionClient
  ): Promise<BotInstanceSkillPackWithRelations | null>;

  /**
   * Find skill packs attached to a bot instance
   */
  findSkillPacksByBotInstance(
    botInstanceId: string,
    tx?: TransactionClient
  ): Promise<BotInstanceSkillPackWithRelations[]>;

  /**
   * Find bot instances using a skill pack
   */
  findBotInstancesBySkillPack(
    skillPackId: string,
    tx?: TransactionClient
  ): Promise<BotInstanceSkillPack[]>;

  /**
   * Attach a skill pack to a bot instance
   */
  attachSkillPack(
    botInstanceId: string,
    skillPackId: string,
    envOverrides?: string,
    tx?: TransactionClient
  ): Promise<BotInstanceSkillPack>;

  /**
   * Detach a skill pack from a bot instance
   */
  detachSkillPack(
    botInstanceId: string,
    skillPackId: string,
    tx?: TransactionClient
  ): Promise<void>;

  /**
   * Update environment overrides for a bot's skill pack
   */
  updateEnvOverrides(
    botInstanceId: string,
    skillPackId: string,
    envOverrides: string,
    tx?: TransactionClient
  ): Promise<BotInstanceSkillPack>;

  /**
   * Check if a skill pack is attached to a bot instance
   */
  isAttached(
    botInstanceId: string,
    skillPackId: string,
    tx?: TransactionClient
  ): Promise<boolean>;
}
