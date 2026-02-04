import { Injectable, Logger, Inject } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  SloDefinition,
  SLO_REPOSITORY,
  ISloRepository,
  BOT_INSTANCE_REPOSITORY,
  IBotInstanceRepository,
  ALERT_REPOSITORY,
  IAlertRepository,
  PRISMA_CLIENT,
  PrismaClient,
} from "@clawster/database";

@Injectable()
export class SloEvaluatorService {
  private readonly logger = new Logger(SloEvaluatorService.name);

  constructor(
    @Inject(SLO_REPOSITORY)
    private readonly sloRepo: ISloRepository,
    @Inject(BOT_INSTANCE_REPOSITORY)
    private readonly botInstanceRepo: IBotInstanceRepository,
    @Inject(ALERT_REPOSITORY)
    private readonly alertRepo: IAlertRepository,
    @Inject(PRISMA_CLIENT)
    private readonly prisma: PrismaClient,
  ) {}

  @Cron("*/60 * * * * *")
  async evaluateAllSlos(): Promise<void> {
    try {
      const result = await this.sloRepo.findMany({ isActive: true });
      const activeSlos = result.data;

      this.logger.debug(`Evaluating ${activeSlos.length} active SLOs`);

      for (const slo of activeSlos) {
        try {
          await this.evaluateSlo(slo);
        } catch (error) {
          this.logger.error(
            `Failed to evaluate SLO ${slo.id} (${slo.name}): ${error}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`SLO evaluation cron failed: ${error}`);
    }
  }

  private async evaluateSlo(slo: SloDefinition): Promise<void> {
    const windowStart = this.getWindowStart(slo.window);
    const currentValue = await this.calculateMetricValue(
      slo.instanceId,
      slo.metric,
      windowStart,
    );

    if (currentValue === null) {
      // No data available, skip evaluation
      return;
    }

    const wasBreached = slo.isBreached;
    const isBreached = this.checkBreach(slo.metric, currentValue, slo.targetValue);

    // Use repository method for evaluation update
    await this.sloRepo.updateEvaluation(slo.id, currentValue, isBreached);

    // If recovered from breach, clear breachedAt using update
    if (!isBreached && wasBreached) {
      await this.sloRepo.clearBreach(slo.id);
    }

    // Create HealthAlert if SLO breached
    if (isBreached && !wasBreached) {
      await this.createBreachAlert(slo, currentValue);
    }

    // Resolve alert if SLO recovered
    if (!isBreached && wasBreached) {
      await this.resolveBreachAlert(slo);
    }
  }

  private checkBreach(
    metric: string,
    currentValue: number,
    targetValue: number,
  ): boolean {
    switch (metric) {
      // For UPTIME and CHANNEL_HEALTH, current should be >= target (higher is better)
      case "UPTIME":
      case "CHANNEL_HEALTH":
        return currentValue < targetValue;

      // For latency, current should be <= target (lower is better)
      case "LATENCY_P50":
      case "LATENCY_P95":
      case "LATENCY_P99":
        return currentValue > targetValue;

      // For error rate, current should be <= target (lower is better)
      case "ERROR_RATE":
        return currentValue > targetValue;

      default:
        return false;
    }
  }

  private async calculateMetricValue(
    instanceId: string,
    metric: string,
    windowStart: Date,
  ): Promise<number | null> {
    switch (metric) {
      case "UPTIME":
        return this.calculateUptime(instanceId, windowStart);
      case "LATENCY_P50":
        return this.calculateLatencyPercentile(instanceId, windowStart, 50);
      case "LATENCY_P95":
        return this.calculateLatencyPercentile(instanceId, windowStart, 95);
      case "LATENCY_P99":
        return this.calculateLatencyPercentile(instanceId, windowStart, 99);
      case "ERROR_RATE":
        return this.calculateErrorRate(instanceId, windowStart);
      case "CHANNEL_HEALTH":
        return this.calculateChannelHealth(instanceId, windowStart);
      default:
        return null;
    }
  }

  private async calculateUptime(
    instanceId: string,
    windowStart: Date,
  ): Promise<number | null> {
    // Note: HealthSnapshot queries use prisma directly as there's no repository for them yet
    const snapshots = await this.prisma.healthSnapshot.findMany({
      where: {
        instanceId,
        capturedAt: { gte: windowStart },
      },
      select: { isHealthy: true },
    });

    if (snapshots.length === 0) return null;

    const healthyCount = snapshots.filter((s) => s.isHealthy).length;
    return (healthyCount / snapshots.length) * 100;
  }

  private async calculateLatencyPercentile(
    instanceId: string,
    windowStart: Date,
    percentile: number,
  ): Promise<number | null> {
    const snapshots = await this.prisma.healthSnapshot.findMany({
      where: {
        instanceId,
        capturedAt: { gte: windowStart },
        gatewayLatencyMs: { not: null },
      },
      select: { gatewayLatencyMs: true },
      orderBy: { gatewayLatencyMs: "asc" },
    });

    if (snapshots.length === 0) return null;

    const values = snapshots
      .map((s) => s.gatewayLatencyMs!)
      .sort((a, b) => a - b);

    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  private async calculateErrorRate(
    instanceId: string,
    windowStart: Date,
  ): Promise<number | null> {
    const instance = await this.botInstanceRepo.findById(instanceId);

    if (!instance) return null;

    // Calculate error rate from health snapshots in the window
    const snapshots = await this.prisma.healthSnapshot.findMany({
      where: {
        instanceId,
        capturedAt: { gte: windowStart },
      },
      select: { isHealthy: true },
    });

    if (snapshots.length === 0) return null;

    const unhealthyCount = snapshots.filter((s) => !s.isHealthy).length;
    return (unhealthyCount / snapshots.length) * 100;
  }

  private async calculateChannelHealth(
    instanceId: string,
    windowStart: Date,
  ): Promise<number | null> {
    const snapshots = await this.prisma.healthSnapshot.findMany({
      where: {
        instanceId,
        capturedAt: { gte: windowStart },
      },
      select: { channelsLinked: true, channelsDegraded: true },
    });

    if (snapshots.length === 0) return null;

    // Average channel health across all snapshots
    let totalHealthPercent = 0;
    let validSnapshots = 0;

    for (const snapshot of snapshots) {
      const total = snapshot.channelsLinked;
      if (total > 0) {
        const healthy = total - snapshot.channelsDegraded;
        totalHealthPercent += (healthy / total) * 100;
        validSnapshots++;
      }
    }

    if (validSnapshots === 0) return null;

    return totalHealthPercent / validSnapshots;
  }

  private getWindowStart(window: string): Date {
    const now = new Date();

    switch (window) {
      case "ROLLING_1H":
        return new Date(now.getTime() - 60 * 60 * 1000);
      case "ROLLING_24H":
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case "ROLLING_7D":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "ROLLING_30D":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case "CALENDAR_DAY": {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return start;
      }
      case "CALENDAR_WEEK": {
        const start = new Date(now);
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        return start;
      }
      case "CALENDAR_MONTH": {
        const start = new Date(now);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        return start;
      }
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private async createBreachAlert(
    slo: SloDefinition,
    currentValue: number,
  ): Promise<void> {
    const margin = this.calculateBreachMargin(slo, currentValue);
    const severity = this.getSeverityFromMargin(margin);

    await this.alertRepo.upsertByKey({
      instanceId: slo.instanceId,
      rule: "slo_breach",
      severity,
      title: `SLO Breached: ${slo.name}`,
      message: `SLO "${slo.name}" (${slo.metric}) breached. Target: ${slo.targetValue}, Current: ${currentValue.toFixed(2)}.`,
      detail: JSON.stringify({
        sloId: slo.id,
        metric: slo.metric,
        targetValue: slo.targetValue,
        currentValue,
        window: slo.window,
      }),
      remediationAction: "run-doctor",
      remediationNote: `Investigate the ${slo.metric} metric for bot instance ${slo.instanceId}.`,
    });
  }

  private async resolveBreachAlert(slo: SloDefinition): Promise<void> {
    await this.alertRepo.resolveByKey("slo_breach", slo.instanceId);
  }

  private calculateBreachMargin(
    slo: SloDefinition,
    currentValue: number,
  ): number {
    const target = slo.targetValue;
    if (target === 0) return 100;

    return Math.abs((currentValue - target) / target) * 100;
  }

  private getSeverityFromMargin(marginPercent: number): string {
    if (marginPercent >= 20) return "CRITICAL";
    if (marginPercent >= 10) return "ERROR";
    if (marginPercent >= 5) return "WARNING";
    return "INFO";
  }
}
