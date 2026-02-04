import {
  PrismaClient,
  Template,
  Profile,
  Overlay,
  PolicyPack,
  Prisma,
} from "@prisma/client";
import {
  IConfigLayerRepository,
  TemplateFilters,
  ProfileFilters,
  ProfileWithRelations,
  OverlayFilters,
  PolicyPackFilters,
} from "../interfaces/config-layer.repository";
import {
  PaginationOptions,
  PaginatedResult,
  TransactionClient,
} from "../interfaces/base";

export class PrismaConfigLayerRepository implements IConfigLayerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: TransactionClient): TransactionClient | PrismaClient {
    return tx ?? this.prisma;
  }

  // ============================================
  // WHERE CLAUSE BUILDERS
  // ============================================

  private buildTemplateWhereClause(
    filters?: TemplateFilters
  ): Prisma.TemplateWhereInput {
    if (!filters) return {};

    const where: Prisma.TemplateWhereInput = {};

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    }

    if (filters.category) {
      where.category = Array.isArray(filters.category)
        ? { in: filters.category }
        : filters.category;
    }

    if (filters.isBuiltin !== undefined) {
      where.isBuiltin = filters.isBuiltin;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    return where;
  }

  private buildProfileWhereClause(
    filters?: ProfileFilters
  ): Prisma.ProfileWhereInput {
    if (!filters) return {};

    const where: Prisma.ProfileWhereInput = {};

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    return where;
  }

  private buildOverlayWhereClause(
    filters?: OverlayFilters
  ): Prisma.OverlayWhereInput {
    if (!filters) return {};

    const where: Prisma.OverlayWhereInput = {};

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    }

    if (filters.targetType) {
      where.targetType = Array.isArray(filters.targetType)
        ? { in: filters.targetType }
        : filters.targetType;
    }

    if (filters.enabled !== undefined) {
      where.enabled = filters.enabled;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    return where;
  }

  private buildPolicyPackWhereClause(
    filters?: PolicyPackFilters
  ): Prisma.PolicyPackWhereInput {
    if (!filters) return {};

    const where: Prisma.PolicyPackWhereInput = {};

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    }

    if (filters.isBuiltin !== undefined) {
      where.isBuiltin = filters.isBuiltin;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.isEnforced !== undefined) {
      where.isEnforced = filters.isEnforced;
    }

    if (filters.autoApply !== undefined) {
      where.autoApply = filters.autoApply;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
      ];
    }

    return where;
  }

  // ============================================
  // TEMPLATE METHODS
  // ============================================

  async findTemplateById(
    id: string,
    tx?: TransactionClient
  ): Promise<Template | null> {
    const client = this.getClient(tx);
    return client.template.findUnique({ where: { id } });
  }

  async findManyTemplates(
    filters?: TemplateFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<Template>> {
    const client = this.getClient(tx);
    const where = this.buildTemplateWhereClause(filters);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      client.template.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      client.template.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findTemplatesByWorkspace(
    workspaceId: string,
    filters?: Omit<TemplateFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<Template[]> {
    const client = this.getClient(tx);
    // Include both workspace-specific and built-in templates
    const where: Prisma.TemplateWhereInput = {
      OR: [
        { workspaceId, ...this.buildTemplateWhereClause(filters) },
        { isBuiltin: true, ...this.buildTemplateWhereClause(filters) },
      ],
    };

    return client.template.findMany({
      where,
      orderBy: [{ isBuiltin: "desc" }, { name: "asc" }],
    });
  }

  async findBuiltinTemplates(tx?: TransactionClient): Promise<Template[]> {
    const client = this.getClient(tx);
    return client.template.findMany({
      where: { isBuiltin: true },
      orderBy: { name: "asc" },
    });
  }

  async createTemplate(
    data: Prisma.TemplateCreateInput,
    tx?: TransactionClient
  ): Promise<Template> {
    const client = this.getClient(tx);
    return client.template.create({ data });
  }

  async updateTemplate(
    id: string,
    data: Prisma.TemplateUpdateInput,
    tx?: TransactionClient
  ): Promise<Template> {
    const client = this.getClient(tx);
    return client.template.update({ where: { id }, data });
  }

  async deleteTemplate(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.template.delete({ where: { id } });
  }

  // ============================================
  // PROFILE METHODS
  // ============================================

  async findProfileById(
    id: string,
    tx?: TransactionClient
  ): Promise<ProfileWithRelations | null> {
    const client = this.getClient(tx);
    return client.profile.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            fleets: true,
          },
        },
      },
    });
  }

  async findManyProfiles(
    filters?: ProfileFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<Profile>> {
    const client = this.getClient(tx);
    const where = this.buildProfileWhereClause(filters);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      client.profile.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: "desc" }, { name: "asc" }],
      }),
      client.profile.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findProfilesByWorkspace(
    workspaceId: string,
    filters?: Omit<ProfileFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<Profile[]> {
    const client = this.getClient(tx);
    const where = this.buildProfileWhereClause({ ...filters, workspaceId });

    return client.profile.findMany({
      where,
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });
  }

  async findActiveProfilesByPriority(
    workspaceId: string,
    tx?: TransactionClient
  ): Promise<Profile[]> {
    const client = this.getClient(tx);
    return client.profile.findMany({
      where: { workspaceId, isActive: true },
      orderBy: { priority: "desc" },
    });
  }

  async createProfile(
    data: Prisma.ProfileCreateInput,
    tx?: TransactionClient
  ): Promise<Profile> {
    const client = this.getClient(tx);
    return client.profile.create({ data });
  }

  async updateProfile(
    id: string,
    data: Prisma.ProfileUpdateInput,
    tx?: TransactionClient
  ): Promise<Profile> {
    const client = this.getClient(tx);
    return client.profile.update({ where: { id }, data });
  }

  async deleteProfile(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.profile.delete({ where: { id } });
  }

  // ============================================
  // OVERLAY METHODS
  // ============================================

  async findOverlayById(
    id: string,
    tx?: TransactionClient
  ): Promise<Overlay | null> {
    const client = this.getClient(tx);
    return client.overlay.findUnique({ where: { id } });
  }

  async findManyOverlays(
    filters?: OverlayFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<Overlay>> {
    const client = this.getClient(tx);
    const where = this.buildOverlayWhereClause(filters);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      client.overlay.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: "desc" }, { name: "asc" }],
      }),
      client.overlay.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOverlaysByWorkspace(
    workspaceId: string,
    filters?: Omit<OverlayFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<Overlay[]> {
    const client = this.getClient(tx);
    const where = this.buildOverlayWhereClause({ ...filters, workspaceId });

    return client.overlay.findMany({
      where,
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });
  }

  async findApplicableOverlays(
    workspaceId: string,
    targetType: string,
    targetSelector: string,
    tx?: TransactionClient
  ): Promise<Overlay[]> {
    const client = this.getClient(tx);
    return client.overlay.findMany({
      where: {
        workspaceId,
        targetType,
        targetSelector,
        enabled: true,
      },
      orderBy: { priority: "desc" },
    });
  }

  async createOverlay(
    data: Prisma.OverlayCreateInput,
    tx?: TransactionClient
  ): Promise<Overlay> {
    const client = this.getClient(tx);
    return client.overlay.create({ data });
  }

  async updateOverlay(
    id: string,
    data: Prisma.OverlayUpdateInput,
    tx?: TransactionClient
  ): Promise<Overlay> {
    const client = this.getClient(tx);
    return client.overlay.update({ where: { id }, data });
  }

  async deleteOverlay(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.overlay.delete({ where: { id } });
  }

  // ============================================
  // POLICY PACK METHODS
  // ============================================

  async findPolicyPackById(
    id: string,
    tx?: TransactionClient
  ): Promise<PolicyPack | null> {
    const client = this.getClient(tx);
    return client.policyPack.findUnique({ where: { id } });
  }

  async findManyPolicyPacks(
    filters?: PolicyPackFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<PolicyPack>> {
    const client = this.getClient(tx);
    const where = this.buildPolicyPackWhereClause(filters);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      client.policyPack.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: "desc" }, { name: "asc" }],
      }),
      client.policyPack.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findPolicyPacksByWorkspace(
    workspaceId: string,
    filters?: Omit<PolicyPackFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<PolicyPack[]> {
    const client = this.getClient(tx);
    // Include both workspace-specific and built-in policy packs
    const baseFilters = this.buildPolicyPackWhereClause(filters);
    const where: Prisma.PolicyPackWhereInput = {
      OR: [
        { workspaceId, ...baseFilters },
        { isBuiltin: true, ...baseFilters },
      ],
    };

    return client.policyPack.findMany({
      where,
      orderBy: [{ isBuiltin: "desc" }, { priority: "desc" }, { name: "asc" }],
    });
  }

  async findBuiltinPolicyPacks(tx?: TransactionClient): Promise<PolicyPack[]> {
    const client = this.getClient(tx);
    return client.policyPack.findMany({
      where: { isBuiltin: true },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });
  }

  async findAutoApplyPolicyPacks(
    workspaceId?: string,
    tx?: TransactionClient
  ): Promise<PolicyPack[]> {
    const client = this.getClient(tx);
    const where: Prisma.PolicyPackWhereInput = {
      autoApply: true,
      isActive: true,
    };

    if (workspaceId) {
      where.OR = [{ workspaceId }, { isBuiltin: true }];
    }

    return client.policyPack.findMany({
      where,
      orderBy: { priority: "desc" },
    });
  }

  async createPolicyPack(
    data: Prisma.PolicyPackCreateInput,
    tx?: TransactionClient
  ): Promise<PolicyPack> {
    const client = this.getClient(tx);
    return client.policyPack.create({ data });
  }

  async updatePolicyPack(
    id: string,
    data: Prisma.PolicyPackUpdateInput,
    tx?: TransactionClient
  ): Promise<PolicyPack> {
    const client = this.getClient(tx);
    return client.policyPack.update({ where: { id }, data });
  }

  async deletePolicyPack(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.policyPack.delete({ where: { id } });
  }
}
