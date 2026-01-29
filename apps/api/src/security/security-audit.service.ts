import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@molthub/database";
import {
  BUILTIN_MOLTBOT_POLICY_PACKS,
  MoltbotConfig,
  MoltbotEvaluationContext,
  evaluateMoltbotPolicyPack,
} from "@molthub/core";
import * as crypto from "crypto";

// ── Interfaces ──────────────────────────────────────────────────────────

export interface SecurityFinding {
  ruleId: string;
  ruleName: string;
  severity: "ERROR" | "WARNING" | "INFO";
  message: string;
  field?: string;
  currentValue?: unknown;
  suggestedFix?: Record<string, unknown>;
}

export interface SecurityAuditResult {
  instanceId: string;
  findings: SecurityFinding[];
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
  auditedAt: Date;
  configHash?: string;
}

export interface SecurityFix {
  findingId: string;
  description: string;
  patch: Record<string, unknown>;
}

export interface ApplyFixResult {
  instanceId: string;
  appliedFixes: string[];
  failedFixes: Array<{ fixId: string; reason: string }>;
  newAudit: SecurityAuditResult;
}

// ── Service ─────────────────────────────────────────────────────────────

@Injectable()
export class MoltbotSecurityAuditService {
  /**
   * Run a full security audit on a Moltbot instance.
   * Evaluates all built-in Moltbot policy packs against the instance config.
   */
  async audit(instanceId: string): Promise<SecurityAuditResult> {
    const instance = await prisma.botInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      throw new NotFoundException(`Instance '${instanceId}' not found`);
    }

    const config = (instance.config as Record<string, unknown>) || {};
    const moltbotConfig = config as unknown as MoltbotConfig;
    const environment = ((instance as any).environment || "dev") as "dev" | "staging" | "prod";

    // Gather other instances for cross-instance checks
    const otherInstances = await prisma.botInstance.findMany({
      where: { id: { not: instanceId } },
      select: { id: true, config: true },
    });

    const context: MoltbotEvaluationContext = {
      environment,
      otherInstances: otherInstances.map((inst) => {
        const otherConfig = (inst.config as Record<string, unknown>) || {};
        const otherMoltbot = otherConfig as unknown as MoltbotConfig;
        return {
          instanceId: inst.id,
          workspace: otherMoltbot.agents?.defaults?.workspace,
          gatewayPort: otherMoltbot.gateway?.port,
        };
      }),
    };

    const findings: SecurityFinding[] = [];

    // Evaluate each built-in Moltbot policy pack
    for (const pack of BUILTIN_MOLTBOT_POLICY_PACKS) {
      // Check if the pack applies to this environment
      if (pack.targetEnvironments && !pack.targetEnvironments.includes(environment)) {
        continue;
      }

      const result = evaluateMoltbotPolicyPack(pack, instanceId, moltbotConfig, context);

      for (const violation of result.violations) {
        findings.push({
          ruleId: violation.ruleId,
          ruleName: violation.ruleName,
          severity: "ERROR",
          message: violation.message,
          field: violation.field ?? undefined,
          currentValue: violation.currentValue ?? undefined,
          suggestedFix: violation.suggestedValue
            ? this.buildMergePatch(violation.field ?? "", violation.suggestedValue)
            : undefined,
        });
      }

      for (const warning of result.warnings) {
        findings.push({
          ruleId: warning.ruleId,
          ruleName: warning.ruleName,
          severity: "WARNING",
          message: warning.message,
          field: warning.field ?? undefined,
          currentValue: warning.currentValue ?? undefined,
          suggestedFix: warning.suggestedValue
            ? this.buildMergePatch(warning.field ?? "", warning.suggestedValue)
            : undefined,
        });
      }
    }

