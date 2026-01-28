import { IsString, IsEnum, IsBoolean, IsOptional, IsObject } from 'class-validator';
import { PolicyType } from '@prisma/client';

export class UpdatePolicyDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PolicyType)
  @IsOptional()
  type?: PolicyType;

  @IsObject()
  @IsOptional()
  rules?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
