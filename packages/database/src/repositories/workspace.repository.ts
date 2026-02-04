import { PrismaClient, Workspace, User, Prisma } from "@prisma/client";
import {
  IWorkspaceRepository,
  WorkspaceFilters,
  WorkspaceWithRelations,
  WorkspaceStats,
  UserFilters,
  UserWithRelations,
} from "../interfaces/workspace.repository";
import {
  PaginationOptions,
  PaginatedResult,
  TransactionClient,
} from "../interfaces/base";

export class PrismaWorkspaceRepository implements IWorkspaceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: TransactionClient): TransactionClient | PrismaClient {
    return tx ?? this.prisma;
  }

  // ============================================
  // WHERE CLAUSE BUILDERS
  // ============================================

  private buildWorkspaceWhereClause(
    filters?: WorkspaceFilters
  ): Prisma.WorkspaceWhereInput {
    if (!filters) return {};

    const where: Prisma.WorkspaceWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { slug: { contains: filters.search } },
      ];
    }

    return where;
  }

  private buildUserWhereClause(filters?: UserFilters): Prisma.UserWhereInput {
    if (!filters) return {};

    const where: Prisma.UserWhereInput = {};

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    }

    if (filters.role) {
      where.role = Array.isArray(filters.role)
        ? { in: filters.role }
        : filters.role;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { email: { contains: filters.search } },
      ];
    }

    return where;
  }

  // ============================================
  // WORKSPACE METHODS
  // ============================================

  async findFirstWorkspace(
    filters?: WorkspaceFilters,
    tx?: TransactionClient
  ): Promise<Workspace | null> {
    const client = this.getClient(tx);
    const where = this.buildWorkspaceWhereClause(filters);
    return client.workspace.findFirst({ where });
  }

  async findWorkspaceById(
    id: string,
    tx?: TransactionClient
  ): Promise<WorkspaceWithRelations | null> {
    const client = this.getClient(tx);
    return client.workspace.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            botInstances: true,
            fleets: true,
          },
        },
      },
    });
  }

  async findWorkspaceBySlug(
    slug: string,
    tx?: TransactionClient
  ): Promise<WorkspaceWithRelations | null> {
    const client = this.getClient(tx);
    return client.workspace.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            users: true,
            botInstances: true,
            fleets: true,
          },
        },
      },
    });
  }

  async findManyWorkspaces(
    filters?: WorkspaceFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<Workspace>> {
    const client = this.getClient(tx);
    const where = this.buildWorkspaceWhereClause(filters);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      client.workspace.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      client.workspace.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async countWorkspaces(
    filters?: WorkspaceFilters,
    tx?: TransactionClient
  ): Promise<number> {
    const client = this.getClient(tx);
    const where = this.buildWorkspaceWhereClause(filters);
    return client.workspace.count({ where });
  }

  async createWorkspace(
    data: Prisma.WorkspaceCreateInput,
    tx?: TransactionClient
  ): Promise<Workspace> {
    const client = this.getClient(tx);
    return client.workspace.create({ data });
  }

  async updateWorkspace(
    id: string,
    data: Prisma.WorkspaceUpdateInput,
    tx?: TransactionClient
  ): Promise<Workspace> {
    const client = this.getClient(tx);
    return client.workspace.update({
      where: { id },
      data,
    });
  }

  async deleteWorkspace(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.workspace.delete({ where: { id } });
  }

  async getWorkspaceStats(
    id: string,
    tx?: TransactionClient
  ): Promise<WorkspaceStats | null> {
    const client = this.getClient(tx);

    const workspace = await client.workspace.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            botInstances: true,
            fleets: true,
            templates: true,
            profiles: true,
          },
        },
      },
    });

    if (!workspace) return null;

    return {
      userCount: workspace._count.users,
      botInstanceCount: workspace._count.botInstances,
      fleetCount: workspace._count.fleets,
      templateCount: workspace._count.templates,
      profileCount: workspace._count.profiles,
    };
  }

  // ============================================
  // USER METHODS
  // ============================================

  async findUserById(
    id: string,
    tx?: TransactionClient
  ): Promise<UserWithRelations | null> {
    const client = this.getClient(tx);
    return client.user.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async findUserByEmail(
    email: string,
    workspaceId: string,
    tx?: TransactionClient
  ): Promise<User | null> {
    const client = this.getClient(tx);
    return client.user.findUnique({
      where: {
        email_workspaceId: {
          email,
          workspaceId,
        },
      },
    });
  }

  async findManyUsers(
    filters?: UserFilters,
    pagination?: PaginationOptions,
    tx?: TransactionClient
  ): Promise<PaginatedResult<User>> {
    const client = this.getClient(tx);
    const where = this.buildUserWhereClause(filters);
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      client.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
      }),
      client.user.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findUsersByWorkspace(
    workspaceId: string,
    filters?: Omit<UserFilters, "workspaceId">,
    tx?: TransactionClient
  ): Promise<User[]> {
    const client = this.getClient(tx);
    const where = this.buildUserWhereClause({ ...filters, workspaceId });

    return client.user.findMany({
      where,
      orderBy: { name: "asc" },
    });
  }

  async countUsers(filters?: UserFilters, tx?: TransactionClient): Promise<number> {
    const client = this.getClient(tx);
    const where = this.buildUserWhereClause(filters);
    return client.user.count({ where });
  }

  async createUser(
    data: Prisma.UserCreateInput,
    tx?: TransactionClient
  ): Promise<User> {
    const client = this.getClient(tx);
    return client.user.create({ data });
  }

  async updateUser(
    id: string,
    data: Prisma.UserUpdateInput,
    tx?: TransactionClient
  ): Promise<User> {
    const client = this.getClient(tx);
    return client.user.update({
      where: { id },
      data,
    });
  }

  async deleteUser(id: string, tx?: TransactionClient): Promise<void> {
    const client = this.getClient(tx);
    await client.user.delete({ where: { id } });
  }

  async updateUserRole(
    id: string,
    role: string,
    tx?: TransactionClient
  ): Promise<User> {
    const client = this.getClient(tx);
    return client.user.update({
      where: { id },
      data: { role },
    });
  }
}
