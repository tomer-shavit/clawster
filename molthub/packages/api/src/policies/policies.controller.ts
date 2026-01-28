import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { PoliciesService } from './services/policies.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('policies')
@UseGuards(JwtAuthGuard)
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get()
  async findAll(@CurrentUser('userId') userId: string) {
    return this.policiesService.findAll(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.policiesService.findOne(id, userId);
  }

  @Post()
  async create(@Body() createPolicyDto: CreatePolicyDto, @CurrentUser('userId') userId: string) {
    return this.policiesService.create(createPolicyDto, userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePolicyDto: UpdatePolicyDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.policiesService.update(id, updatePolicyDto, userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.policiesService.remove(id, userId);
  }
}
