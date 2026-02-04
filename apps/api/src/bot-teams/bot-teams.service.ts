import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import * as crypto from "crypto";
import {
  ROUTING_REPOSITORY,
  IRoutingRepository,
  BOT_INSTANCE_REPOSITORY,
  IBotInstanceRepository,
} from "@clawster/database";
import { A2aMessageService } from "../a2a/a2a-message.service";
import { A2aApiKeyService } from "../a2a/a2a-api-key.service";
import type {
  CreateBotTeamMemberDto,
  UpdateBotTeamMemberDto,
  BotTeamQueryDto,
  DelegateTaskDto,
} from "./bot-teams.dto";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class BotTeamsService {
  private readonly logger = new Logger(BotTeamsService.name);

  constructor(
    @Inject(ROUTING_REPOSITORY) private readonly routingRepo: IRoutingRepository,
    @Inject(BOT_INSTANCE_REPOSITORY) private readonly botInstanceRepo: IBotInstanceRepository,
    private readonly a2aMessageService: A2aMessageService,
    private readonly a2aApiKeyService: A2aApiKeyService,
  ) {}

  // ---- Create --------------------------------------------------------------

  async create(_workspaceId: string, dto: CreateBotTeamMemberDto) {
    if (dto.ownerBotId === dto.memberBotId) {
      throw new BadRequestException("A bot cannot be a member of its own team");
    }

    // Validate that both bots exist and belong to the same workspace
    const [ownerBot, memberBot] = await Promise.all([
      this.botInstanceRepo.findById(dto.ownerBotId),
      this.botInstanceRepo.findById(dto.memberBotId),
    ]);

    if (!ownerBot) {
      throw new BadRequestException(
        `Owner bot ${dto.ownerBotId} not found`,
      );
    }
    if (!memberBot) {
      throw new BadRequestException(
        `Member bot ${dto.memberBotId} not found`,
      );
    }
    if (ownerBot.workspaceId !== memberBot.workspaceId) {
      throw new BadRequestException(
        "Both bots must belong to the same workspace",
      );
    }

    const member = await this.routingRepo.createTeamMember({
      workspace: { connect: { id: ownerBot.workspaceId } },
      ownerBot: { connect: { id: dto.ownerBotId } },
      memberBot: { connect: { id: dto.memberBotId } },
      role: dto.role,
      description: dto.description,
    });

    return this.routingRepo.findTeamMemberById(member.id);
  }

  // ---- List ----------------------------------------------------------------

  async findAll(_workspaceId: string, query: BotTeamQueryDto) {
    const result = await this.routingRepo.findManyTeamMembers({
      ownerBotId: query.ownerBotId,
      memberBotId: query.memberBotId,
      enabled: query.enabled,
    });

    return result.data;
  }

  // ---- Find one ------------------------------------------------------------

  async findOne(id: string) {
    const member = await this.routingRepo.findTeamMemberById(id);

    if (!member) {
      throw new NotFoundException(`Team member ${id} not found`);
    }

    return member;
  }

  // ---- Update --------------------------------------------------------------

  async update(id: string, dto: UpdateBotTeamMemberDto) {
    await this.findOne(id); // ensure exists

    await this.routingRepo.updateTeamMember(id, {
      ...(dto.role !== undefined && { role: dto.role }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.enabled !== undefined && { enabled: dto.enabled }),
    });

    return this.routingRepo.findTeamMemberById(id);
  }

  // ---- Remove --------------------------------------------------------------

  async remove(id: string) {
    await this.findOne(id); // ensure exists

    await this.routingRepo.deleteTeamMember(id);
  }

  // ---- Delegate ------------------------------------------------------------

  async delegateToMember(
    dto: DelegateTaskDto,
    apiKey: string,
  ): Promise<{ success: boolean; response?: string; traceId?: string; error?: string }> {
    // 1. Validate API key
    const isValid = await this.a2aApiKeyService.validate(dto.sourceBotId, apiKey);
    if (!isValid) {
      throw new UnauthorizedException("Invalid API key for this bot");
    }

    // 2. Find team member relationship by owner and filter by member bot name
    const teamMembers = await this.routingRepo.findTeamMembersByOwner(dto.sourceBotId);
    const teamMember = teamMembers.find(
      (m) => m.memberBot?.name === dto.targetBotName
    );

    if (!teamMember || !teamMember.memberBot || !teamMember.ownerBot) {
      throw new BadRequestException(
        `No enabled team member "${dto.targetBotName}" found for this bot`,
      );
    }

    this.logger.log(
      `Delegation: "${teamMember.ownerBot.name}" → "${teamMember.memberBot.name}" — ${dto.message.slice(0, 100)}`,
    );

    // 3. Send via A2A
    try {
      const task = await this.a2aMessageService.sendMessage(
        teamMember.memberBotId,
        {
          message: {
            messageId: crypto.randomUUID(),
            role: "user",
            parts: [{ text: dto.message }],
          },
        },
        { parentTraceId: undefined },
      );

      // Extract response text
      const responseText = task.status.message?.parts
        ?.filter((p: any) => "text" in p)
        ?.map((p: any) => p.text)
        ?.join("\n");

      return {
        success: task.status.state === "completed",
        response: responseText,
        traceId: task.id,
        ...(task.status.state !== "completed" && { error: responseText || "Delegation failed" }),
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Delegation failed: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }
}
