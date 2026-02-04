/**
 * Development Command Handler
 *
 * Placeholder commands that direct users to pnpm scripts.
 */

import type { IOutputService } from "../../interfaces/output.interface";

export class DevHandler {
  constructor(private readonly output: IOutputService) {}

  /**
   * Start API server command.
   */
  async api(): Promise<void> {
    this.output.info("Starting API server...");
    this.output.cyan("Run: pnpm dev --filter=@clawster/api");
  }

  /**
   * Start web UI command.
   */
  async web(): Promise<void> {
    this.output.info("Starting web UI...");
    this.output.cyan("Run: pnpm dev --filter=@clawster/web");
  }

  /**
   * Start all services command.
   */
  async all(): Promise<void> {
    this.output.info("Starting all services...");
    this.output.cyan("Run: pnpm dev");
  }
}

/**
 * Factory function.
 */
export function createDevHandler(output: IOutputService): DevHandler {
  return new DevHandler(output);
}
