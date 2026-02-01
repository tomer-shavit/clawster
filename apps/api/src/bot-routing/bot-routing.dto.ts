import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  IsNotEmpty,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// ---------------------------------------------------------------------------
// Create DTO
// ---------------------------------------------------------------------------

export class CreateBotRoutingRuleDto {
  @ApiProperty({ description: "Source bot instance ID" })
  @IsString()
  @IsNotEmpty()
  sourceBotId: string;

  @ApiProperty({ description: "Target bot instance ID" })
  @IsString()
  @IsNotEmpty()
  targetBotId: string;

  @ApiProperty({ description: "Regex pattern to match against messages" })
  @IsString()
  @IsNotEmpty()
  triggerPattern: string;

  @ApiProperty({ description: "Human-readable description of the rule" })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: "Priority (higher = evaluated first)", default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number = 0;

  @ApiPropertyOptional({ description: "Whether the rule is enabled", default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;
}

// ---------------------------------------------------------------------------
// Update DTO
// ---------------------------------------------------------------------------

export class UpdateBotRoutingRuleDto {
  @ApiPropertyOptional({ description: "Source bot instance ID" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sourceBotId?: string;

  @ApiPropertyOptional({ description: "Target bot instance ID" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  targetBotId?: string;

  @ApiPropertyOptional({ description: "Regex pattern to match against messages" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  triggerPattern?: string;

  @ApiPropertyOptional({ description: "Human-readable description of the rule" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiPropertyOptional({ description: "Priority (higher = evaluated first)" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ description: "Whether the rule is enabled" })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Delegate Request DTO
// ---------------------------------------------------------------------------

export class DelegateRequestDto {
  @ApiProperty({ description: "Source bot instance ID that received the message" })
  @IsString()
  @IsNotEmpty()
  sourceBotId: string;

  @ApiProperty({ description: "The message to delegate" })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: "Optional session ID for conversation continuity" })
  @IsOptional()
  @IsString()
  sessionId?: string;
}

// ---------------------------------------------------------------------------
// Query DTO
// ---------------------------------------------------------------------------

export class RoutingRuleQueryDto {
  @ApiPropertyOptional({ description: "Filter by source bot ID" })
  @IsOptional()
  @IsString()
  sourceBotId?: string;

  @ApiPropertyOptional({ description: "Filter by target bot ID" })
  @IsOptional()
  @IsString()
  targetBotId?: string;

  @ApiPropertyOptional({ description: "Filter by enabled status" })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  @IsBoolean()
  enabled?: boolean;
}
