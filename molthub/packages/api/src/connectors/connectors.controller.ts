import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ConnectorsService } from './services/connectors.service';
import { CreateConnectorDto } from './dto/create-connector.dto';
import { UpdateConnectorDto } from './dto/update-connector.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('connectors')
@UseGuards(JwtAuthGuard)
export class ConnectorsController {
  constructor(private readonly connectorsService: ConnectorsService) {}

  @Get()
  async findAll(@CurrentUser('userId') userId: string) {
    return this.connectorsService.findAll(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.connectorsService.findOne(id, userId);
  }

  @Post()
  async create(@Body() createConnectorDto: CreateConnectorDto, @CurrentUser('userId') userId: string) {
    return this.connectorsService.create(createConnectorDto, userId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateConnectorDto: UpdateConnectorDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.connectorsService.update(id, updateConnectorDto, userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.connectorsService.remove(id, userId);
  }
}
