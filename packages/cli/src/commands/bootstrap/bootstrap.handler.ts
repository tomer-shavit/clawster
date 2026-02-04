/**
 * Bootstrap Command Handler
 *
 * Displays deprecation notice and directs users to web UI.
 */

import type { IOutputService } from "../../interfaces/output.interface";
import { displayTargetList, getDeploymentTargets } from "../../utils/targets";

export interface BootstrapOptions {
  provider?: string;
  region?: string;
  workspace?: string;
  skipWizard?: boolean;
  yes?: boolean;
}

export class BootstrapHandler {
  constructor(private readonly output: IOutputService) {}

  /**
   * Execute the bootstrap command.
   */
  async execute(_options: BootstrapOptions = {}): Promise<void> {
    this.output.header("Clawster Bootstrap", "🚀");
    this.output.newline();

    this.output.yellow("⚠  The CLI bootstrap command has been deprecated.");
    this.output.newline();

    this.output.log("Infrastructure provisioning is now handled through the web UI:");
    this.output.newline();

    this.output.cyan("  1. Start Clawster:    pnpm dev");
    this.output.cyan("  2. Open browser:      http://localhost:3000");
    this.output.cyan("  3. Use Deploy Wizard: Create Bot → Select Platform");
    this.output.newline();

    this.output.log("Available deployment targets:");
    this.output.newline();

    const targets = getDeploymentTargets();
    displayTargetList(this.output, targets);

    this.output.newline();
    this.output.log("For local development, use:");
    this.output.cyan("  clawster setup");
    this.output.newline();
  }
}

/**
 * Factory function for creating bootstrap handler.
 */
export function createBootstrapHandler(output: IOutputService): BootstrapHandler {
  return new BootstrapHandler(output);
}
