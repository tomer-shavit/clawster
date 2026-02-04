/**
 * Status Command Handler
 *
 * Displays deprecation notice and directs users to web UI.
 */

import type { IOutputService } from "../../interfaces/output.interface";
import { displayTargetList, getDeploymentTargets } from "../../utils/targets";

export interface StatusOptions {
  workspace?: string;
}

export class StatusHandler {
  constructor(private readonly output: IOutputService) {}

  /**
   * Execute the status command.
   */
  async execute(_options: StatusOptions = {}): Promise<void> {
    this.output.header("Clawster Status", "📊");
    this.output.newline();

    this.output.yellow("⚠  The CLI status command has been deprecated.");
    this.output.newline();

    this.output.log("Bot status monitoring is now available through the web UI:");
    this.output.newline();

    this.output.cyan("  1. Start Clawster:    pnpm dev");
    this.output.cyan("  2. Open browser:      http://localhost:3000");
    this.output.cyan("  3. View Dashboard:    Bot status, health, and logs");
    this.output.newline();

    this.output.log("Available deployment targets:");
    this.output.newline();

    const targets = getDeploymentTargets();
    displayTargetList(this.output, targets, { showDescription: false });

    this.output.newline();
    this.output.log("For local diagnostics, use:");
    this.output.cyan("  clawster doctor");
    this.output.newline();
  }
}

/**
 * Factory function for creating status handler.
 */
export function createStatusHandler(output: IOutputService): StatusHandler {
  return new StatusHandler(output);
}
