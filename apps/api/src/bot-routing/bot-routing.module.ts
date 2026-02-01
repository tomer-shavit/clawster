import { Module } from "@nestjs/common";
import { BotRoutingController } from "./bot-routing.controller";
import { BotRoutingService } from "./bot-routing.service";
import { BotDelegationService } from "./bot-delegation.service";
import { A2aModule } from "../a2a/a2a.module";
import { TracesModule } from "../traces/traces.module";

@Module({
  imports: [A2aModule, TracesModule],
  controllers: [BotRoutingController],
  providers: [BotRoutingService, BotDelegationService],
  exports: [BotRoutingService, BotDelegationService],
})
export class BotRoutingModule {}
