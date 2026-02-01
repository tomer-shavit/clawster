import {
  IsOptional,
  IsString,
  IsBoolean,
  IsIn,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

// ---------------------------------------------------------------------------
// Notification Channel DTOs
// ---------------------------------------------------------------------------

export class CreateNotificationChannelDto {
  @ApiProperty({ description: "Channel display name" })
  @IsString()
  name: string;

  @ApiProperty({
    description: "Channel type",
    enum: ["SLACK_WEBHOOK", "WEBHOOK", "EMAIL"],
  })
  @IsString()
  @IsIn(["SLACK_WEBHOOK", "WEBHOOK", "EMAIL"])
  type: string;

  @ApiProperty({
    description: "Type-specific configuration as JSON string",
  })
  @IsString()
  config: string;

  @ApiPropertyOptional({ description: "Whether the channel is enabled", default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  enabled?: boolean;
}

export class UpdateNotificationChannelDto {
  @ApiPropertyOptional({ description: "Channel display name" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: "Channel type",
    enum: ["SLACK_WEBHOOK", "WEBHOOK", "EMAIL"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["SLACK_WEBHOOK", "WEBHOOK", "EMAIL"])
  type?: string;

  @ApiPropertyOptional({
    description: "Type-specific configuration as JSON string",
  })
  @IsOptional()
  @IsString()
  config?: string;

  @ApiPropertyOptional({ description: "Whether the channel is enabled" })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Notification Rule DTOs
// ---------------------------------------------------------------------------

export class CreateNotificationRuleDto {
  @ApiProperty({ description: "Notification channel ID" })
  @IsString()
  channelId: string;

  @ApiPropertyOptional({
    description: "JSON array of severities to match, e.g. [\"CRITICAL\",\"ERROR\"]",
  })
  @IsOptional()
  @IsString()
  severities?: string;

  @ApiPropertyOptional({
    description: "JSON array of alert rule names to match, e.g. [\"token_spike\"]",
  })
  @IsOptional()
  @IsString()
  alertRules?: string;

  @ApiPropertyOptional({ description: "Whether the rule is enabled", default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  enabled?: boolean;
}

export class UpdateNotificationRuleDto {
  @ApiPropertyOptional({
    description: "JSON array of severities to match",
  })
  @IsOptional()
  @IsString()
  severities?: string;

  @ApiPropertyOptional({
    description: "JSON array of alert rule names to match",
  })
  @IsOptional()
  @IsString()
  alertRules?: string;

  @ApiPropertyOptional({ description: "Whether the rule is enabled" })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Query DTO
// ---------------------------------------------------------------------------

export class NotificationChannelQueryDto {
  @ApiPropertyOptional({
    description: "Filter by type",
    enum: ["SLACK_WEBHOOK", "WEBHOOK", "EMAIL"],
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: "Filter by enabled status" })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  enabled?: boolean;
}
