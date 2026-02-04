import { ChangeSet, Prisma } from "@prisma/client";
import { PaginationOptions, PaginatedResult, TransactionClient } from "./base";

export interface ChangeSetFilters {
  botInstanceId?: string;
  status?: string | string[];
  changeType?: string | string[];
  createdBy?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface ChangeSetWithRelations extends ChangeSet {
  botInstance?: {
    id: string;
    name: string;
    fleetId: string;
  } | null;
  _count?: {
    auditEvents: number;
  };
}

export interface ChangeSetStatusCount {
  status: string;
  _count: number;
}

export interface IChangeSetRepository {
  /**
   * Find a change set by ID
   */
  findById(
    id: string,
    tx?: TransactionClient
  ): Promise<ChangeSetWithRelations | null>;

  /**
   * Find multiple change sets with optional filters and pagination
   */
  findMany(
    filters?: ChangeSetFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<ChangeSet>>;

  /**
   * Find change sets for a specific bot instance
   */
  findByBotInstance(
    botInstanceId: string,
    filters?: Omit<ChangeSetFilters, "botInstanceId">,
    tx?: TransactionClient
  ): Promise<ChangeSet[]>;

  /**
   * Count change sets matching filters
   */
  count(filters?: ChangeSetFilters, tx?: TransactionClient): Promise<number>;

  /**
   * Create a new change set
   */
  create(
    data: Prisma.ChangeSetCreateInput,
    tx?: TransactionClient
  ): Promise<ChangeSet>;

  /**
   * Update a change set
   */
  update(
    id: string,
    data: Prisma.ChangeSetUpdateInput,
    tx?: TransactionClient
  ): Promise<ChangeSet>;

  /**
   * Delete a change set
   */
  delete(id: string, tx?: TransactionClient): Promise<void>;

  /**
   * Start a change set (set status to IN_PROGRESS)
   */
  start(id: string, tx?: TransactionClient): Promise<ChangeSet>;

  /**
   * Complete a change set
   */
  complete(id: string, tx?: TransactionClient): Promise<ChangeSet>;

  /**
   * Fail a change set
   */
  fail(id: string, tx?: TransactionClient): Promise<ChangeSet>;

  /**
   * Rollback a change set
   */
  rollback(
    id: string,
    rolledBackBy: string,
    tx?: TransactionClient
  ): Promise<ChangeSet>;

  /**
   * Update progress counters
   */
  updateProgress(
    id: string,
    updatedInstances: number,
    failedInstances: number,
    tx?: TransactionClient
  ): Promise<ChangeSet>;

  /**
   * Group change sets by status
   */
  groupByStatus(
    filters?: ChangeSetFilters,
    tx?: TransactionClient
  ): Promise<ChangeSetStatusCount[]>;
}
