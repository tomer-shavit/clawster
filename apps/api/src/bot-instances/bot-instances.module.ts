import { Module } from "@nestjs/common";
import { BotInstancesService } from "./bot-instances.service";
import { BotInstancesController } from "./bot-instances.controller";
import { ReconcilerModule } from "../reconciler/reconciler.module";

@Module({
  imports: [ReconcilerModule],
  controllers: [BotInstancesController],
  providers: [BotInstancesService],
  exports: [BotInstancesService],
})
export class BotInstancesModule {}