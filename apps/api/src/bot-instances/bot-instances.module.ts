import { Module, forwardRef } from "@nestjs/common";
import { BotInstancesService } from "./bot-instances.service";
import { BotInstancesController } from "./bot-instances.controller";
import { ReconcilerModule } from "../reconciler/reconciler.module";
import { HealthModule } from "../health/health.module";
import { BotRoutingModule } from "../bot-routing/bot-routing.module";

@Module({
  imports: [ReconcilerModule, HealthModule, forwardRef(() => BotRoutingModule)],
  controllers: [BotInstancesController],
  providers: [BotInstancesService],
  exports: [BotInstancesService],
})
export class BotInstancesModule {}