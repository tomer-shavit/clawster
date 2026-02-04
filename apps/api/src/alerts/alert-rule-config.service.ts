import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import {
  PrismaClient,
  PRISMA_CLIENT,
} from "@clawster/database";
import {
  ALERT_RULE_DEFINITIONS,
  getAlertRuleDefinition,
} from "./alert-rule-defaults";
import type { UpdateAlertRuleConfigDto } from "./alert-rule-config.dto";

export interface EffectiveRuleConfig {
  enabled: boolean;
  severity: string;
  thresholds: Record<string, number> | null;
}

export interface AlertRuleConfigWithMeta {
  rule: string;
  enabled: boolean;
  severity: string;
  thresholds: Record<string, number> | null;
  displayName: string;
  description: string;
  category: string;
  defaultSeverity: string;
  defaultThresholds: Record<string, number> | null;
  thresholdSchema: Record<string, { label: string; type: string; unit: string; min?: number; max?: number }>;
  remediationAction: string;
}

@Injectable()
export class AlertRuleConfigService {
  private readonly logger = new Logger(AlertRuleConfigService.name);

  // In-memory cache for the cron evaluator
  private configCache: Map<string, EffectiveRuleConfig> | null = null;
  private configCacheExpiry = 0;
  private static readonly CACHE_TTL_MS = 60_000;

  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  /**
   * Get all 8 alert rule configs with metadata for the UI.
   * Lazily seeds defaults if none exist.
   */
  async getAlertRuleConfigs(workspaceId: string): Promise<AlertRuleConfigWithMeta[]> {
    await this.ensureSeeded(workspaceId);

    const rows = await this.prisma.alertRuleConfig.findMany({
      where: { workspaceId },
      orderBy: { rule: "asc" },
    });

    return ALERT_RULE_DEFINITIONS.map((def) => {
      const row = rows.find((r) => r.rule === def.rule);
      const thresholds = row?.thresholds ? this.parseThresholds(row.thresholds) : def.defaultThresholds;

      return {
        rule: def.rule,
        enabled: row?.enabled ?? def.defaultEnabled,
        severity: row?.severity ?? def.defaultSeverity,
        thresholds,
        displayName: def.displayName,
        description: def.description,
        category: def.category,
        defaultSeverity: def.defaultSeverity,
        defaultThresholds: def.defaultThresholds,
        thresholdSchema: def.thresholdSchema,
        remediationAction: def.remediationAction,
      };
    });
  }

  /**
   * Update a single rule's config.
   */
  async updateAlertRuleConfig(
    workspaceId: string,
    rule: string,
    dto: UpdateAlertRuleConfigDto,
  ): Promise<AlertRuleConfigWithMeta> {
    const def = getAlertRuleDefinition(rule);
    if (!def) {
      throw new BadRequestException(`Unknown alert rule: ${rule}`);
    }

    // Validate thresholds if provided
    if (dto.thresholds !== undefined) {
      this.validateThresholds(rule, dto.thresholds);
    }

    await this.ensureSeeded(workspaceId);

    const data: Record<string, unknown> = {};
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.severity !== undefined) data.severity = dto.severity;
    if (dto.thresholds !== undefined) data.thresholds = dto.thresholds;

    await this.prisma.alertRuleConfig.update({
      where: { workspaceId_rule: { workspaceId, rule } },
      data,
    });

    // Invalidate cache
    this.invalidateCache();

