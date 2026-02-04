/**
 * Open Browser Step
 *
 * Opens the browser to the Clawster dashboard.
 */

import type { ISetupStep, StepResult, SetupContext } from "./step.interface";

export class OpenBrowserStep implements ISetupStep {
  readonly id = "open-browser";
  readonly name = "Open browser";
  readonly order = 50;
  readonly skippable = true;

  async shouldSkip(context: SetupContext): Promise<boolean> {
    // Skip if servers weren't started
    if (!context.state.serversStarted) {
      return true;
    }

    if (context.options.skipOpen) {
      return true;
    }

    if (context.options.nonInteractive) {
      return false;
    }

    const shouldOpen = await context.prompts.confirm(
      `Open browser to http://localhost:${context.state.webPort}?`,
      true
    );

    return !shouldOpen;
  }

  async execute(context: SetupContext): Promise<StepResult> {
    const url = `http://localhost:${context.state.webPort}`;

    try {
      const open = (await import("open")).default;
      await open(url);
      context.output.dim(`  Opened browser to ${url}`);

      return {
        success: true,
        message: `Browser opened to ${url}`,
      };
    } catch {
      context.output.yellow("  Could not open browser automatically.");
      context.output.dim(`  Please open ${url} manually.`);

      return {
        success: true,
        message: "Could not open browser automatically",
      };
    }
  }
}
