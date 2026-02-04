import type { PrismaClient } from '@prisma/client';
import type { IRepository } from './interfaces';

export abstract class PrismaRepository<T, CreateInput, UpdateInput> implements IRepository<T, CreateInput, UpdateInput> {
  constructor(
    protected readonly prisma: PrismaClient,
    protected readonly modelName: string
  ) {}

  protected get model() {
    return (this.prisma as any)[this.modelName];
  }

  async findById(id: string): Promise<T | null> {
    return this.model.findUnique({ where: { id } });
  }

  async findMany(args?: { where?: object; orderBy?: object; take?: number; skip?: number }): Promise<T[]> {
    return this.model.findMany(args);
  }

  async create(data: CreateInput): Promise<T> {
    return this.model.create({ data });
  }

  async update(id: string, data: UpdateInput): Promise<T> {
    return this.model.update({ where: { id }, data });
  }

  async delete(id: string): Promise<T> {
    return this.model.delete({ where: { id } });
  }

  async count(where?: object): Promise<number> {
    return this.model.count({ where });
  }
}
