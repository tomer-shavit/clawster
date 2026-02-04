import {
  IntegrationConnector,
  BotConnectorBinding,
  Prisma,
} from "@prisma/client";
import { PaginationOptions, PaginatedResult, TransactionClient } from "./base";

// ============================================
// INTEGRATION CONNECTOR TYPES
// ============================================

export interface IntegrationConnectorFilters {
  workspaceId?: string;
  type?: string | string[];
  status?: string | string[];
  isShared?: boolean;
  search?: string;
}

export interface IntegrationConnectorWithRelations extends IntegrationConnector {
  _count?: {
    botBindings: number;
  };
}

// ============================================
// BOT CONNECTOR BINDING TYPES
// ============================================

export interface BotConnectorBindingFilters {
  botInstanceId?: string;
  connectorId?: string;
  purpose?: string;
  healthStatus?: string | string[];
}

export interface BotConnectorBindingWithRelations extends BotConnectorBinding {
  connector?: IntegrationConnector | null;
  botInstance?: {
    id: string;
    name: string;
  } | null;
}

export interface IConnectorRepository {
  // ============================================
  // INTEGRATION CONNECTOR METHODS
  // ============================================

  /**
   * Find a connector by ID
   */
  findConnectorById(
    id: string,
    tx?: TransactionClient
  ): Promise<IntegrationConnectorWithRelations | null>;

  /**
   * Find multiple connectors with optional filters and pagination
   */
  findManyConnectors(
    filters?: IntegrationConnectorFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<IntegrationConnector>>;

  /**
   * Find connectors by workspace
   */
  findConnectorsByWorkspace(
    workspaceId: string,
    filters?: Omit<IntegrationConnectorFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<IntegrationConnector[]>;

  /**
   * Count connectors matching filters
   */
  countConnectors(
    filters?: IntegrationConnectorFilters,
    tx?: TransactionClient
  ): Promise<number>;

  /**
   * Create a new connector
   */
  createConnector(
    data: Prisma.IntegrationConnectorCreateInput,
    tx?: TransactionClient
  ): Promise<IntegrationConnector>;

  /**
   * Update a connector
   */
  updateConnector(
    id: string,
    data: Prisma.IntegrationConnectorUpdateInput,
    tx?: TransactionClient
  ): Promise<IntegrationConnector>;

  /**
   * Delete a connector
   */
  deleteConnector(id: string, tx?: TransactionClient): Promise<void>;

  /**
   * Update connector status
   */
  updateConnectorStatus(
    id: string,
    status: string,
    statusMessage?: string | null,
    lastError?: string | null,
    tx?: TransactionClient
  ): Promise<IntegrationConnector>;

  /**
   * Record connector test result
   */
  recordTestResult(
    id: string,
    success: boolean,
    message?: string,
    tx?: TransactionClient
  ): Promise<IntegrationConnector>;

  /**
   * Increment usage count
   */
  incrementUsageCount(
    id: string,
    tx?: TransactionClient
  ): Promise<IntegrationConnector>;

  // ============================================
  // BOT CONNECTOR BINDING METHODS
  // ============================================

  /**
   * Find a binding by ID
   */
  findBindingById(
    id: string,
    tx?: TransactionClient
  ): Promise<BotConnectorBindingWithRelations | null>;

  /**
   * Find bindings for a bot instance
   */
  findBindingsByBotInstance(
    botInstanceId: string,
    filters?: Omit<BotConnectorBindingFilters, "botInstanceId">,
    tx?: TransactionClient
  ): Promise<BotConnectorBindingWithRelations[]>;

  /**
   * Find bindings for a connector
   */
  findBindingsByConnector(
    connectorId: string,
    filters?: Omit<BotConnectorBindingFilters, "connectorId">,
    tx?: TransactionClient
  ): Promise<BotConnectorBinding[]>;

  /**
   * Create a bot connector binding
   */
  createBinding(
    data: Prisma.BotConnectorBindingCreateInput,
    tx?: TransactionClient
  ): Promise<BotConnectorBinding>;

  /**
   * Update a bot connector binding
   */
  updateBinding(
    id: string,
    data: Prisma.BotConnectorBindingUpdateInput,
    tx?: TransactionClient
  ): Promise<BotConnectorBinding>;

  /**
   * Delete a bot connector binding
   */
  deleteBinding(id: string, tx?: TransactionClient): Promise<void>;

  /**
   * Update binding health status
   */
  updateBindingHealth(
    id: string,
    healthStatus: string,
    tx?: TransactionClient
  ): Promise<BotConnectorBinding>;
}
