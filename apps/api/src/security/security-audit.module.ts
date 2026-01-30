import { Module } from "@nestjs/common";
import { OpenClawSecurityAuditService } from "./security-audit.service";
import { SecurityAuditController } from "./security-audit.controller";

@Module({
  controllers: [SecurityAuditController],
  providers: [OpenClawSecurityAuditService],
  exports: [OpenClawSecurityAuditService],
})
export class SecurityAuditModule {}
