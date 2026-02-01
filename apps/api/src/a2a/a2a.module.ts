import { Module } from "@nestjs/common";
import { TracesModule } from "../traces/traces.module";
import { A2aController } from "./a2a.controller";
import { A2aAgentCardService } from "./a2a-agent-card.service";
import { A2aMessageService } from "./a2a-message.service";
import { A2aApiKeyService } from "./a2a-api-key.service";
import { A2aTaskService } from "./a2a-task.service";
import { A2aApiKeyGuard } from "./a2a-api-key.guard";
import { A2aStreamingService } from "./a2a-streaming.service";

@Module({
  imports: [TracesModule],
  controllers: [A2aController],
  providers: [A2aAgentCardService, A2aMessageService, A2aApiKeyService, A2aTaskService, A2aStreamingService, A2aApiKeyGuard],
  exports: [A2aAgentCardService, A2aMessageService, A2aApiKeyService, A2aTaskService, A2aStreamingService],
})
export class A2aModule {}
