import type { PrismaClient, BotInstance, Prisma } from '@prisma/client';
import { PrismaRepository } from './prisma-repository';
import type { IBotInstanceRepository } from './interfaces';

export class BotInstanceRepository
  extends PrismaRepository<BotInstance, Prisma.BotInstanceCreateInput, Prisma.BotInstanceUpdateInput>
  implements IBotInstanceRepository {

  constructor(prisma: PrismaClient) {
    super(prisma, 'botInstance');
  }

  async findByWorkspace(workspaceId: string): Promise<BotInstance[]> {
    return this.model.findMany({ where: { workspaceId } });
  }

  async findByFleet(fleetId: string): Promise<BotInstance[]> {
    return this.model.findMany({ where: { fleetId } });
  }

  async findByStatus(status: string): Promise<BotInstance[]> {
    return this.model.findMany({ where: { status } });
  }

  async findWithRelations(id: string): Promise<BotInstance | null> {
    return this.model.findUnique({
      where: { id },
      include: {
        fleet: true,
        workspace: true,
        gatewayConnection: true,
        channelBindings: { include: { channel: true } },
        skillPacks: { include: { skillPack: true } },
      },
    });
  }

  async updateStatus(id: string, status: string, health?: string): Promise<BotInstance> {
    return this.model.update({
      where: { id },
      data: { status, ...(health && { health }) },
    });
  }
}
