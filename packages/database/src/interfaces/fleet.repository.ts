import { Fleet, BotInstance, Prisma, GatewayConnection, Profile } from "@prisma/client";
import { PaginationOptions, PaginatedResult, TransactionClient } from "./base";

export interface FleetFilters {
  workspaceId?: string;
  status?: string | string[];
  environment?: string;
  search?: string;
  name?: string;
}

export interface FleetWithInstanceCounts extends Fleet {
  _count?: {
    instances: number;
  };
  instances?: Array<{
    id: string;
    status: string;
    deploymentType: string | null;
  }>;
}

export interface FleetInstanceSummary {
  id: string;
  name: string;
  status: string;
  health: string;
  deploymentType: string | null;
  gatewayPort: number | null;
  runningSince: Date | null;
  lastHealthCheckAt: Date | null;
  createdAt: Date;
  gatewayConnection?: {
    host: string;
    port: number;
    status: string;
  } | null;
}

export interface FleetWithFullRelations extends Fleet {
  instances: FleetInstanceSummary[];
  profiles: Profile[];
  _count?: {
    instances: number;
  };
}

export interface FleetHealthSummary {
  fleetId: string;
  fleetName: string;
  totalInstances: number;
  healthyCounts: {
    healthy: number;
    unhealthy: number;
    degraded: number;
    unknown: number;
  };
  statusCounts: {
    running: number;
    stopped: number;
    error: number;
    creating: number;
    pending: number;
    other: number;
  };
}

export interface IFleetRepository {
  /**
   * Find a fleet by ID
   */
  findById(
    id: string,
    tx?: TransactionClient
  ): Promise<FleetWithInstanceCounts | null>;

  /**
   * Find multiple fleets with optional filters and pagination
   */
  findMany(
    filters?: FleetFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<FleetWithInstanceCounts>>;

  /**
   * Find the first fleet matching the filters
   */
  findFirst(
    filters: FleetFilters,
    tx?: TransactionClient
  ): Promise<Fleet | null>;

  /**
   * Create a new fleet
   */
  create(data: Prisma.FleetCreateInput, tx?: TransactionClient): Promise<Fleet>;

  /**
   * Update a fleet
   */
  update(
    id: string,
    data: Prisma.FleetUpdateInput,
    tx?: TransactionClient
  ): Promise<Fleet>;

  /**
   * Delete a fleet
   */
  delete(id: string, tx?: TransactionClient): Promise<void>;

  /**
   * Count fleets matching filters
   */
  count(filters?: FleetFilters, tx?: TransactionClient): Promise<number>;

  /**
   * Get health summary for a fleet including instance health/status breakdowns
   */
  getHealthSummary(
    fleetId: string,
    tx?: TransactionClient
  ): Promise<FleetHealthSummary | null>;

  /**
   * Find a fleet by ID with full instance details (for fleet detail page)
   */
  findByIdWithInstances(
    id: string,
    tx?: TransactionClient
  ): Promise<FleetWithFullRelations | null>;

  /**
   * Find fleets with instance summary (for fleet list page)
   */
  findManyWithInstances(
    filters?: FleetFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<FleetWithInstanceCounts[]>;
}
