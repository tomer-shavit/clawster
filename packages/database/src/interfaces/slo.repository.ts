import { SloDefinition, Prisma } from "@prisma/client";
import { PaginationOptions, PaginatedResult, TransactionClient } from "./base";

export interface SloFilters {
  instanceId?: string;
  metric?: string | string[];
  isBreached?: boolean;
  isActive?: boolean;
}

export interface SloWithRelations extends SloDefinition {
  instance?: {
    id: string;
    name: string;
    fleetId: string;
    status?: string;
    health?: string;
  } | null;
}

export interface SloBreachSummary {
  totalSlos: number;
  breachedSlos: number;
  breachRate: number;
}

export interface SloMetricGroupResult {
  metric: string;
  _count: number;
  breachedCount: number;
}

export interface ISloRepository {
  /**
   * Find an SLO definition by ID
   */
  findById(id: string, tx?: TransactionClient): Promise<SloWithRelations | null>;

  /**
   * Find multiple SLOs with optional filters and pagination
   */
  findMany(
    filters?: SloFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<SloDefinition>>;

  /**
   * Find multiple SLOs with instance relations included
   */
  findManyWithRelations(
    filters?: SloFilters,
    tx?: TransactionClient
  ): Promise<SloWithRelations[]>;

  /**
   * Find SLOs for a specific bot instance
   */
  findByInstance(
    instanceId: string,
    filters?: Omit<SloFilters, "instanceId">,
    tx?: TransactionClient
  ): Promise<SloDefinition[]>;

  /**
   * Find SLOs for a specific bot instance with relations
   */
  findByInstanceWithRelations(
    instanceId: string,
    filters?: Omit<SloFilters, "instanceId">,
    tx?: TransactionClient
  ): Promise<SloWithRelations[]>;

  /**
   * Find all breached SLOs
   */
  findBreached(tx?: TransactionClient): Promise<SloDefinition[]>;

  /**
   * Count SLOs matching filters
   */
  count(filters?: SloFilters, tx?: TransactionClient): Promise<number>;

  /**
   * Create a new SLO definition
   */
  create(
    data: Prisma.SloDefinitionCreateInput,
    tx?: TransactionClient
  ): Promise<SloDefinition>;

  /**
   * Update an SLO definition
   */
  update(
    id: string,
    data: Prisma.SloDefinitionUpdateInput,
    tx?: TransactionClient
  ): Promise<SloDefinition>;

  /**
   * Delete an SLO definition
   */
  delete(id: string, tx?: TransactionClient): Promise<void>;

  /**
   * Update the current value and breach status of an SLO
   */
  updateEvaluation(
    id: string,
    currentValue: number,
    isBreached: boolean,
    tx?: TransactionClient
  ): Promise<SloDefinition>;

  /**
   * Mark an SLO as breached
   */
  markBreached(id: string, tx?: TransactionClient): Promise<SloDefinition>;

  /**
   * Clear breach status for an SLO
   */
  clearBreach(id: string, tx?: TransactionClient): Promise<SloDefinition>;

  /**
   * Get breach summary for an instance
   */
  getBreachSummary(
    instanceId: string,
    tx?: TransactionClient
  ): Promise<SloBreachSummary>;

  /**
   * Group SLOs by metric with breach counts
   */
  groupByMetric(
    filters?: SloFilters,
    tx?: TransactionClient
  ): Promise<SloMetricGroupResult[]>;
}
