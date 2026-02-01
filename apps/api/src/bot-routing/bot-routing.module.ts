import { Module, forwardRef } from "@nestjs/common";
import { BotRoutingController } from "./bot-routing.controller";
import { BotRoutingService } from "./bot-routing.service";
import { BotDelegationService } from "./bot-delegation.service";
import { BotInstancesModule } from "../bot-instances/bot-instances.module";
import { TracesModule } from "../traces/traces.module";

@Module({
  imports: [forwardRef(() => BotInstancesModule), TracesModule],
  controllers: [BotRoutingController],
  providers: [BotRoutingService, BotDelegationService],
  exports: [BotRoutingService, BotDelegationService],
})
export class BotRoutingModule {}
