import { Injectable, NotFoundException, Logger, Inject } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  BudgetConfig,
  COST_REPOSITORY,
  ICostRepository,
  ALERT_REPOSITORY,
  IAlertRepository,
} from "@clawster/database";
import { CreateBudgetDto, UpdateBudgetDto, BudgetQueryDto } from "./costs.dto";

@Injectable()
export class BudgetService {
  private readonly logger = new Logger(BudgetService.name);

  constructor(
    @Inject(COST_REPOSITORY)
    private readonly costRepo: ICostRepository,
    @Inject(ALERT_REPOSITORY)
    private readonly alertRepo: IAlertRepository,
  ) {}

  // ============================================
  // CRUD Operations
  // ============================================

  async create(dto: CreateBudgetDto): Promise<BudgetConfig> {
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return this.costRepo.createBudget({
      name: dto.name,
      description: dto.description,
      instance: dto.instanceId ? { connect: { id: dto.instanceId } } : undefined,
      fleet: dto.fleetId ? { connect: { id: dto.fleetId } } : undefined,
      monthlyLimitCents: dto.monthlyLimitCents,
      currency: dto.currency ?? "USD",
      warnThresholdPct: dto.warnThresholdPct ?? 75,
      criticalThresholdPct: dto.criticalThresholdPct ?? 90,
      periodStart: now,
      periodEnd,
      createdBy: "system",
    });
  }

  async findAll(query: BudgetQueryDto): Promise<BudgetConfig[]> {
    return this.costRepo.findBudgets({
      instanceId: query.instanceId,
      fleetId: query.fleetId,
      isActive: query.isActive,
    });
  }

  async findOne(id: string): Promise<BudgetConfig> {
    const budget = await this.costRepo.findBudget(id);

    if (!budget) {
      throw new NotFoundException(`Budget config ${id} not found`);
    }

    return budget;
  }

  async update(id: string, dto: UpdateBudgetDto): Promise<BudgetConfig> {
    await this.findOne(id);

    return this.costRepo.updateBudget(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.monthlyLimitCents !== undefined && {
        monthlyLimitCents: dto.monthlyLimitCents,
      }),
      ...(dto.currency !== undefined && { currency: dto.currency }),
      ...(dto.warnThresholdPct !== undefined && {
        warnThresholdPct: dto.warnThresholdPct,
      }),
      ...(dto.criticalThresholdPct !== undefined && {
        criticalThresholdPct: dto.criticalThresholdPct,
      }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.costRepo.deleteBudget(id);
  }

  // ============================================
  // Cron Jobs
  // ============================================

  /**
   * Check budget thresholds every 5 minutes.
   * Creates or updates HealthAlert records when thresholds are exceeded.
   * Resolves alerts when spend drops below thresholds.
   */
  @Cron("*/5 * * * *")
  async checkBudgetThresholds(): Promise<void> {
    this.logger.debug("Checking budget thresholds...");

    const activeBudgets = await this.costRepo.findBudgets({ isActive: true });

    for (const budget of activeBudgets) {
      const spendPct =
        budget.monthlyLimitCents > 0
          ? (budget.currentSpendCents / budget.monthlyLimitCents) * 100
          : 0;

      const isCritical = spendPct >= budget.criticalThresholdPct;
      const isWarning = spendPct >= budget.warnThresholdPct;

      // Handle critical threshold
      await this.handleThresholdAlert(
        budget,
        "budget_critical",
        isCritical,
        "CRITICAL",
        spendPct,
      );

      // Handle warning threshold
      await this.handleThresholdAlert(
        budget,
        "budget_warning",
        isWarning && !isCritical,
        "WARNING",
        spendPct,
      );
    }

    this.logger.debug(
      `Budget threshold check complete. Checked ${activeBudgets.length} budgets.`,
    );
  }

  /**
   * Reset monthly budgets on the 1st of each month at midnight.
   * Resets currentSpendCents to 0 and updates periodStart/periodEnd.
   */
  @Cron("0 0 1 * *")
  async resetMonthlyBudgets(): Promise<void> {
    this.logger.log("Resetting monthly budgets...");

    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const count = await this.costRepo.resetAllActiveBudgets(now, periodEnd);

    this.logger.log(`Reset ${count} active budgets for new period.`);
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async handleThresholdAlert(
    budget: BudgetConfig,
    rule: string,
    isTriggered: boolean,
    severity: string,
    spendPct: number,
  ): Promise<void> {
    const title = `Budget ${rule === "budget_critical" ? "critical" : "warning"}: ${budget.name}`;
    const message = `Budget "${budget.name}" is at ${spendPct.toFixed(1)}% ($${(budget.currentSpendCents / 100).toFixed(2)} of $${(budget.monthlyLimitCents / 100).toFixed(2)} limit).`;

    if (isTriggered) {
      // Use upsertByKey to create or update the alert
      await this.alertRepo.upsertByKey({
        rule,
        severity,
        title,
        message,
        detail: JSON.stringify({
          budgetId: budget.id,
          budgetName: budget.name,
          currentSpendCents: budget.currentSpendCents,
          monthlyLimitCents: budget.monthlyLimitCents,
          spendPct,
        }),
        remediationAction: "review_costs",
        remediationNote: `Review cost events and consider adjusting the budget limit or reducing usage.`,
        instanceId: budget.instanceId,
        fleetId: budget.fleetId,
      });
    } else {
      // Try to resolve any existing alert for this key
      if (budget.instanceId) {
        await this.alertRepo.resolveByKey(rule, budget.instanceId);
      }
    }
  }
}
