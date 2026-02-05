import { Injectable, Inject, Logger } from "@nestjs/common";
import type { BotInstance } from "@clawster/database";
import {
  BOT_INSTANCE_REPOSITORY,
  type IBotInstanceRepository,
} from "@clawster/database";
import type { CronJobTemplate } from "@clawster/core";
import type { ICronInjector, CronJobInfo } from "./interfaces";
import {
  type IGatewayConnectionService,
  GATEWAY_CONNECTION_SERVICE,
} from "../../reconciler/interfaces/gateway-connection.interface";

// =============================================================================
// Cron Injector Service
// =============================================================================

/**
 * CronInjectorService — manages cron jobs on running bot instances.
 *
 * Single Responsibility: Create, list, and remove cron jobs via Gateway RPC.
 * Uses the existing GatewayConnectionService to obtain connected clients.
 */
@Injectable()
export class CronInjectorService implements ICronInjector {
  private readonly logger = new Logger(CronInjectorService.name);

  constructor(
    @Inject(BOT_INSTANCE_REPOSITORY)
    private readonly botInstanceRepo: IBotInstanceRepository,
    @Inject(GATEWAY_CONNECTION_SERVICE)
    private readonly gatewayConnectionService: IGatewayConnectionService,
  ) {}

  /**
   * Add a cron job to a bot instance.
   * Returns the created job ID.
   */
  async addJob(instanceId: string, job: CronJobTemplate): Promise<string> {
    const instance = await this.getInstance(instanceId);
    const client = await this.gatewayConnectionService.getGatewayClient(instance);

    const result = await client.cronAdd({
      name: job.name,
      schedule: job.schedule,
      payload: job.payload,
      description: job.description,
      enabled: job.enabled ?? true,
      deleteAfterRun: job.deleteAfterRun,
      sessionTarget: job.sessionTarget ?? "main",
      wakeMode: job.wakeMode ?? "next-heartbeat",
      delivery: job.delivery,
    });

    this.logger.log(
      `Cron job "${job.name}" added to instance ${instanceId}: ${result.job.id}`,
    );

    return result.job.id;
  }

  /**
   * Remove a cron job from a bot instance.
   */
  async removeJob(instanceId: string, jobId: string): Promise<void> {
    const instance = await this.getInstance(instanceId);
    const client = await this.gatewayConnectionService.getGatewayClient(instance);

    await client.cronRemove({ id: jobId });

    this.logger.log(`Cron job ${jobId} removed from instance ${instanceId}`);
  }

  /**
   * List all cron jobs for a bot instance.
   */
  async listJobs(instanceId: string): Promise<CronJobInfo[]> {
    const instance = await this.getInstance(instanceId);
    const client = await this.gatewayConnectionService.getGatewayClient(instance);

    const result = await client.cronList({ includeDisabled: true });

    return result.jobs.map((job) => ({
      id: job.id,
      name: job.name,
      enabled: job.enabled,
      schedule: this.formatSchedule(job.schedule),
      nextRunAt: job.state.nextRunAtMs
        ? new Date(job.state.nextRunAtMs)
        : undefined,
      lastRunAt: job.state.lastRunAtMs
        ? new Date(job.state.lastRunAtMs)
        : undefined,
      lastStatus: job.state.lastStatus,
    }));
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async getInstance(instanceId: string): Promise<BotInstance> {
    const instance = await this.botInstanceRepo.findById(instanceId);
    if (!instance) {
      throw new Error(`Bot instance ${instanceId} not found`);
    }
    return instance;
  }

  /**
   * Format a CronSchedule object into a human-readable string.
   */
  private formatSchedule(schedule: {
    kind: string;
    at?: string;
    everyMs?: number;
    expr?: string;
    tz?: string;
  }): string {
    switch (schedule.kind) {
      case "at":
        return `at ${schedule.at}`;
      case "every":
        return `every ${this.formatDuration(schedule.everyMs ?? 0)}`;
      case "cron":
        return schedule.tz
          ? `${schedule.expr} (${schedule.tz})`
          : schedule.expr ?? "";
      default:
        return "unknown";
    }
  }

  /**
   * Format milliseconds into a human-readable duration.
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
    if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h`;
    return `${Math.round(ms / 86_400_000)}d`;
  }
}
