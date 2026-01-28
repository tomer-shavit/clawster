import { IsString, IsEnum, IsBoolean, IsOptional, IsNumber, ValidateNested, IsArray, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PolicyType } from '@prisma/client';

class CostLimitRuleDto {
  @IsNumber()
  @Min(0)
  maxCost: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  period?: 'daily' | 'weekly' | 'monthly';
}

class TokenLimitRuleDto {
  @IsNumber()
  @Min(1)
  maxTokens: number;

  @IsString()
  @IsOptional()
  period?: 'per_request' | 'daily' | 'monthly';
}

class RateLimitRuleDto {
  @IsNumber()
  @Min(1)
  maxRequests: number;

  @IsNumber()
  @Min(1)
  windowSeconds: number;
}

class TimeWindowRuleDto {
  @IsString()
  startTime: string; // HH:MM format

  @IsString()
  endTime: string; // HH:MM format

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  daysOfWeek?: string[];
}

class CustomRuleDto {
  @IsString()
  name: string;

  @IsObject()
  parameters: Record<string, any>;
}

import { IsObject } from 'class-validator';

export class CreatePolicyDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PolicyType)
  type: PolicyType;

  @ValidateNested()
  @Type(({ object }) => {
    switch (object.type) {
      case 'COST_LIMIT':
        return CostLimitRuleDto;
      case 'TOKEN_LIMIT':
        return TokenLimitRuleDto;
      case 'RATE_LIMIT':
        return RateLimitRuleDto;
      case 'TIME_WINDOW':
        return TimeWindowRuleDto;
      case 'CUSTOM':
        return CustomRuleDto;
      default:
        return Object;
    }
  })
  rules: CostLimitRuleDto | TokenLimitRuleDto | RateLimitRuleDto | TimeWindowRuleDto | CustomRuleDto;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
