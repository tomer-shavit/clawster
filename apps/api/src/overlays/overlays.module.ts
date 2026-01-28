import { Module } from "@nestjs/common";
import { OverlaysService } from "./overlays.service";
import { OverlaysController } from "./overlays.controller";

@Module({
  controllers: [OverlaysController],
  providers: [OverlaysService],
  exports: [OverlaysService],
})
export class OverlaysModule {}