import { Controller, Post, Body, Get, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsString, MinLength, MaxLength } from "class-validator";
import { AuthService, LoginCredentials, RegisterCredentials } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { Public } from "./public.decorator";

class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

class RegisterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  // Role is NOT allowed in public registration - always defaults to VIEWER
  // Admin users can promote roles via a separate admin endpoint
}

class AuthResponse {
  accessToken!: string;
  expiresIn!: number;
  user!: {
    id: string;
    username: string;
    role: string;
  };
}

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post("login")
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // Rate limit: 10 login attempts per minute
  @ApiOperation({ summary: "Login with username and password" })
  @ApiResponse({ status: 200, description: "Login successful", type: AuthResponse })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  @ApiResponse({ status: 429, description: "Too many login attempts" })
  async login(@Body() credentials: LoginDto): Promise<AuthResponse> {
    return this.authService.login(credentials);
  }

  @Public()
  @Post("register")
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // Stricter rate limit: 5 registrations per minute
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({ status: 201, description: "User created", type: AuthResponse })
  @ApiResponse({ status: 400, description: "Username already exists" })
  @ApiResponse({ status: 429, description: "Too many registration attempts" })
  async register(@Body() credentials: RegisterDto): Promise<AuthResponse> {
    // Public registration always creates VIEWER role - no privilege escalation
    const result = await this.authService.register({
      ...credentials,
      role: "VIEWER",
    });
    // Auto-login after registration
    return this.authService.login({
      username: credentials.username,
      password: credentials.password,
    });
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user info" })
  @ApiResponse({ status: 200, description: "Current user info" })
  getProfile(@Request() req: { user: { userId: string; username: string; role: string } }) {
    return req.user;
  }
}
