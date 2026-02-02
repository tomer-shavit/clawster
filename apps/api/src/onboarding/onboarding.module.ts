import { Module } from "@nestjs/common";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";
import { ReconcilerModule } from "../reconciler/reconciler.module";
import { ConnectorsModule } from "../connectors/connectors.module";

@Module({
  imports: [ReconcilerModule, ConnectorsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
