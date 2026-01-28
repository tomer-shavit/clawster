import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from "@nestjs/common";
import { ChannelsService } from "./channels.service";
import {
  CreateChannelDto,
  UpdateChannelDto,
  ListChannelsQueryDto,
  TestChannelDto,
  BindChannelToBotDto,
  UpdateBindingDto,
  SendTestMessageDto,
} from "./channels.dto";
import { CommunicationChannel, BotChannelBinding } from "@molthub/database";

@Controller("channels")
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  // ==========================================
  // Channel Management
  // ==========================================

  @Post()
  create(@Body() dto: CreateChannelDto): Promise<CommunicationChannel> {
    return this.channelsService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListChannelsQueryDto): Promise<CommunicationChannel[]> {
    return this.channelsService.findAll(query);
  }

  @Get("types")
  getChannelTypes(): { type: string; label: string; requiredFields: string[] }[] {
    return this.channelsService.getChannelTypes();
  }

  @Get(":id")
  findOne(@Param("id") id: string): Promise<any> {
    return this.channelsService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateChannelDto): Promise<CommunicationChannel> {
    return this.channelsService.update(id, dto);
  }

  @Post(":id/test")
  testConnection(@Param("id") id: string, @Body() dto: TestChannelDto): Promise<any> {
    return this.channelsService.testConnection(id, dto);
  }

  @Post(":id/test-message")
  sendTestMessage(@Param("id") id: string, @Body() dto: SendTestMessageDto): Promise<any> {
    return this.channelsService.sendTestMessage(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string): Promise<void> {
    await this.channelsService.remove(id);
  }

  // ==========================================
  // Bot Channel Bindings
  // ==========================================

  @Post(":id/bind")
  bindToBot(
    @Param("id") channelId: string,
    @Body() dto: BindChannelToBotDto
  ): Promise<BotChannelBinding> {
    return this.channelsService.bindToBot(channelId, dto);
  }

  @Delete(":id/bind/:bindingId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async unbindFromBot(@Param("bindingId") bindingId: string): Promise<void> {
    await this.channelsService.unbindFromBot(bindingId);
  }

  @Patch(":id/bind/:bindingId")
  updateBinding(
    @Param("bindingId") bindingId: string,
    @Body() dto: UpdateBindingDto
  ): Promise<BotChannelBinding> {
    return this.channelsService.updateBinding(bindingId, dto);
  }

  // ==========================================
  // Monitoring
  // ==========================================

  @Get(":id/stats")
  getChannelStats(@Param("id") id: string): Promise<any> {
    return this.channelsService.getChannelStats(id);
  }

  @Get(":id/bots")
  getBoundBots(@Param("id") id: string): Promise<any[]> {
    return this.channelsService.getBoundBots(id);
  }

  @Get("bot/:botId/channels")
  getBotChannels(@Param("botId") botId: string): Promise<any[]> {
    return this.channelsService.getBotChannels(botId);
  }

  @Post("bot/:botId/health-check")
  async checkBotChannelsHealth(@Param("botId") botId: string): Promise<any> {
    return this.channelsService.checkBotChannelsHealth(botId);
  }
}
