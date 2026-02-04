import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import {
  ROUTING_REPOSITORY,
  IRoutingRepository,
  BOT_INSTANCE_REPOSITORY,
  IBotInstanceRepository,
} from "@clawster/database";
import type {
  CreateBotRoutingRuleDto,
  UpdateBotRoutingRuleDto,
  RoutingRuleQueryDto,
} from "./bot-routing.dto";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class BotRoutingService {
  private readonly logger = new Logger(BotRoutingService.name);

  constructor(
    @Inject(ROUTING_REPOSITORY) private readonly routingRepo: IRoutingRepository,
    @Inject(BOT_INSTANCE_REPOSITORY) private readonly botInstanceRepo: IBotInstanceRepository,
  ) {}

  // ---- Create --------------------------------------------------------------

  async create(workspaceId: string, dto: CreateBotRoutingRuleDto) {
    // Validate that both bots exist and belong to the workspace
    const [sourceBot, targetBot] = await Promise.all([
      this.botInstanceRepo.findById(dto.sourceBotId),
      this.botInstanceRepo.findById(dto.targetBotId),
    ]);

    if (!sourceBot || sourceBot.workspaceId !== workspaceId) {
      throw new BadRequestException(
        `Source bot ${dto.sourceBotId} not found in workspace`,
      );
    }
    if (!targetBot || targetBot.workspaceId !== workspaceId) {
      throw new BadRequestException(
        `Target bot ${dto.targetBotId} not found in workspace`,
      );
    }

    const rule = await this.routingRepo.createRoutingRule({
      workspace: { connect: { id: workspaceId } },
      sourceBot: { connect: { id: dto.sourceBotId } },
      targetBot: { connect: { id: dto.targetBotId } },
      triggerPattern: dto.triggerPattern,
      description: dto.description,
      priority: dto.priority ?? 0,
      enabled: dto.enabled ?? true,
    });

    return this.routingRepo.findRoutingRuleById(rule.id);
  }

  // ---- List ----------------------------------------------------------------

  async findAll(workspaceId: string, query: RoutingRuleQueryDto) {
    return this.routingRepo.findRoutingRulesByWorkspace(workspaceId, {
      sourceBotId: query.sourceBotId,
      targetBotId: query.targetBotId,
      enabled: query.enabled,
    });
  }

  // ---- Find one ------------------------------------------------------------

  async findOne(id: string) {
    const rule = await this.routingRepo.findRoutingRuleById(id);

    if (!rule) {
      throw new NotFoundException(`Routing rule ${id} not found`);
    }

    return rule;
  }

  // ---- Update --------------------------------------------------------------

  async update(id: string, dto: UpdateBotRoutingRuleDto) {
    await this.findOne(id); // ensure exists

    await this.routingRepo.updateRoutingRule(id, {
      ...(dto.sourceBotId !== undefined && { sourceBot: { connect: { id: dto.sourceBotId } } }),
      ...(dto.targetBotId !== undefined && { targetBot: { connect: { id: dto.targetBotId } } }),
      ...(dto.triggerPattern !== undefined && { triggerPattern: dto.triggerPattern }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.enabled !== undefined && { enabled: dto.enabled }),
    });

    return this.routingRepo.findRoutingRuleById(id);
  }

  // ---- Remove --------------------------------------------------------------

  async remove(id: string) {
    await this.findOne(id); // ensure exists

    await this.routingRepo.deleteRoutingRule(id);
  }

  // ---- Find matching rules for delegation ----------------------------------

  /**
   * Find enabled rules for a given source bot where the message matches the
   * triggerPattern (tested as a regex). Results are ordered by priority desc.
   */
  async findMatchingRules(sourceBotId: string, message: string) {
    const rules = await this.routingRepo.findRoutingRulesBySource(sourceBotId);

    return rules.filter((rule) => {
      try {
        const regex = new RegExp(rule.triggerPattern, "i");
        return regex.test(message);
      } catch (err) {
        this.logger.warn(
          `Invalid regex pattern "${rule.triggerPattern}" in rule ${rule.id}: ${err}`,
        );
        return false;
      }
    });
  }
}
