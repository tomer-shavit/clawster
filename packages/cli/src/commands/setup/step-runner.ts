/**
 * Step Runner
 *
 * Orchestrates setup step execution.
 */

import type {
  ISetupStep,
  StepResult,
  SetupContext,
} from "./steps/step.interface";

export class StepRunner {
  constructor(private readonly steps: ISetupStep[]) {
    // Sort steps by order
    this.steps.sort((a, b) => a.order - b.order);
  }

  /**
   * Run all steps in order.
   */
  async runAll(context: SetupContext): Promise<Map<string, StepResult>> {
    const results = new Map<string, StepResult>();

    for (const step of this.steps) {
      // Check if step should be skipped
      if (step.shouldSkip) {
        const shouldSkip = await step.shouldSkip(context);
        if (shouldSkip) {
          results.set(step.id, {
            success: true,
            message: "Skipped",
            skipReason: "Step condition not met",
          });
          continue;
        }
      }

      // Execute the step
      const result = await this.runStep(step, context);
      results.set(step.id, result);

      // Stop if a required step fails
      if (!result.success && !step.skippable) {
        break;
      }
    }

    return results;
  }

  /**
   * Run a single step.
   */
  async runStep(step: ISetupStep, context: SetupContext): Promise<StepResult> {
    try {
      return await step.execute(context);
    } catch (error) {
      const err = error as Error;
      return {
        success: false,
        message: err.message ?? "Unknown error",
      };
    }
  }

  /**
   * Get steps in order.
   */
  getSteps(): ISetupStep[] {
    return [...this.steps];
  }
}
