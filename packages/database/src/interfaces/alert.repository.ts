import { HealthAlert, Prisma } from "@prisma/client";
import { PaginationOptions, PaginatedResult, TransactionClient } from "./base";

export interface AlertFilters {
  instanceId?: string;
  fleetId?: string;
  workspaceId?: string;
  rule?: string | string[];
  severity?: string | string[];
  status?: string | string[];
  fromDate?: Date;
  toDate?: Date;
}

export interface AlertSummary {
  total: number;
  byStatus: {
    active: number;
    acknowledged: number;
    resolved: number;
    suppressed: number;
  };
  bySeverity: {
    critical: number;
    error: number;
    warning: number;
    info: number;
  };
}

export interface AlertUpsertData {
  rule: string;
  severity: string;
  title: string;
  message: string;
  detail?: string | null;
  remediationAction?: string | null;
  remediationNote?: string | null;
  instanceId?: string | null;
  fleetId?: string | null;
}

export interface IAlertRepository {
  /**
   * Find an alert by ID
   */
  findById(id: string, tx?: TransactionClient): Promise<HealthAlert | null>;

  /**
   * Find multiple alerts with optional filters and pagination
   */
  findMany(
    filters?: AlertFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<HealthAlert>>;

  /**
   * Upsert an alert by composite key (rule + instanceId)
   * If an active alert with the same rule and instanceId exists, update it.
   * Otherwise, create a new alert.
   */
  upsertByKey(
    data: AlertUpsertData,
    tx?: TransactionClient
  ): Promise<HealthAlert>;

  /**
   * Acknowledge an alert
   */
  acknowledge(
    id: string,
    acknowledgedBy: string,
    tx?: TransactionClient
  ): Promise<HealthAlert>;

  /**
   * Resolve an alert
   */
  resolve(id: string, tx?: TransactionClient): Promise<HealthAlert>;

  /**
   * Suppress an alert (mark as suppressed to hide from active views)
   */
  suppress(id: string, tx?: TransactionClient): Promise<HealthAlert>;

  /**
   * Resolve an alert by its composite key (rule + instanceId)
   */
  resolveByKey(
    rule: string,
    instanceId: string,
    tx?: TransactionClient
  ): Promise<HealthAlert | null>;

  /**
   * Bulk acknowledge multiple alerts
   */
  bulkAcknowledge(
    ids: string[],
    acknowledgedBy: string,
    tx?: TransactionClient
  ): Promise<number>;

  /**
   * Bulk resolve multiple alerts
   */
  bulkResolve(ids: string[], tx?: TransactionClient): Promise<number>;

  /**
   * Get alert summary (counts by status and severity)
   */
  getSummary(filters?: AlertFilters, tx?: TransactionClient): Promise<AlertSummary>;

  /**
   * Get count of active alerts matching filters
   */
  getActiveCount(filters?: AlertFilters, tx?: TransactionClient): Promise<number>;
}
