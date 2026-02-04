import { Workspace, User, Prisma } from "@prisma/client";
import { PaginationOptions, PaginatedResult, TransactionClient } from "./base";

// ============================================
// WORKSPACE TYPES
// ============================================

export interface WorkspaceFilters {
  search?: string;
}

export interface WorkspaceWithRelations extends Workspace {
  _count?: {
    users: number;
    botInstances: number;
    fleets: number;
  };
}

export interface WorkspaceStats {
  userCount: number;
  botInstanceCount: number;
  fleetCount: number;
  templateCount: number;
  profileCount: number;
}

// ============================================
// USER TYPES
// ============================================

export interface UserFilters {
  workspaceId?: string;
  role?: string | string[];
  search?: string;
}

export interface UserWithRelations extends User {
  workspace?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface IWorkspaceRepository {
  // ============================================
  // WORKSPACE METHODS
  // ============================================

  /**
   * Find the first workspace matching filters (or any workspace if no filters)
   */
  findFirstWorkspace(
    filters?: WorkspaceFilters,
    tx?: TransactionClient
  ): Promise<Workspace | null>;

  /**
   * Find a workspace by ID
   */
  findWorkspaceById(
    id: string,
    tx?: TransactionClient
  ): Promise<WorkspaceWithRelations | null>;

  /**
   * Find a workspace by slug
   */
  findWorkspaceBySlug(
    slug: string,
    tx?: TransactionClient
  ): Promise<WorkspaceWithRelations | null>;

  /**
   * Find multiple workspaces with optional filters and pagination
   */
  findManyWorkspaces(
    filters?: WorkspaceFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<Workspace>>;

  /**
   * Count workspaces
   */
  countWorkspaces(filters?: WorkspaceFilters, tx?: TransactionClient): Promise<number>;

  /**
   * Create a workspace
   */
  createWorkspace(
    data: Prisma.WorkspaceCreateInput,
    tx?: TransactionClient
  ): Promise<Workspace>;

  /**
   * Update a workspace
   */
  updateWorkspace(
    id: string,
    data: Prisma.WorkspaceUpdateInput,
    tx?: TransactionClient
  ): Promise<Workspace>;

  /**
   * Delete a workspace
   */
  deleteWorkspace(id: string, tx?: TransactionClient): Promise<void>;

  /**
   * Get workspace stats
   */
  getWorkspaceStats(
    id: string,
    tx?: TransactionClient
  ): Promise<WorkspaceStats | null>;

  // ============================================
  // USER METHODS
  // ============================================

  /**
   * Find a user by ID
   */
  findUserById(
    id: string,
    tx?: TransactionClient
  ): Promise<UserWithRelations | null>;

  /**
   * Find a user by email within a workspace
   */
  findUserByEmail(
    email: string,
    workspaceId: string,
    tx?: TransactionClient
  ): Promise<User | null>;

  /**
   * Find multiple users with optional filters and pagination
   */
  findManyUsers(
    filters?: UserFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<User>>;

  /**
   * Find users by workspace
   */
  findUsersByWorkspace(
    workspaceId: string,
    filters?: Omit<UserFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<User[]>;

  /**
   * Count users matching filters
   */
  countUsers(filters?: UserFilters, tx?: TransactionClient): Promise<number>;

  /**
   * Create a user
   */
  createUser(data: Prisma.UserCreateInput, tx?: TransactionClient): Promise<User>;

  /**
   * Update a user
   */
  updateUser(
    id: string,
    data: Prisma.UserUpdateInput,
    tx?: TransactionClient
  ): Promise<User>;

  /**
   * Delete a user
   */
  deleteUser(id: string, tx?: TransactionClient): Promise<void>;

  /**
   * Update user role
   */
  updateUserRole(
    id: string,
    role: string,
    tx?: TransactionClient
  ): Promise<User>;
}