    // Return the updated config with metadata
    const configs = await this.getAlertRuleConfigs(workspaceId);
    return configs.find((c) => c.rule === rule)!;
  }

  /**
   * Reset a single rule to defaults.
   */
  async resetAlertRuleConfig(
    workspaceId: string,
    rule: string,
  ): Promise<AlertRuleConfigWithMeta> {
    const def = getAlertRuleDefinition(rule);
    if (!def) {
      throw new BadRequestException(`Unknown alert rule: ${rule}`);
    }

    await this.ensureSeeded(workspaceId);

    await this.prisma.alertRuleConfig.update({
      where: { workspaceId_rule: { workspaceId, rule } },
      data: {
        enabled: def.defaultEnabled,
        severity: def.defaultSeverity,
        thresholds: def.defaultThresholds ? JSON.stringify(def.defaultThresholds) : null,
      },
    });

    this.invalidateCache();

    const configs = await this.getAlertRuleConfigs(workspaceId);
    return configs.find((c) => c.rule === rule)!;
  }

  /**
   * Get effective config map for the alerting cron evaluator.
   * Cached in-memory with 60s TTL.
   */
  async getEffectiveConfig(workspaceId: string): Promise<Map<string, EffectiveRuleConfig>> {
    if (this.configCache && Date.now() < this.configCacheExpiry) {
      return this.configCache;
    }

    const configs = await this.getAlertRuleConfigs(workspaceId);
    const map = new Map<string, EffectiveRuleConfig>();

    for (const config of configs) {
      map.set(config.rule, {
        enabled: config.enabled,
        severity: config.severity,
        thresholds: config.thresholds,
      });
    }

    this.configCache = map;
    this.configCacheExpiry = Date.now() + AlertRuleConfigService.CACHE_TTL_MS;
    return map;
  }

  /** Invalidate the in-memory cache (called on config updates). */
  invalidateCache(): void {
    this.configCache = null;
    this.configCacheExpiry = 0;
  }

  // ---- Internal helpers -------------------------------------------------------

  /**
   * Seed all 8 default rule configs for a workspace if none exist.
   */
  private async ensureSeeded(workspaceId: string): Promise<void> {
    const count = await this.prisma.alertRuleConfig.count({
      where: { workspaceId },
    });

    if (count >= ALERT_RULE_DEFINITIONS.length) return;

    // Insert defaults that are missing
    const existing = await this.prisma.alertRuleConfig.findMany({
      where: { workspaceId },
      select: { rule: true },
    });
    const existingRules = new Set(existing.map((e) => e.rule));

    const toCreate = ALERT_RULE_DEFINITIONS
      .filter((def) => !existingRules.has(def.rule))
      .map((def) => ({
        workspaceId,
        rule: def.rule,
        enabled: def.defaultEnabled,
        severity: def.defaultSeverity,
        thresholds: def.defaultThresholds ? JSON.stringify(def.defaultThresholds) : null,
      }));

    if (toCreate.length > 0) {
      // Insert individually to handle potential race conditions with unique constraint
      for (const item of toCreate) {
        try {
          await this.prisma.alertRuleConfig.create({ data: item });
        } catch {
          // Ignore duplicate key errors from concurrent seeding
        }
      }
    }
  }

  private parseThresholds(raw: string): Record<string, number> | null {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private validateThresholds(rule: string, thresholdsJson: string): void {
    const def = getAlertRuleDefinition(rule);
    if (!def) return;

    // Rules with no configurable thresholds
    if (Object.keys(def.thresholdSchema).length === 0) {
      if (thresholdsJson && thresholdsJson !== "null") {
        throw new BadRequestException(
          `Rule "${rule}" does not have configurable thresholds`,
        );
      }
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(thresholdsJson);
    } catch {
      throw new BadRequestException("Invalid JSON in thresholds field");
    }

    for (const [key, schema] of Object.entries(def.thresholdSchema)) {
      const value = parsed[key];
      if (value === undefined) continue; // optional — use default

      if (typeof value !== "number" || isNaN(value)) {
        throw new BadRequestException(
          `Threshold "${key}" must be a number`,
        );
      }
      if (schema.min !== undefined && value < schema.min) {
        throw new BadRequestException(
          `Threshold "${key}" must be at least ${schema.min}`,
        );
      }
      if (schema.max !== undefined && value > schema.max) {
        throw new BadRequestException(
          `Threshold "${key}" must be at most ${schema.max}`,
        );
      }
    }
  }
}
