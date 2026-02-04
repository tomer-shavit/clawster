import { BotInstance, GatewayConnection, Prisma, Fleet, DeploymentTarget, IntegrationConnector } from "@prisma/client";
import { PaginationOptions, PaginatedResult, TransactionClient } from "./base";

export interface BotInstanceFilters {
  workspaceId?: string;
  fleetId?: string;
  status?: string | string[];
  health?: string | string[];
  deploymentType?: string;
  templateId?: string;
  search?: string;
  tags?: Record<string, string>;
  gatewayPortNotNull?: boolean;
  hasGatewayConnection?: boolean;
}

export interface BotInstanceWithRelations extends BotInstance {
  gatewayConnection?: GatewayConnection | null;
  fleet?: { id: string; name: string; environment?: string } | null;
  deploymentTarget?: { id: string; name: string; type: string } | null;
  connectorBindings?: Array<{
    id: string;
    connector: {
      id: string;
      name: string;
      type: string;
      status: string;
    };
  }>;
  _count?: {
    connectorBindings: number;
  };
}

export interface StatusGroupResult {
  status: string;
  _count: number;
}

export interface HealthGroupResult {
  health: string;
  _count: number;
}

export interface GatewayConnectionUpsertData {
  host?: string;
  port?: number;
  authMode?: string;
  authToken?: string;
  status?: string;
  lastHeartbeat?: Date;
  configHash?: string;
  latencyMs?: number;
  protocolVersion?: number;
  clientMetadata?: string;
}

export interface IBotInstanceRepository {
  /**
   * Find a bot instance by ID
   */
  findById(
    id: string,
    tx?: TransactionClient
  ): Promise<BotInstanceWithRelations | null>;

  /**
   * Find the first bot instance matching filters
   */
  findFirst(
    filters: BotInstanceFilters,
    tx?: TransactionClient
  ): Promise<BotInstance | null>;

  /**
   * Find bot instances by multiple IDs
   */
  findByIds(
    ids: string[],
    tx?: TransactionClient
  ): Promise<BotInstanceWithRelations[]>;

  /**
   * Find multiple bot instances with optional filters
   */
  findMany(
    filters?: BotInstanceFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<BotInstance>>;

  /**
   * Find all bot instances in a workspace
   */
  findByWorkspace(
    workspaceId: string,
    filters?: Omit<BotInstanceFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<BotInstance[]>;

  /**
   * Find all bot instances in a fleet
   */
  findByFleet(
    fleetId: string,
    filters?: Omit<BotInstanceFilters, "fleetId">,
    tx?: TransactionClient
  ): Promise<BotInstance[]>;

  /**
   * Count bot instances matching filters
   */
  count(filters?: BotInstanceFilters, tx?: TransactionClient): Promise<number>;

  /**
   * Create a new bot instance
   */
  create(
    data: Prisma.BotInstanceCreateInput,
    tx?: TransactionClient
  ): Promise<BotInstance>;

  /**
   * Update a bot instance
   */
  update(
    id: string,
    data: Prisma.BotInstanceUpdateInput,
    tx?: TransactionClient
  ): Promise<BotInstance>;

  /**
   * Delete a bot instance
   */
  delete(id: string, tx?: TransactionClient): Promise<void>;

  /**
   * Update the status of a bot instance
   */
  updateStatus(
    id: string,
    status: string,
    lastError?: string | null,
    tx?: TransactionClient
  ): Promise<BotInstance>;

  /**
   * Update the health of a bot instance
   */
  updateHealth(
    id: string,
    health: string,
    lastHealthCheckAt?: Date,
    tx?: TransactionClient
  ): Promise<BotInstance>;

  /**
   * Increment the restart count for a bot instance
   */
  incrementRestartCount(
    id: string,
    tx?: TransactionClient
  ): Promise<BotInstance>;

  /**
   * Increment the error count for a bot instance
   */
  incrementErrorCount(id: string, tx?: TransactionClient): Promise<BotInstance>;

  /**
   * Group bot instances by status
   */
  groupByStatus(
    filters?: BotInstanceFilters,
    tx?: TransactionClient
  ): Promise<StatusGroupResult[]>;

  /**
   * Group bot instances by health
   */
  groupByHealth(
    filters?: BotInstanceFilters,
    tx?: TransactionClient
  ): Promise<HealthGroupResult[]>;

  /**
   * Get the gateway connection for a bot instance
   */
  getGatewayConnection(
    instanceId: string,
    tx?: TransactionClient
  ): Promise<GatewayConnection | null>;

  /**
   * Create or update a gateway connection for a bot instance
   */
  upsertGatewayConnection(
    instanceId: string,
    data: GatewayConnectionUpsertData,
    tx?: TransactionClient
  ): Promise<GatewayConnection>;

  /**
   * Find many instances with full relations for list view
   */
  findManyWithRelations(
    filters?: BotInstanceFilters,
    tx?: TransactionClient
  ): Promise<BotInstanceWithRelations[]>;

  /**
   * Find one instance with full relations including connector bindings
   */
  findOneWithRelations(
    id: string,
    tx?: TransactionClient
  ): Promise<BotInstanceWithRelations | null>;

  /**
   * Group instances by fleet ID with count
   */
  groupByFleet(
    filters?: BotInstanceFilters,
    tx?: TransactionClient
  ): Promise<Array<{ fleetId: string; _count: number }>>;

  /**
   * Count gateway connections by status
   */
  countGatewayConnections(
    statuses?: string[],
    tx?: TransactionClient
  ): Promise<number>;

  /**
   * Delete gateway connection for an instance
   */
  deleteGatewayConnection(
    instanceId: string,
    tx?: TransactionClient
  ): Promise<void>;

  /**
   * Delete multiple records related to a bot instance (for cleanup)
   */
  deleteRelatedRecords(
    instanceId: string,
    tx?: TransactionClient
  ): Promise<void>;
}
