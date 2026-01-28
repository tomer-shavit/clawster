import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { prisma, PolicyPack } from "@molthub/database";
import { validatePolicyPack, PolicyEngine, BUILTIN_POLICY_PACKS } from "@molthub/core";
import { CreatePolicyPackDto, UpdatePolicyPackDto, ListPolicyPacksQueryDto, EvaluatePolicyDto } from "./policy-packs.dto";

@Injectable()
export class PolicyPacksService {
  private readonly policyEngine = new PolicyEngine();

  async create(dto: CreatePolicyPackDto): Promise<PolicyPack> {
    // Validate rules
    if (dto.rules && dto.rules.length > 0) {
      for (const rule of dto.rules) {
        try {
          validatePolicyPack({
            id: "temp",
            name: dto.name,
            description: dto.description,
            rules: [rule],
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: dto.createdBy || "system",
          });
        } catch (error) {
          throw new BadRequestException(`Invalid rule: ${error instanceof Error ? error.message : error}`);
        }
      }
    }

    const policyPack = await prisma.policyPack.create({
      data: {
        workspaceId: dto.workspaceId,
        name: dto.name,
        description: dto.description,
        autoApply: dto.autoApply ?? false,
        targetEnvironments: dto.targetEnvironments as any,
        targetTags: dto.targetTags as any,
        rules: dto.rules as any,
        isEnforced: dto.isEnforced ?? false,
        priority: dto.priority || 0,
        version: dto.version || "1.0.0",
        createdBy: dto.createdBy || "system",
      },
    });

    return policyPack;
  }

  async findAll(query: ListPolicyPacksQueryDto): Promise<PolicyPack[]> {
    return prisma.policyPack.findMany({
      where: {
        workspaceId: query.workspaceId,
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.isBuiltin !== undefined && { isBuiltin: query.isBuiltin }),
        ...(query.autoApply !== undefined && { autoApply: query.autoApply }),
      },
      orderBy: [{ isBuiltin: "desc" }, { priority: "desc" }],
    });
  }

  async findOne(id: string): Promise<PolicyPack> {
    // Check builtin packs first
    const builtin = BUILTIN_POLICY_PACKS.find(p => p.id === id);
    if (builtin) {
      return builtin as any;
    }

    const policyPack = await prisma.policyPack.findUnique({
      where: { id },
    });

    if (!policyPack) {
      throw new NotFoundException(`Policy pack ${id} not found`);
    }

    return policyPack;
  }

  async update(id: string, dto: UpdatePolicyPackDto): Promise<PolicyPack> {
    const existing = await this.findOne(id);
    
    if (existing.isBuiltin) {
      throw new BadRequestException("Cannot modify builtin policy packs");
    }

    return prisma.policyPack.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.autoApply !== undefined && { autoApply: dto.autoApply }),
        ...(dto.targetEnvironments && { targetEnvironments: dto.targetEnvironments as any }),
        ...(dto.targetTags && { targetTags: dto.targetTags as any }),
        ...(dto.rules && { rules: dto.rules as any }),
        ...(dto.isEnforced !== undefined && { isEnforced: dto.isEnforced }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findOne(id);
    
    if (existing.isBuiltin) {
      throw new BadRequestException("Cannot delete builtin policy packs");
    }

    await prisma.policyPack.delete({ where: { id } });
  }

  async evaluate(dto: EvaluatePolicyDto): Promise<any> {
    const policyPack = await this.findOne(dto.policyPackId);
    
    // Evaluate the manifest against the policy pack
    const violations: any[] = [];
    
    for (const rule of (policyPack.rules as any[]) || []) {
      // Simple rule evaluation - can be expanded
      const result = this.evaluateRule(rule, dto.manifest);
      if (!result.passed) {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          message: result.message,
        });
      }
    }

    return {
      policyPackId: policyPack.id,
      policyPackName: policyPack.name,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      valid: violations.length === 0,
      violations,
      evaluatedAt: new Date(),
    };
  }

  private evaluateRule(rule: any, manifest: any): { passed: boolean; message?: string } {
    // Simplified rule evaluation - full implementation would be more comprehensive
    switch (rule.type) {
      case "required_field":
        const value = this.getPath(manifest, rule.config.field);
        if (value === undefined || value === null) {
          return { passed: false, message: rule.errorMessage || `${rule.config.field} is required` };
        }
        return { passed: true };
      
      case "forbidden_field":
        const forbiddenValue = this.getPath(manifest, rule.config.field);
        if (forbiddenValue !== undefined) {
          return { passed: false, message: rule.errorMessage || `${rule.config.field} is forbidden` };
        }
        return { passed: true };
      
      default:
        return { passed: true };
    }
  }

  private getPath(obj: any, path: string): any {
    return path.split('.').reduce((o, p) => o?.[p], obj);
  }
}