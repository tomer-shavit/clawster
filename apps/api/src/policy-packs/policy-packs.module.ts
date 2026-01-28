import { Module } from "@nestjs/common";
import { PolicyPacksService } from "./policy-packs.service";
import { PolicyPacksController } from "./policy-packs.controller";

@Module({
  controllers: [PolicyPacksController],
  providers: [PolicyPacksService],
  exports: [PolicyPacksService],
})
export class PolicyPacksModule {}