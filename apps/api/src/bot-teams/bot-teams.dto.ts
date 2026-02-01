import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNotEmpty,
} from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// ---------------------------------------------------------------------------
// Create DTO
// ---------------------------------------------------------------------------

export class CreateBotTeamMemberDto {
  @ApiProperty({ description: "Owner bot instance ID (the team lead)" })
  @IsString()
  @IsNotEmpty()
  ownerBotId: string;

  @ApiProperty({ description: "Member bot instance ID (the specialist)" })
  @IsString()
  @IsNotEmpty()
  memberBotId: string;

  @ApiProperty({ description: "Role label, e.g. 'Marketing Expert'" })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({ description: "What this team member does" })
  @IsString()
  @IsNotEmpty()
  description: string;
}

// ---------------------------------------------------------------------------
// Update DTO
// ---------------------------------------------------------------------------

export class UpdateBotTeamMemberDto {
  @ApiPropertyOptional({ description: "Role label" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  role?: string;

  @ApiPropertyOptional({ description: "What this team member does" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiPropertyOptional({ description: "Whether the team member is enabled" })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Query DTO
// ---------------------------------------------------------------------------

export class DelegateTaskDto {
  @ApiProperty({ description: "Source bot instance ID (the delegator)" })
  @IsString()
  @IsNotEmpty()
  sourceBotId: string;

  @ApiProperty({ description: "Target bot name (the team member to delegate to)" })
  @IsString()
  @IsNotEmpty()
  targetBotName: string;

  @ApiProperty({ description: "Message / task to delegate" })
  @IsString()
  @IsNotEmpty()
  message: string;
}

// ---------------------------------------------------------------------------
// Query DTO
// ---------------------------------------------------------------------------

export class BotTeamQueryDto {
  @ApiPropertyOptional({ description: "Filter by owner bot ID" })
  @IsOptional()
  @IsString()
  ownerBotId?: string;

  @ApiPropertyOptional({ description: "Filter by member bot ID" })
  @IsOptional()
  @IsString()
  memberBotId?: string;

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
