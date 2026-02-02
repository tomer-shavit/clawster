import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsBoolean, IsIn } from "class-validator";

export class UpdateAlertRuleConfigDto {
  @ApiPropertyOptional({ description: "Enable or disable this alert rule" })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: "Alert severity level",
    enum: ["CRITICAL", "ERROR", "WARNING", "INFO"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["CRITICAL", "ERROR", "WARNING", "INFO"])
  severity?: string;

  @ApiPropertyOptional({
    description: "Rule-specific thresholds as JSON string",
  })
  @IsOptional()
  @IsString()
  thresholds?: string;
}
