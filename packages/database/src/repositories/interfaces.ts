import type {
  BotInstance, Fleet, Workspace, Profile, Overlay,
  PolicyPack, Template, SkillPack, CommunicationChannel,
  IntegrationConnector, ChangeSet, Trace, HealthAlert,
  CostEvent, SloDefinition, BudgetConfig, GatewayConnection,
  BotRoutingRule, NotificationChannel, Prisma
} from '@prisma/client';

// Generic repository interface
export interface IRepository<T, CreateInput, UpdateInput> {
  findById(id: string): Promise<T | null>;
  findMany(args?: { where?: object; orderBy?: object; take?: number; skip?: number }): Promise<T[]>;
  create(data: CreateInput): Promise<T>;
  update(id: string, data: UpdateInput): Promise<T>;
  delete(id: string): Promise<T>;
  count(where?: object): Promise<number>;
}

// Specific repository interfaces with domain-specific methods
export interface IBotInstanceRepository extends IRepository<BotInstance, Prisma.BotInstanceCreateInput, Prisma.BotInstanceUpdateInput> {
  findByWorkspace(workspaceId: string): Promise<BotInstance[]>;
  findByFleet(fleetId: string): Promise<BotInstance[]>;
  findByStatus(status: string): Promise<BotInstance[]>;
  findWithRelations(id: string): Promise<BotInstance | null>;
  updateStatus(id: string, status: string, health?: string): Promise<BotInstance>;
}

export interface IFleetRepository extends IRepository<Fleet, Prisma.FleetCreateInput, Prisma.FleetUpdateInput> {
  findByWorkspace(workspaceId: string): Promise<Fleet[]>;
  findWithInstances(id: string): Promise<Fleet | null>;
}

export interface IWorkspaceRepository extends IRepository<Workspace, Prisma.WorkspaceCreateInput, Prisma.WorkspaceUpdateInput> {
  findBySlug(slug: string): Promise<Workspace | null>;
}

export interface IProfileRepository extends IRepository<Profile, Prisma.ProfileCreateInput, Prisma.ProfileUpdateInput> {
  findByWorkspace(workspaceId: string): Promise<Profile[]>;
  findActive(workspaceId: string): Promise<Profile[]>;
}

export interface IHealthAlertRepository extends IRepository<HealthAlert, Prisma.HealthAlertCreateInput, Prisma.HealthAlertUpdateInput> {
  findActiveByInstance(instanceId: string): Promise<HealthAlert[]>;
  findActiveByFleet(fleetId: string): Promise<HealthAlert[]>;
  findByStatus(status: string): Promise<HealthAlert[]>;
}

export interface ICostEventRepository extends IRepository<CostEvent, Prisma.CostEventCreateInput, Prisma.CostEventUpdateInput> {
  findByInstance(instanceId: string, dateRange?: { from: Date; to: Date }): Promise<CostEvent[]>;
  sumByInstance(instanceId: string, dateRange?: { from: Date; to: Date }): Promise<number>;
}

export interface IGatewayConnectionRepository extends IRepository<GatewayConnection, Prisma.GatewayConnectionCreateInput, Prisma.GatewayConnectionUpdateInput> {
  findByInstance(instanceId: string): Promise<GatewayConnection | null>;
  updateStatus(instanceId: string, status: string): Promise<GatewayConnection>;
}
