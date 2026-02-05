import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import type { BotInstance } from "@clawster/database";
import {
  BOT_INSTANCE_REPOSITORY,
  type IBotInstanceRepository,
  PRISMA_CLIENT,
} from "@clawster/database";
import type { PrismaClient } from "@clawster/database";
import type {
  PersonaTemplate,
  CronJobTemplate,
  IdentityConfig,
  RequiredSecret,
} from "@clawster/core";
import {
  type IConfigInjector,
  type ICronInjector,
  type ISecretResolver,
  CONFIG_INJECTOR,
  CRON_INJECTOR,
  SECRET_RESOLVER,
} from "./interfaces";
import { BUILTIN_PERSONA_TEMPLATES, getBuiltinPersonaTemplate } from "./builtin-persona-templates";

// =============================================================================
// Types
// =============================================================================

export interface InjectOptions {
  /** Secret values keyed by RequiredSecret.key */
  secrets?: Record<string, string>;
  /** Skip creating a snapshot (for testing) */
  skipSnapshot?: boolean;
}

export interface InjectionResult {
  success: boolean;
  snapshotId?: string;
  cronJobIds: string[];
  error?: string;
}

export interface RollbackResult {
  success: boolean;
  error?: string;
}

export interface InjectionStatus {
  instanceId: string;
  templateId?: string;
  templateVersion?: string;
  status: "none" | "pending" | "in_progress" | "completed" | "failed" | "rolled_back";
  snapshotId?: string;
  injectedAt?: Date;
  cronJobCount: number;
}

// =============================================================================
// Template Orchestrator Service
// =============================================================================

/**
 * TemplateOrchestratorService — orchestrates persona template injection.
 *
 * Single Responsibility: Coordinate the full injection flow across multiple
 * services (config, cron, secrets) while maintaining transaction semantics.
 */
@Injectable()
export class TemplateOrchestratorService {
  private readonly logger = new Logger(TemplateOrchestratorService.name);

  constructor(
    @Inject(BOT_INSTANCE_REPOSITORY)
    private readonly botInstanceRepo: IBotInstanceRepository,
    @Inject(PRISMA_CLIENT)
    private readonly prisma: PrismaClient,
    @Inject(CONFIG_INJECTOR)
    private readonly configInjector: IConfigInjector,
    @Inject(CRON_INJECTOR)
    private readonly cronInjector: ICronInjector,
    @Inject(SECRET_RESOLVER)
    private readonly secretResolver: ISecretResolver,
  ) {}

