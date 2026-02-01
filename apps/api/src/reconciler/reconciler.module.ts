import { Module } from "@nestjs/common";
import { ReconcilerService } from "./reconciler.service";
import { ReconcilerController } from "./reconciler.controller";
import { ConfigGeneratorService } from "./config-generator.service";
import { LifecycleManagerService } from "./lifecycle-manager.service";
import { DriftDetectionService } from "./drift-detection.service";
import { DelegationSkillWriterService } from "./delegation-skill-writer.service";
import { DelegationSkillGeneratorService } from "../bot-teams/delegation-skill-generator.service";
import { ReconcilerScheduler } from "./reconciler.scheduler";
import { SecurityAuditModule } from "../security/security-audit.module";
import { ProvisioningModule } from "../provisioning/provisioning.module";

@Module({
  imports: [SecurityAuditModule, ProvisioningModule],
  controllers: [ReconcilerController],
  providers: [
    ConfigGeneratorService,
    LifecycleManagerService,
    DriftDetectionService,
    DelegationSkillWriterService,
    DelegationSkillGeneratorService,
    ReconcilerService,
    ReconcilerScheduler,
  ],
  exports: [
    ReconcilerService,
    ConfigGeneratorService,
    LifecycleManagerService,
    DriftDetectionService,
  ],
})
export class ReconcilerModule {}
