/**
 * Database Command Handler
 *
 * Placeholder commands that direct users to proper tools.
 */

import type { IOutputService } from "../../interfaces/output.interface";

export class DbHandler {
  constructor(private readonly output: IOutputService) {}

  /**
   * Start database command.
   */
  async start(): Promise<void> {
    this.output.info("Starting database...");
    this.output.yellow(
      "Use 'docker-compose up -d postgres' in your workspace directory"
    );
  }

  /**
   * Migrate database command.
   */
  async migrate(): Promise<void> {
    this.output.info("Running migrations...");
    this.output.yellow("Run: pnpm db:migrate");
  }

  /**
   * Check database status command.
   */
  async status(): Promise<void> {
    this.output.info("Checking database...");
  }
}

/**
 * Factory function.
 */
export function createDbHandler(output: IOutputService): DbHandler {
  return new DbHandler(output);
}
