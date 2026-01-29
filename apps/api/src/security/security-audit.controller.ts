import { Controller, Post, Get, Param, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import {
  MoltbotSecurityAuditService,
  SecurityAuditResult,
  SecurityFix,
  ApplyFixResult,
} from "./security-audit.service";

@ApiTags("security")
@Controller("security")
export class SecurityAuditController {
  constructor(private readonly securityAuditService: MoltbotSecurityAuditService) {}

  @Post("audit/:instanceId")
  @ApiOperation({ summary: "Run a security audit on a Moltbot instance" })
  @ApiResponse({ status: 200, description: "Audit completed successfully" })
  @ApiResponse({ status: 404, description: "Instance not found" })
  async runAudit(@Param("instanceId") id: string): Promise<SecurityAuditResult> {
    return this.securityAuditService.audit(id);
  }

  @Get("audit/:instanceId/fixes")
  @ApiOperation({ summary: "Get suggested fixes for audit findings" })
  @ApiResponse({ status: 200, description: "Fix suggestions returned" })
  @ApiResponse({ status: 404, description: "Instance not found" })
  async getFixes(@Param("instanceId") id: string): Promise<SecurityFix[]> {
    return this.securityAuditService.suggestFixes(id);
  }

  @Post("audit/:instanceId/fix")
  @ApiOperation({ summary: "Apply selected fixes to an instance" })
  @ApiResponse({ status: 200, description: "Fixes applied" })
  @ApiResponse({ status: 404, description: "Instance not found" })
  async applyFixes(
    @Param("instanceId") id: string,
    @Body() body: { fixIds: string[] },
  ): Promise<ApplyFixResult> {
    return this.securityAuditService.applyFixes(id, body.fixIds);
  }
}
