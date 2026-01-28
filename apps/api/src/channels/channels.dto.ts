import { IsString, IsObject, IsOptional, IsBoolean, IsEnum, IsJSON } from "class-validator";
import { ChannelType, ChannelStatus } from "@molthub/database";

export class CreateChannelDto {
  @IsString()
  name: string;

  @IsString()
  workspaceId: string;

  @IsEnum(ChannelType)
  type: ChannelType;

  @IsObject()
  config: Record<string, any>;

  @IsObject()
  @IsOptional()
  defaults?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isShared?: boolean;

  @IsObject()
  @IsOptional()
  tags?: Record<string, any>;

  @IsString()
  @IsOptional()
  createdBy?: string;
}

export class UpdateChannelDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @IsObject()
  @IsOptional()
  defaults?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isShared?: boolean;

  @IsEnum(ChannelStatus)
  @IsOptional()
  status?: ChannelStatus;

  @IsObject()
  @IsOptional()
  tags?: Record<string, any>;
}

export class ListChannelsQueryDto {
  @IsString()
  workspaceId: string;

  @IsEnum(ChannelType)
  @IsOptional()
  type?: ChannelType;

  @IsEnum(ChannelStatus)
  @IsOptional()
  status?: ChannelStatus;
}

export class TestChannelDto {
  @IsObject()
  @IsOptional()
  config?: Record<string, any>;
}

export class SendTestMessageDto {
  @IsString()
  message: string;

  @IsObject()
  @IsOptional()
  targetDestination?: Record<string, any>;
}

export class BindChannelToBotDto {
  @IsString()
  botId: string;

  @IsString()
  purpose: string;

  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;

  @IsObject()
  @IsOptional()
  targetDestination?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateBindingDto {
  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;

  @IsObject()
  @IsOptional()
  targetDestination?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  purpose?: string;
}
