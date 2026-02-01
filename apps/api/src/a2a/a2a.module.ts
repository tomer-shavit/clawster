import { Module } from "@nestjs/common";
import { A2aController } from "./a2a.controller";
import { A2aAgentCardService } from "./a2a-agent-card.service";

@Module({
  controllers: [A2aController],
  providers: [A2aAgentCardService],
  exports: [A2aAgentCardService],
})
export class A2aModule {}
