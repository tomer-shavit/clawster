import { Module } from "@nestjs/common";
import { A2aModule } from "../a2a/a2a.module";
import { BotTeamsController } from "./bot-teams.controller";
import { BotTeamsService } from "./bot-teams.service";

@Module({
  imports: [A2aModule],
  controllers: [BotTeamsController],
  providers: [BotTeamsService],
  exports: [BotTeamsService],
})
export class BotTeamsModule {}
