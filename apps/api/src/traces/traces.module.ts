import { Module } from "@nestjs/common";
import { TracesService } from "./traces.service";
import { TracesController } from "./traces.controller";

@Module({
  controllers: [TracesController],
  providers: [TracesService],
  exports: [TracesService],
})
export class TracesModule {}