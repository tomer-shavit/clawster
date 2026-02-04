/**
 * @clawster/database
 *
 * Database package providing repository interfaces, Prisma implementations,
 * and NestJS integration for the Clawster platform.
 *
 * @example NestJS usage
 * ```typescript
 * import { DatabaseModule, BOT_INSTANCE_REPOSITORY, IBotInstanceRepository } from "@clawster/database";
 *
 * // In app.module.ts
 * @Module({
 *   imports: [DatabaseModule.forRoot()],
 * })
 * export class AppModule {}
 *
 * // In service
 * @Injectable()
 * export class BotService {
 *   constructor(
 *     @Inject(BOT_INSTANCE_REPOSITORY) private readonly botRepo: IBotInstanceRepository
 *   ) {}
 * }
 * ```
 *
 * @example Non-NestJS usage (CLI, scripts)
 * ```typescript
 * import { PrismaClient } from "@prisma/client";
 * import { createRepositories } from "@clawster/database";
 *
 * const prisma = new PrismaClient();
 * const repos = createRepositories(prisma);
 * const bots = await repos.botInstance.findByWorkspace("ws-id");
 * ```
 */

// Re-export Prisma types for consumers
export * from "@prisma/client";

// Repository interfaces (contracts)
export * from "./interfaces";

// Repository implementations (Prisma-backed)
export * from "./repositories";

// NestJS integration (module, tokens)
export * from "./nestjs";
