import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  ValidateNested,
  IsEnum,
  Matches,
} from "class-validator";
import { Type } from "class-transformer";

// =============================================================================
// Identity DTO
// =============================================================================

export class IdentityDto {
  @ApiProperty({ description: "Display name for the bot" })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: "Emoji representation" })
  @IsOptional()
  @IsString()
  emoji?: string;

  @ApiPropertyOptional({ description: "Creature type" })
  @IsOptional()
  @IsString()
  creature?: string;

  @ApiPropertyOptional({ description: "Vibe/personality description" })
  @IsOptional()
  @IsString()
  vibe?: string;

  @ApiPropertyOptional({ description: "Visual theme" })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiPropertyOptional({ description: "Avatar URL or data URI" })
  @IsOptional()
  @IsString()
  avatar?: string;
}

// =============================================================================
// Cron Job DTOs
// =============================================================================

export class CronScheduleDto {
  @ApiProperty({ description: "Schedule kind: at, every, or cron", enum: ["at", "every", "cron"] })
  @IsEnum(["at", "every", "cron"])
  kind!: "at" | "every" | "cron";

  @ApiPropertyOptional({ description: "ISO timestamp for 'at' kind" })
  @IsOptional()
  @IsString()
  at?: string;

  @ApiPropertyOptional({ description: "Interval in milliseconds for 'every' kind" })
  @IsOptional()
  everyMs?: number;

  @ApiPropertyOptional({ description: "Cron expression for 'cron' kind" })
  @IsOptional()
  @IsString()
  expr?: string;

  @ApiPropertyOptional({ description: "Timezone for cron expression" })
  @IsOptional()
  @IsString()
  tz?: string;
}

export class CronPayloadDto {
  @ApiProperty({ description: "Payload kind: systemEvent or agentTurn", enum: ["systemEvent", "agentTurn"] })
  @IsEnum(["systemEvent", "agentTurn"])
  kind!: "systemEvent" | "agentTurn";

  @ApiPropertyOptional({ description: "Text for systemEvent" })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ description: "Message for agentTurn" })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: "Model override for agentTurn" })
  @IsOptional()
  @IsString()
  model?: string;
}

export class CronJobDto {
  @ApiProperty({ description: "Job name" })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: "Job description" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: "Schedule configuration" })
  @ValidateNested()
  @Type(() => CronScheduleDto)
  schedule!: CronScheduleDto;

  @ApiProperty({ description: "Payload configuration" })
  @ValidateNested()
  @Type(() => CronPayloadDto)
  payload!: CronPayloadDto;

  @ApiPropertyOptional({ description: "Whether job is enabled", default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

// =============================================================================
// Required Secret DTO
// =============================================================================

export class RequiredSecretDto {
  @ApiProperty({ description: "Secret key identifier" })
  @IsString()
  key!: string;

  @ApiProperty({ description: "Human-readable label" })
  @IsString()
  label!: string;

  @ApiPropertyOptional({ description: "Secret description" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: "Config path to inject secret" })
  @IsString()
  configPath!: string;
}

// =============================================================================
// Create Template DTO
// =============================================================================

export class CreatePersonaTemplateDto {
  @ApiProperty({ description: "Template name" })
  @IsString()
  name!: string;

  @ApiProperty({ description: "Template description" })
  @IsString()
  description!: string;

  @ApiProperty({
    description: "Template category",
    enum: ["marketing", "devops", "support", "assistant", "research", "creative", "custom"],
  })
  @IsEnum(["marketing", "devops", "support", "assistant", "research", "creative", "custom"])
  category!: string;

  @ApiPropertyOptional({ description: "Tags for discovery", type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: "Identity configuration" })
  @IsOptional()
  @ValidateNested()
  @Type(() => IdentityDto)
  identity?: IdentityDto;

  @ApiPropertyOptional({ description: "Soul/personality content (markdown)" })
  @IsOptional()
  @IsString()
  soul?: string;

  @ApiPropertyOptional({ description: "Skills to enable", type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ description: "Cron jobs", type: [CronJobDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CronJobDto)
  cronJobs?: CronJobDto[];

  @ApiPropertyOptional({ description: "Config patches to apply" })
  @IsOptional()
  @IsObject()
  configPatches?: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Required secrets", type: [RequiredSecretDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequiredSecretDto)
  requiredSecrets?: RequiredSecretDto[];
}

// =============================================================================
// Inject Template DTO
// =============================================================================

export class InjectTemplateDto {
  @ApiPropertyOptional({ description: "Secret values keyed by secret key" })
  @IsOptional()
  @IsObject()
  secrets?: Record<string, string>;
}

// =============================================================================
// Response DTOs
// =============================================================================

export class PersonaTemplateResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  version!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  category!: string;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiPropertyOptional()
  identity?: IdentityDto;

  @ApiPropertyOptional()
  soul?: string;

  @ApiProperty({ type: [String] })
  skills!: string[];

  @ApiProperty({ type: [CronJobDto] })
  cronJobs!: CronJobDto[];

  @ApiPropertyOptional()
  configPatches?: Record<string, unknown>;

  @ApiProperty({ type: [RequiredSecretDto] })
  requiredSecrets!: RequiredSecretDto[];

  @ApiProperty()
  isBuiltin!: boolean;

  @ApiPropertyOptional()
  workspaceId?: string;

  @ApiPropertyOptional()
  createdAt?: Date;

  @ApiPropertyOptional()
  updatedAt?: Date;
}

export class InjectionResultDto {
  @ApiProperty()
  success!: boolean;

  @ApiPropertyOptional()
  snapshotId?: string;

  @ApiProperty({ type: [String] })
  cronJobIds!: string[];

  @ApiPropertyOptional()
  error?: string;
}

export class RollbackResultDto {
  @ApiProperty()
  success!: boolean;

  @ApiPropertyOptional()
  error?: string;
}

export class InjectionStatusDto {
  @ApiProperty()
  instanceId!: string;

  @ApiPropertyOptional()
  templateId?: string;

  @ApiPropertyOptional()
  templateVersion?: string;

  @ApiProperty({ enum: ["none", "pending", "in_progress", "completed", "failed", "rolled_back"] })
  status!: string;

  @ApiPropertyOptional()
  snapshotId?: string;

  @ApiPropertyOptional()
  injectedAt?: Date;

  @ApiProperty()
  cronJobCount!: number;
}
