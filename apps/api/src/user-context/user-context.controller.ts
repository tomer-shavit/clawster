import { Controller, Get, Inject, Req } from "@nestjs/common";
import { Request as ExpressRequest } from "express";
import { PrismaClient, PRISMA_CLIENT } from "@clawster/database";
import { UserContextService } from "./user-context.service";

@Controller("user-context")
export class UserContextController {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    private readonly userContextService: UserContextService,
  ) {}

  @Get()
  async getUserContext(@Req() req: ExpressRequest) {
    // Single-tenant: grab the first workspace (same pattern as OnboardingService.deploy).
    // TODO: scope to authenticated user's workspace once multi-tenant auth lands.
    let workspace = await this.prisma.workspace.findFirst();
    if (!workspace) {
      // No workspace yet — return empty stage
      return {
        agentCount: 0,
        hasFleets: false,
        hasTeams: false,
        stage: "empty" as const,
      };
    }

    return this.userContextService.getUserContext(workspace.id);
  }
}
