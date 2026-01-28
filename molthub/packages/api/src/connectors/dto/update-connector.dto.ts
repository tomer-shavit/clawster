import { IsString, IsEnum, IsBoolean, IsOptional, IsObject } from 'class-validator';
import { ConnectorType } from '@prisma/client';

export class UpdateConnectorDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(ConnectorType)
  @IsOptional()
  type?: ConnectorType;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
