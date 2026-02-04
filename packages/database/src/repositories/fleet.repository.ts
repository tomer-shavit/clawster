import type { PrismaClient, Fleet, Prisma } from '@prisma/client';
import { PrismaRepository } from './prisma-repository';
import type { IFleetRepository } from './interfaces';

export class FleetRepository
  extends PrismaRepository<Fleet, Prisma.FleetCreateInput, Prisma.FleetUpdateInput>
  implements IFleetRepository {

  constructor(prisma: PrismaClient) {
    super(prisma, 'fleet');
  }

  async findByWorkspace(workspaceId: string): Promise<Fleet[]> {
    return this.model.findMany({ where: { workspaceId } });
  }

  async findWithInstances(id: string): Promise<Fleet | null> {
    return this.model.findUnique({
      where: { id },
      include: { instances: true },
    });
  }
}
