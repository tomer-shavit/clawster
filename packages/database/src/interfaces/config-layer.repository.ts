import {
  Template,
  Profile,
  Overlay,
  PolicyPack,
  Prisma,
} from "@prisma/client";
import { PaginationOptions, PaginatedResult, TransactionClient } from "./base";

// ============================================
// TEMPLATE TYPES
// ============================================

export interface TemplateFilters {
  workspaceId?: string;
  category?: string | string[];
  isBuiltin?: boolean;
  search?: string;
}

// ============================================
// PROFILE TYPES
// ============================================

export interface ProfileFilters {
  workspaceId?: string;
  isActive?: boolean;
  search?: string;
}

export interface ProfileWithRelations extends Profile {
  _count?: {
    fleets: number;
  };
}

// ============================================
// OVERLAY TYPES
// ============================================

export interface OverlayFilters {
  workspaceId?: string;
  targetType?: string | string[];
  enabled?: boolean;
  search?: string;
}

// ============================================
// POLICY PACK TYPES
// ============================================

export interface PolicyPackFilters {
  workspaceId?: string;
  isBuiltin?: boolean;
  isActive?: boolean;
  isEnforced?: boolean;
  autoApply?: boolean;
  search?: string;
}

export interface IConfigLayerRepository {
  // ============================================
  // TEMPLATE METHODS
  // ============================================

  /**
   * Find a template by ID
   */
  findTemplateById(id: string, tx?: TransactionClient): Promise<Template | null>;

  /**
   * Find multiple templates with optional filters and pagination
   */
  findManyTemplates(
    filters?: TemplateFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<Template>>;

  /**
   * Find templates by workspace (includes builtins)
   */
  findTemplatesByWorkspace(
    workspaceId: string,
    filters?: Omit<TemplateFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<Template[]>;

  /**
   * Find all built-in templates
   */
  findBuiltinTemplates(tx?: TransactionClient): Promise<Template[]>;

  /**
   * Create a template
   */
  createTemplate(
    data: Prisma.TemplateCreateInput,
    tx?: TransactionClient
  ): Promise<Template>;

  /**
   * Update a template
   */
  updateTemplate(
    id: string,
    data: Prisma.TemplateUpdateInput,
    tx?: TransactionClient
  ): Promise<Template>;

  /**
   * Delete a template
   */
  deleteTemplate(id: string, tx?: TransactionClient): Promise<void>;

  // ============================================
  // PROFILE METHODS
  // ============================================

  /**
   * Find a profile by ID
   */
  findProfileById(
    id: string,
    tx?: TransactionClient
  ): Promise<ProfileWithRelations | null>;

  /**
   * Find multiple profiles with optional filters and pagination
   */
  findManyProfiles(
    filters?: ProfileFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<Profile>>;

  /**
   * Find profiles by workspace
   */
  findProfilesByWorkspace(
    workspaceId: string,
    filters?: Omit<ProfileFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<Profile[]>;

  /**
   * Find active profiles for a workspace, ordered by priority
   */
  findActiveProfilesByPriority(
    workspaceId: string,
    tx?: TransactionClient
  ): Promise<Profile[]>;

  /**
   * Create a profile
   */
  createProfile(
    data: Prisma.ProfileCreateInput,
    tx?: TransactionClient
  ): Promise<Profile>;

  /**
   * Update a profile
   */
  updateProfile(
    id: string,
    data: Prisma.ProfileUpdateInput,
    tx?: TransactionClient
  ): Promise<Profile>;

  /**
   * Delete a profile
   */
  deleteProfile(id: string, tx?: TransactionClient): Promise<void>;

  // ============================================
  // OVERLAY METHODS
  // ============================================

  /**
   * Find an overlay by ID
   */
  findOverlayById(id: string, tx?: TransactionClient): Promise<Overlay | null>;

  /**
   * Find multiple overlays with optional filters and pagination
   */
  findManyOverlays(
    filters?: OverlayFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<Overlay>>;

  /**
   * Find overlays by workspace
   */
  findOverlaysByWorkspace(
    workspaceId: string,
    filters?: Omit<OverlayFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<Overlay[]>;

  /**
   * Find applicable overlays for a target
   */
  findApplicableOverlays(
    workspaceId: string,
    targetType: string,
    targetSelector: string,
    tx?: TransactionClient
  ): Promise<Overlay[]>;

  /**
   * Create an overlay
   */
  createOverlay(
    data: Prisma.OverlayCreateInput,
    tx?: TransactionClient
  ): Promise<Overlay>;

  /**
   * Update an overlay
   */
  updateOverlay(
    id: string,
    data: Prisma.OverlayUpdateInput,
    tx?: TransactionClient
  ): Promise<Overlay>;

  /**
   * Delete an overlay
   */
  deleteOverlay(id: string, tx?: TransactionClient): Promise<void>;

  // ============================================
  // POLICY PACK METHODS
  // ============================================

  /**
   * Find a policy pack by ID
   */
  findPolicyPackById(id: string, tx?: TransactionClient): Promise<PolicyPack | null>;

  /**
   * Find multiple policy packs with optional filters and pagination
   */
  findManyPolicyPacks(
    filters?: PolicyPackFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<PolicyPack>>;

  /**
   * Find policy packs by workspace (includes builtins)
   */
  findPolicyPacksByWorkspace(
    workspaceId: string,
    filters?: Omit<PolicyPackFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<PolicyPack[]>;

  /**
   * Find all built-in policy packs
   */
  findBuiltinPolicyPacks(tx?: TransactionClient): Promise<PolicyPack[]>;

  /**
   * Find policy packs that auto-apply
   */
  findAutoApplyPolicyPacks(
    workspaceId?: string,
    tx?: TransactionClient
  ): Promise<PolicyPack[]>;

  /**
   * Create a policy pack
   */
  createPolicyPack(
    data: Prisma.PolicyPackCreateInput,
    tx?: TransactionClient
  ): Promise<PolicyPack>;

  /**
   * Update a policy pack
   */
  updatePolicyPack(
    id: string,
    data: Prisma.PolicyPackUpdateInput,
    tx?: TransactionClient
  ): Promise<PolicyPack>;

  /**
   * Delete a policy pack
   */
  deletePolicyPack(id: string, tx?: TransactionClient): Promise<void>;
}
