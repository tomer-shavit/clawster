import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiParam } from "@nestjs/swagger";
import { BotRoutingService } from "./bot-routing.service";
import { BotDelegationService } from "./bot-delegation.service";
import {
  CreateBotRoutingRuleDto,
  UpdateBotRoutingRuleDto,
  RoutingRuleQueryDto,
  DelegateRequestDto,
} from "./bot-routing.dto";

// Hardcoded workspace ID for now (same pattern used across the API)
const WORKSPACE_ID = "default";

@ApiTags("bot-routing-rules")
@Controller("bot-routing-rules")
export class BotRoutingController {
  constructor(
    private readonly botRoutingService: BotRoutingService,
    private readonly botDelegationService: BotDelegationService,
  ) {}

  // ---- List ----------------------------------------------------------------

  @Get()
  @ApiOperation({ summary: "List routing rules with optional filters" })
  async findAll(@Query() query: RoutingRuleQueryDto) {
    return this.botRoutingService.findAll(WORKSPACE_ID, query);
  }

  // ---- Delegate ------------------------------------------------------------

  @Post("delegate")
  @ApiOperation({
    summary: "Trigger delegation for a message from a source bot",
  })
  async delegate(@Body() dto: DelegateRequestDto) {
    const result = await this.botDelegationService.attemptDelegation(
      dto.sourceBotId,
      dto.message,
      dto.sessionId,
    );

    if (!result) {
      throw new NotFoundException(
        `No matching routing rule found for source bot "${dto.sourceBotId}"`,
      );
    }

    return result;
  }

  // ---- Create --------------------------------------------------------------

  @Post()
  @ApiOperation({ summary: "Create a new routing rule" })
  async create(@Body() dto: CreateBotRoutingRuleDto) {
    return this.botRoutingService.create(WORKSPACE_ID, dto);
  }

  // ---- Get one -------------------------------------------------------------

  @Get(":id")
  @ApiOperation({ summary: "Get a routing rule by ID" })
  @ApiParam({ name: "id", description: "Routing rule ID" })
  async findOne(@Param("id") id: string) {
    return this.botRoutingService.findOne(id);
  }

  // ---- Update --------------------------------------------------------------

  @Patch(":id")
  @ApiOperation({ summary: "Update a routing rule" })
  @ApiParam({ name: "id", description: "Routing rule ID" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateBotRoutingRuleDto,
  ) {
    return this.botRoutingService.update(id, dto);
  }

  // ---- Delete --------------------------------------------------------------

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a routing rule" })
  @ApiParam({ name: "id", description: "Routing rule ID" })
  async remove(@Param("id") id: string) {
    await this.botRoutingService.remove(id);
  }
}
