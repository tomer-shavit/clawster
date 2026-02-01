import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiParam } from "@nestjs/swagger";
import { Public } from "../auth/public.decorator";
import { A2aAgentCardService } from "./a2a-agent-card.service";

@ApiTags("a2a")
@Controller("a2a")
export class A2aController {
  constructor(
    private readonly agentCardService: A2aAgentCardService,
  ) {}

  @Get(":botInstanceId/agent-card")
  @Public()
  @ApiOperation({ summary: "Get A2A Agent Card for a bot instance" })
  @ApiParam({ name: "botInstanceId", description: "Bot instance ID" })
  async getAgentCard(@Param("botInstanceId") botInstanceId: string) {
    return this.agentCardService.generate(botInstanceId);
  }

  @Get(":botInstanceId/.well-known/agent")
  @Public()
  @ApiOperation({ summary: "A2A spec discovery endpoint (alias for agent-card)" })
  @ApiParam({ name: "botInstanceId", description: "Bot instance ID" })
  async getWellKnownAgent(@Param("botInstanceId") botInstanceId: string) {
    return this.agentCardService.generate(botInstanceId);
  }
}
