import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ALERT_REPOSITORY,
  IAlertRepository,
  AlertFilters,
} from "@clawster/database";
import type { AlertQueryDto, AlertSummaryResponse } from "./alerts.dto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpsertAlertData {
  rule: string;
  instanceId?: string;
  fleetId?: string;
  severity: string;
  title: string;
  message: string;
  detail?: string;
  remediationAction?: string;
  remediationNote?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @Inject(ALERT_REPOSITORY) private readonly alertRepo: IAlertRepository,
  ) {}

  // ---- Query methods -------------------------------------------------------

  /**
   * List alerts with optional filters and pagination.
   */
  async listAlerts(
    filters: AlertQueryDto,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;

    const alertFilters: AlertFilters = {};

    if (filters.instanceId) alertFilters.instanceId = filters.instanceId;
    if (filters.fleetId) alertFilters.fleetId = filters.fleetId;
    if (filters.severity) alertFilters.severity = filters.severity;
    if (filters.status) alertFilters.status = filters.status;
    if (filters.rule) alertFilters.rule = filters.rule;
    if (filters.from) alertFilters.fromDate = new Date(filters.from);
    if (filters.to) alertFilters.toDate = new Date(filters.to);

    const result = await this.alertRepo.findMany(
      alertFilters,
      { page, limit },
    );

    return {
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  /**
   * Get a single alert by ID with related instance/fleet data.
   */
  async getAlert(id: string) {
    return this.alertRepo.findById(id);
  }

  // ---- Status transition methods -------------------------------------------

  /**
   * Acknowledge an alert.
   */
  async acknowledgeAlert(id: string, acknowledgedBy?: string) {
    return this.alertRepo.acknowledge(id, acknowledgedBy ?? "system");
  }

  /**
   * Resolve an alert.
   */
  async resolveAlert(id: string) {
    return this.alertRepo.resolve(id);
  }

  /**
   * Suppress an alert.
   */
  async suppressAlert(id: string) {
    return this.alertRepo.suppress(id);
  }

  /**
   * Bulk acknowledge multiple alerts. Only acts on ACTIVE alerts.
   */
  async bulkAcknowledge(ids: string[], acknowledgedBy?: string) {
    const count = await this.alertRepo.bulkAcknowledge(
      ids,
      acknowledgedBy ?? "system",
    );
    return { count };
  }

  /**
   * Bulk resolve multiple alerts. Only acts on ACTIVE or ACKNOWLEDGED alerts.
   */
  async bulkResolve(ids: string[]) {
    const count = await this.alertRepo.bulkResolve(ids);
    return { count };
  }

  // ---- Upsert (used by the evaluator / alerting service) -------------------

  /**
   * Create or update an alert by composite key (rule + instanceId).
   * If an alert with the same rule and instanceId already exists and is not
   * RESOLVED, update it (bump consecutiveHits, lastTriggeredAt, etc.).
   * If it was previously RESOLVED or SUPPRESSED, re-activate it.
   */
  async upsertAlert(data: UpsertAlertData) {
    return this.alertRepo.upsertByKey({
      rule: data.rule,
      instanceId: data.instanceId,
      fleetId: data.fleetId,
      severity: data.severity,
      title: data.title,
      message: data.message,
      detail: data.detail,
      remediationAction: data.remediationAction,
      remediationNote: data.remediationNote,
    });
  }

  /**
   * Resolve an alert matching rule + instanceId.
   * Used by the evaluator when a condition clears.
   */
  async resolveAlertByKey(rule: string, instanceId: string) {
    return this.alertRepo.resolveByKey(rule, instanceId);
  }

  // ---- Summary / counts ----------------------------------------------------

  /**
   * Get counts grouped by severity and status.
   */
  async getAlertSummary(): Promise<AlertSummaryResponse> {
    const summary = await this.alertRepo.getSummary();

    // Convert repository summary format to the API response format
    const bySeverity: Record<string, number> = {
      CRITICAL: summary.bySeverity.critical,
      ERROR: summary.bySeverity.error,
      WARNING: summary.bySeverity.warning,
      INFO: summary.bySeverity.info,
    };

    const byStatus: Record<string, number> = {
      ACTIVE: summary.byStatus.active,
      ACKNOWLEDGED: summary.byStatus.acknowledged,
      RESOLVED: summary.byStatus.resolved,
      SUPPRESSED: summary.byStatus.suppressed,
    };

    return { bySeverity, byStatus, total: summary.total };
  }

  /**
   * Return the count of alerts with status = ACTIVE.
   */
  async getActiveAlertCount(): Promise<number> {
    return this.alertRepo.getActiveCount();
  }
}
