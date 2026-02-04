import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";
export * from "./repositories";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Factory function for creating repositories with DI
export function createRepositories(client: PrismaClient = prisma) {
  const { BotInstanceRepository, FleetRepository } = require('./repositories');
  return {
    botInstance: new BotInstanceRepository(client),
    fleet: new FleetRepository(client),
  };
}
