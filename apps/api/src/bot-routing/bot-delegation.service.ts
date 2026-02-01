import { Injectable, Logger } from "@nestjs/common";
import { BotRoutingService } from "./bot-routing.service";
import { A2aMessageService } from "../a2a/a2a-message.service";
import { TracesService } from "../traces/traces.service";
import type { A2aTask, TextPart } from "../a2a/a2a.types";
import * as crypto from "crypto";

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
    private readonly a2aMessageService: A2aMessageService,
    private readonly tracesService: TracesService,
  ) {}

  /**
   * Attempt to delegate an inbound message from `sourceBotId` to a target bot
   * based on the routing rules configured for the workspace.
   *
   * Returns `null` when no routing rule matches (i.e. the source bot should
   * handle the message itself). Otherwise sends the message to the
   * highest-priority target bot via A2A, creates an audit trace, and returns
   * the delegation result.
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

    // 4. Send the message to the target bot via A2A
    try {
      const a2aTask = await this.a2aMessageService.sendMessage(
        rule.targetBotId,
        {
          message: {
            messageId: crypto.randomUUID(),
            role: "user",
            parts: [{ text: message }],
            contextId: sessionId || undefined,
          },
        },
        { parentTraceId: traceId },
      );

      // 5. Extract response text from A2A task
      const responseText = this.extractA2aResponse(a2aTask);
      const resolvedSessionId = a2aTask.contextId;

      if (a2aTask.status.state === "completed") {
        await this.tracesService.complete(trace.id, {
          response: responseText,
          a2aTaskId: a2aTask.id,
          a2aContextId: a2aTask.contextId,
          status: a2aTask.status.state,
        });

        return {
          delegated: true,
          targetBotId: rule.targetBotId,
          targetBotName: rule.targetBot.name,
          response: responseText,
          traceId,
          sessionId: resolvedSessionId,
        };
      } else {
        const errorMsg =
          responseText || `A2A task ended with state: ${a2aTask.status.state}`;
        await this.tracesService.fail(trace.id, {
          error: errorMsg,
          a2aTaskId: a2aTask.id,
          a2aState: a2aTask.status.state,
        });
        throw new Error(
          `Delegation to "${rule.targetBot.name}" failed: ${errorMsg}`,
        );
      }
    } catch (error) {
      // 6. Record failure in the trace (if not already recorded above)
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Only fail trace if it hasn't been failed already in the block above
      if (trace.status === "PENDING") {
        await this.tracesService.fail(trace.id, {
          error: errorMessage,
          targetBotId: rule.targetBotId,
          targetBotName: rule.targetBot.name,
        });
      }

      this.logger.error(
        `Delegation to bot "${rule.targetBot.name}" (${rule.targetBotId}) failed: ${errorMessage}`,
      );

      // Re-throw so the caller can decide how to handle it
      throw error;
    }
  }

  private extractA2aResponse(
    task: A2aTask,
  ): string | undefined {
    const msg = task.status.message;
    if (!msg) return undefined;
    const texts = msg.parts
      .filter((p): p is TextPart => "text" in p)
      .map((p) => p.text);
    return texts.length > 0 ? texts.join("\n") : undefined;
  }
}
