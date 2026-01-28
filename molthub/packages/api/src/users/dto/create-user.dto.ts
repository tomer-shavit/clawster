import { IsEmail, IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;
}