    const configHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(config))
      .digest("hex")
      .slice(0, 16);

    return {
      instanceId,
      findings,
      totalErrors: findings.filter((f) => f.severity === "ERROR").length,
      totalWarnings: findings.filter((f) => f.severity === "WARNING").length,
      totalInfo: findings.filter((f) => f.severity === "INFO").length,
      auditedAt: new Date(),
      configHash,
    };
  }

  /**
   * Generate fix suggestions for all findings from an audit.
   */
  async suggestFixes(instanceId: string): Promise<SecurityFix[]> {
    const auditResult = await this.audit(instanceId);
    const fixes: SecurityFix[] = [];

    for (const finding of auditResult.findings) {
      const patch = finding.suggestedFix || this.generateDefaultFix(finding);
      if (patch && Object.keys(patch).length > 0) {
        fixes.push({
          findingId: finding.ruleId,
          description: `Fix: ${finding.message}`,
          patch,
        });
      }
    }

    return fixes;
  }

  /**
   * Apply selected fixes to an instance configuration.
   */
  async applyFixes(instanceId: string, fixIds: string[]): Promise<ApplyFixResult> {
    const fixes = await this.suggestFixes(instanceId);
    const appliedFixes: string[] = [];
    const failedFixes: Array<{ fixId: string; reason: string }> = [];

    const instance = await prisma.botInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      throw new NotFoundException(`Instance '${instanceId}' not found`);
    }

    let config = (instance.config as Record<string, unknown>) || {};

    for (const fixId of fixIds) {
      const fix = fixes.find((f) => f.findingId === fixId);
      if (!fix) {
        failedFixes.push({ fixId, reason: "Fix not found" });
        continue;
      }

      try {
        config = this.applyMergePatch(config, fix.patch);
        appliedFixes.push(fixId);
      } catch (error) {
        failedFixes.push({
          fixId,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Save updated config
    if (appliedFixes.length > 0) {
      await prisma.botInstance.update({
        where: { id: instanceId },
        data: { config: config as any },
      });
    }

    // Re-audit after applying fixes
    const newAudit = await this.audit(instanceId);

    return {
      instanceId,
      appliedFixes,
      failedFixes,
      newAudit,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private buildMergePatch(field: string, value: unknown): Record<string, unknown> {
    if (!field) return {};
    const parts = field.split(".");
    let patch: Record<string, unknown> = {};
    let current = patch;

    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] = {};
      current = current[parts[i]] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
    return patch;
  }

  private applyMergePatch(
    target: Record<string, unknown>,
    patch: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };

    for (const [key, value] of Object.entries(patch)) {
      if (value === null) {
        delete result[key];
      } else if (typeof value === "object" && !Array.isArray(value) && value !== null) {
        result[key] = this.applyMergePatch(
          (result[key] as Record<string, unknown>) || {},
          value as Record<string, unknown>,
        );
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private generateDefaultFix(finding: SecurityFinding): Record<string, unknown> {
    switch (finding.ruleId) {
      case "moltbot-require-gateway-auth":
        return { gateway: { auth: { token: "<REPLACE_WITH_SECURE_TOKEN>" } } };

      case "moltbot-require-dm-policy":
      case "moltbot-channel-dm-policy":
        return { channels: [{ dmPolicy: "pairing" }] };

      case "moltbot-forbid-elevated-tools":
        return { tools: { elevated: { allowFrom: ["admin"] } } };

      case "moltbot-require-sandbox":
        return { agents: { defaults: { sandbox: { mode: "docker" } } } };

      case "moltbot-limit-tool-profile":
        return { tools: { profile: "standard" } };

      case "moltbot-require-model-guardrails":
        return { agents: { defaults: { model: { maxTokens: 4096, temperature: 0.7 } } } };

      case "moltbot-require-workspace-isolation":
        return { agents: { defaults: { workspace: `/var/moltbot/workspaces/${finding.ruleId}-${Date.now()}` } } };

      case "moltbot-forbid-open-group-policy":
        return { channels: [{ groupPolicy: "allowlist" }] };

      default:
        return {};
    }
  }
}
