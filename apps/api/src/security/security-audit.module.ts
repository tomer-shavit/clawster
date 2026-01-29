import { Module } from "@nestjs/common";
import { MoltbotSecurityAuditService } from "./security-audit.service";
import { SecurityAuditController } from "./security-audit.controller";

@Module({
  controllers: [SecurityAuditController],
  providers: [MoltbotSecurityAuditService],
  exports: [MoltbotSecurityAuditService],
})
export class SecurityAuditModule {}
