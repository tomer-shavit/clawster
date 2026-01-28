import { IsString, IsEnum, IsBoolean, IsOptional, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ConnectorType } from '@prisma/client';

class OpenAIConfigDto {
  @IsString()
  apiKey: string;

  @IsString()
  @IsOptional()
  organizationId?: string;
}

class AnthropicConfigDto {
  @IsString()
  apiKey: string;
}

class AzureOpenAIConfigDto {
  @IsString()
  apiKey: string;

  @IsString()
  endpoint: string;

  @IsString()
  deploymentName: string;
}

class BedrockConfigDto {
  @IsString()
  accessKeyId: string;

  @IsString()
  secretAccessKey: string;

  @IsString()
  @IsOptional()
  region?: string;
}

class VertexAIConfigDto {
  @IsString()
  projectId: string;

  @IsString()
  credentials: string;
}

class CustomConfigDto {
  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  endpoint?: string;

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;
}

export class CreateConnectorDto {
  @IsString()
  name: string;

  @IsEnum(ConnectorType)
  type: ConnectorType;

  @IsObject()
  config: OpenAIConfigDto | AnthropicConfigDto | AzureOpenAIConfigDto | BedrockConfigDto | VertexAIConfigDto | CustomConfigDto;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