  /**
   * Inject a persona template into a running bot instance.
   */
  async inject(
    instanceId: string,
    templateId: string,
    options: InjectOptions = {},
  ): Promise<InjectionResult> {
    const cronJobIds: string[] = [];
    let snapshotId: string | undefined;

    try {
      // 1. Resolve template
      const template = await this.resolveTemplate(templateId);
      this.logger.log(`Injecting template "${template.name}" into instance ${instanceId}`);

      // 2. Get bot instance and deployment type
      const instance = await this.getInstance(instanceId);
      const deploymentType = instance.deploymentType ?? "docker";

      // 3. Validate required secrets
      this.validateSecrets(template.requiredSecrets, options.secrets ?? {});

      // 4. Emit progress event
      this.emitProgress(instanceId, "started", { templateId: template.id });

      // 5. Create snapshot for rollback (unless skipped)
      if (!options.skipSnapshot) {
        snapshotId = await this.createSnapshot(instanceId, template);
        this.emitProgress(instanceId, "snapshot_created", { snapshotId });
      }

      // 6. Store secrets
      if (options.secrets && Object.keys(options.secrets).length > 0) {
        await this.storeSecrets(instanceId, template.requiredSecrets, options.secrets, deploymentType);
        this.emitProgress(instanceId, "secrets_stored");
      }

      // 7. Inject identity via config
      if (template.identity) {
        await this.configInjector.injectIdentity(instanceId, template.identity);
        this.emitProgress(instanceId, "identity_injected");
      }

      // 8. Inject config patches (including skills, soul reference, etc.)
      if (template.configPatches) {
        const { config, hash } = await this.configInjector.getConfig(instanceId);
        const patchedConfig = this.deepMerge(config, template.configPatches as Record<string, unknown>);
        await this.configInjector.applyPatch(instanceId, patchedConfig, hash);
        this.emitProgress(instanceId, "config_patched");
      }

      // 9. Create cron jobs
      const cronJobs = this.parseCronJobs(template.cronJobs);
      for (const job of cronJobs) {
        const jobId = await this.cronInjector.addJob(instanceId, job);
        cronJobIds.push(jobId);
      }
      if (cronJobIds.length > 0) {
        this.emitProgress(instanceId, "cron_jobs_created", { count: cronJobIds.length });
      }

      // 10. Update snapshot with cron job IDs
      if (snapshotId) {
        await this.updateSnapshotCronJobs(snapshotId, cronJobIds);
      }

      // 11. Mark injection complete
      this.emitProgress(instanceId, "completed", { snapshotId, cronJobCount: cronJobIds.length });

      this.logger.log(
        `Template "${template.name}" injected into instance ${instanceId} successfully`,
      );

      return {
        success: true,
        snapshotId,
        cronJobIds,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to inject template into instance ${instanceId}: ${errorMessage}`,
      );

      // Mark snapshot as failed
      if (snapshotId) {
        await this.markSnapshotFailed(snapshotId);
      }

      this.emitProgress(instanceId, "failed", { error: errorMessage });

      return {
        success: false,
        snapshotId,
        cronJobIds,
        error: errorMessage,
      };
    }
  }

  /**
   * Rollback an injection using a snapshot.
   */
  async rollback(instanceId: string, snapshotId: string): Promise<RollbackResult> {
    try {
      // 1. Get snapshot
      const snapshot = await this.prisma.templateInjectionSnapshot.findUnique({
        where: { id: snapshotId },
      });

      if (!snapshot) {
        throw new NotFoundException(`Snapshot ${snapshotId} not found`);
      }

      if (snapshot.instanceId !== instanceId) {
        throw new BadRequestException(`Snapshot ${snapshotId} does not belong to instance ${instanceId}`);
      }

      this.logger.log(`Rolling back instance ${instanceId} to snapshot ${snapshotId}`);

      // 2. Remove cron jobs created during injection
      const cronJobIds = JSON.parse(snapshot.cronJobIds) as string[];
      for (const jobId of cronJobIds) {
        try {
          await this.cronInjector.removeJob(instanceId, jobId);
        } catch {
          // Job may already be removed, continue
          this.logger.warn(`Could not remove cron job ${jobId} during rollback`);
        }
      }

      // 3. Restore original config
      const originalConfig = JSON.parse(snapshot.configRaw) as Record<string, unknown>;
      await this.configInjector.applyPatch(instanceId, originalConfig, "");

      // 4. Mark snapshot as rolled back
      await this.prisma.templateInjectionSnapshot.update({
        where: { id: snapshotId },
        data: {
          status: "rolled_back",
          rolledBackAt: new Date(),
        },
      });

      this.logger.log(`Instance ${instanceId} rolled back successfully`);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Rollback failed for instance ${instanceId}: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get the injection status for a bot instance.
   */
  async getInjectionStatus(instanceId: string): Promise<InjectionStatus> {
    const snapshot = await this.prisma.templateInjectionSnapshot.findFirst({
      where: { instanceId },
      orderBy: { injectedAt: "desc" },
      include: { template: true },
    });

    if (!snapshot) {
      return {
        instanceId,
        status: "none",
        cronJobCount: 0,
      };
    }

    const cronJobIds = JSON.parse(snapshot.cronJobIds) as string[];

    return {
      instanceId,
      templateId: snapshot.template.templateId,
      templateVersion: snapshot.template.version,
      status: snapshot.status as InjectionStatus["status"],
      snapshotId: snapshot.id,
      injectedAt: snapshot.injectedAt,
      cronJobCount: cronJobIds.length,
    };
  }

  /**
   * List all available persona templates (builtin + custom).
   */
  async listTemplates(workspaceId?: string): Promise<PersonaTemplate[]> {
    // Get builtin templates
    const builtins = BUILTIN_PERSONA_TEMPLATES;

    // Get custom templates from DB
    const dbTemplates = await this.prisma.personaTemplate.findMany({
      where: workspaceId
        ? { OR: [{ workspaceId }, { workspaceId: null }] }
        : {},
    });

    const custom: PersonaTemplate[] = dbTemplates.map((t) => ({
      id: t.templateId,
      version: t.version,
      name: t.name,
      description: t.description,
      category: t.category as PersonaTemplate["category"],
      tags: JSON.parse(t.tags) as string[],
      identity: t.identity ? (JSON.parse(t.identity) as IdentityConfig) : undefined,
      soul: t.soul ?? undefined,
      skills: JSON.parse(t.skills) as string[],
      cronJobs: JSON.parse(t.cronJobs) as CronJobTemplate[],
      configPatches: t.configPatches ? JSON.parse(t.configPatches) : undefined,
      requiredSecrets: JSON.parse(t.requiredSecrets) as RequiredSecret[],
      isBuiltin: t.isBuiltin,
      workspaceId: t.workspaceId ?? undefined,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return [...builtins, ...custom];
  }

  /**
   * Get a single template by ID (checks builtin first, then DB).
   */
  async getTemplate(templateId: string): Promise<PersonaTemplate> {
    const template = await this.resolveTemplate(templateId);
    return template;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async resolveTemplate(templateId: string): Promise<PersonaTemplate> {
    // Try builtin first
    const builtin = getBuiltinPersonaTemplate(templateId);
    if (builtin) return builtin;

    // Try DB
    const dbTemplate = await this.prisma.personaTemplate.findFirst({
      where: { templateId },
    });

    if (!dbTemplate) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }

    return {
      id: dbTemplate.templateId,
      version: dbTemplate.version,
      name: dbTemplate.name,
      description: dbTemplate.description,
      category: dbTemplate.category as PersonaTemplate["category"],
      tags: JSON.parse(dbTemplate.tags) as string[],
      identity: dbTemplate.identity ? (JSON.parse(dbTemplate.identity) as IdentityConfig) : undefined,
      soul: dbTemplate.soul ?? undefined,
      skills: JSON.parse(dbTemplate.skills) as string[],
      cronJobs: JSON.parse(dbTemplate.cronJobs) as CronJobTemplate[],
      configPatches: dbTemplate.configPatches ? JSON.parse(dbTemplate.configPatches) : undefined,
      requiredSecrets: JSON.parse(dbTemplate.requiredSecrets) as RequiredSecret[],
      isBuiltin: dbTemplate.isBuiltin,
      workspaceId: dbTemplate.workspaceId ?? undefined,
      createdAt: dbTemplate.createdAt,
      updatedAt: dbTemplate.updatedAt,
    };
  }

  private async getInstance(instanceId: string): Promise<BotInstance> {
    const instance = await this.botInstanceRepo.findById(instanceId);
    if (!instance) {
      throw new NotFoundException(`Bot instance ${instanceId} not found`);
    }
    return instance;
  }

  private validateSecrets(
    requiredSecrets: RequiredSecret[],
    providedSecrets: Record<string, string>,
  ): void {
    const missing: string[] = [];
    for (const secret of requiredSecrets) {
      if (!providedSecrets[secret.key]) {
        missing.push(secret.label);
      }
    }
    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing required secrets: ${missing.join(", ")}`,
      );
    }
  }

