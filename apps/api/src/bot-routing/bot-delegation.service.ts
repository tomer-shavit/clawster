import { Injectable, Inject, Logger, forwardRef } from "@nestjs/common";
import { BotRoutingService } from "./bot-routing.service";
import { BotInstancesService } from "../bot-instances/bot-instances.service";
import { TracesService } from "../traces/traces.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DelegationResult {
  delegated: true;
  targetBotId: string;
  targetBotName: string;
  response: string | undefined;
  traceId: string;
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class BotDelegationService {
  private readonly logger = new Logger(BotDelegationService.name);

  constructor(
    private readonly routingService: BotRoutingService,
    @Inject(forwardRef(() => BotInstancesService))
    private readonly botInstancesService: BotInstancesService,
    private readonly tracesService: TracesService,
  ) {}

  /**
   * Attempt to delegate an inbound message from `sourceBotId` to a target bot
   * based on the routing rules configured for the workspace.
   *
   * Returns `null` when no routing rule matches (i.e. the source bot should
   * handle the message itself). Otherwise sends the message to the
   * highest-priority target bot, creates an audit trace, and returns the
   * delegation result.
   */
  async attemptDelegation(
    sourceBotId: string,
    message: string,
    sessionId?: string,
  ): Promise<DelegationResult | null> {
    // 1. Find matching routing rules (already ordered by priority desc)
    const matchingRules = await this.routingService.findMatchingRules(
      sourceBotId,
      message,
    );

    if (matchingRules.length === 0) {
      return null; // no delegation needed
    }

    // 2. Pick the highest-priority rule (first in the list)
    const rule = matchingRules[0];

    this.logger.log(
      `Delegating message from bot "${rule.sourceBot.name}" (${rule.sourceBotId}) ` +
        `to bot "${rule.targetBot.name}" (${rule.targetBotId}) — ` +
        `rule ${rule.id}, pattern "${rule.triggerPattern}"`,
    );

    // 3. Create a trace *before* calling the target so we capture timing even on failure
    const traceId = crypto.randomUUID();
    const trace = await this.tracesService.create({
      botInstanceId: sourceBotId,
      traceId,
      name: `delegation:${rule.sourceBot.name}->${rule.targetBot.name}`,
      type: "TASK",
      status: "PENDING",
      startedAt: new Date(),
      input: {
        sourceBotId: rule.sourceBotId,
        sourceBotName: rule.sourceBot.name,
        targetBotId: rule.targetBotId,
        targetBotName: rule.targetBot.name,
        triggerPattern: rule.triggerPattern,
        ruleId: rule.id,
        message,
      },
      metadata: {
        delegationType: "delegation",
        ruleDescription: rule.description,
        rulePriority: rule.priority,
      },
    });

    // 4. Send the message to the target bot
    try {
      const chatResult = await this.botInstancesService.chat(
        rule.targetBotId,
        message,
        sessionId,
      );

      // 5. Complete the trace with the response
      await this.tracesService.complete(trace.id, {
        response: chatResult.response,
        sessionId: chatResult.sessionId,
        status: chatResult.status,
      });

      return {
        delegated: true,
        targetBotId: rule.targetBotId,
        targetBotName: rule.targetBot.name,
        response: chatResult.response,
        traceId,
        sessionId: chatResult.sessionId,
      };
    } catch (error) {
      // 6. Record failure in the trace
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.tracesService.fail(trace.id, {
        error: errorMessage,
        targetBotId: rule.targetBotId,
        targetBotName: rule.targetBot.name,
      });

      this.logger.error(
        `Delegation to bot "${rule.targetBot.name}" (${rule.targetBotId}) failed: ${errorMessage}`,
      );

      // Re-throw so the caller can decide how to handle it
      throw error;
    }
  }
}