  private async createSnapshot(
    instanceId: string,
    template: PersonaTemplate,
  ): Promise<string> {
    const { config, hash } = await this.configInjector.getConfig(instanceId);

    // Find or create the PersonaTemplate record in DB
    let dbTemplateId: string;
    const existingDbTemplate = await this.prisma.personaTemplate.findFirst({
      where: { templateId: template.id, version: template.version },
    });

    if (existingDbTemplate) {
      dbTemplateId = existingDbTemplate.id;
    } else {
      // Create the template record for builtin templates
      const created = await this.prisma.personaTemplate.create({
        data: {
          templateId: template.id,
          version: template.version,
          name: template.name,
          description: template.description,
          category: template.category,
          tags: JSON.stringify(template.tags),
          identity: template.identity ? JSON.stringify(template.identity) : null,
          soul: template.soul ?? null,
          skills: JSON.stringify(template.skills),
          cronJobs: JSON.stringify(template.cronJobs),
          configPatches: template.configPatches ? JSON.stringify(template.configPatches) : null,
          requiredSecrets: JSON.stringify(template.requiredSecrets),
          isBuiltin: template.isBuiltin,
          workspaceId: template.workspaceId ?? null,
        },
      });
      dbTemplateId = created.id;
    }

    const snapshot = await this.prisma.templateInjectionSnapshot.create({
      data: {
        instanceId,
        templateId: dbTemplateId,
        configHash: hash,
        configRaw: JSON.stringify(config),
        status: "in_progress",
      },
    });

    return snapshot.id;
  }

  private async updateSnapshotCronJobs(
    snapshotId: string,
    cronJobIds: string[],
  ): Promise<void> {
    await this.prisma.templateInjectionSnapshot.update({
      where: { id: snapshotId },
      data: {
        cronJobIds: JSON.stringify(cronJobIds),
        status: "completed",
      },
    });
  }

  private async markSnapshotFailed(snapshotId: string): Promise<void> {
    await this.prisma.templateInjectionSnapshot.update({
      where: { id: snapshotId },
      data: { status: "failed" },
    });
  }

  private async storeSecrets(
    instanceId: string,
    requiredSecrets: RequiredSecret[],
    providedSecrets: Record<string, string>,
    deploymentType: string,
  ): Promise<void> {
    for (const secret of requiredSecrets) {
      const value = providedSecrets[secret.key];
      if (value) {
        await this.secretResolver.storeSecret(
          instanceId,
          secret.key,
          value,
          deploymentType,
        );
      }
    }
  }

  private parseCronJobs(cronJobsJson: string | CronJobTemplate[]): CronJobTemplate[] {
    if (Array.isArray(cronJobsJson)) return cronJobsJson;
    try {
      return JSON.parse(cronJobsJson) as CronJobTemplate[];
    } catch {
      return [];
    }
  }

  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...target };
    for (const key of Object.keys(source)) {
      const srcVal = source[key];
      const tgtVal = result[key];
      if (this.isPlainObject(srcVal) && this.isPlainObject(tgtVal)) {
        result[key] = this.deepMerge(tgtVal as Record<string, unknown>, srcVal as Record<string, unknown>);
      } else {
        result[key] = srcVal;
      }
    }
    return result;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private emitProgress(
    instanceId: string,
    stage: string,
    data?: Record<string, unknown>,
  ): void {
    // Log progress for debugging (can be extended to emit events later)
    this.logger.debug(
      `Injection progress: ${instanceId} - ${stage}`,
      data ? JSON.stringify(data) : undefined,
    );
  }
}
