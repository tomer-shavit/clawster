/**
 * Doctor Command Handler
 *
 * Thin handler that wires components for the doctor command.
 */

import type { IOutputService } from "../../interfaces/output.interface";
import type { IFileSystemService } from "../../interfaces/filesystem.interface";
import type { IShellService } from "../../interfaces/shell.interface";
import { CheckRegistry } from "./check-registry";
import { CheckRunner, type DoctorOptions } from "./check-runner";

export class DoctorHandler {
  private readonly runner: CheckRunner;

  constructor(
    private readonly output: IOutputService,
    filesystem: IFileSystemService,
    shell: IShellService
  ) {
    const registry = new CheckRegistry();
    this.runner = new CheckRunner(registry, output, filesystem, shell);
  }

  /**
   * Execute the doctor command.
   */
  async execute(options: DoctorOptions = {}): Promise<void> {
    const securityOnly = options.security === true;

    // Display header
    if (securityOnly) {
      this.output.header("Clawster Security Doctor", "🔒");
      this.output.newline();
      this.output.dim("Running security-focused diagnostics...");
    } else {
      this.output.header("Clawster Doctor", "🔧");
      this.output.newline();
      this.output.dim("Diagnosing common issues...");
    }
    this.output.newline();

    // Run checks with spinner
    this.output.startSpinner(
      securityOnly ? "Running security checks..." : "Running diagnostics..."
    );

    const results = await this.runner.runAll(options);

    this.output.stopSpinner();

    // Display results
    this.runner.displayResults(results, securityOnly);

    // Exit with error code if there are failures
    const summary = this.runner.getSummary(results);
    if (summary.fail > 0) {
      process.exit(1);
    }
  }
}

/**
 * Factory function for creating doctor handler with services.
 */
export function createDoctorHandler(
  output: IOutputService,
  filesystem: IFileSystemService,
  shell: IShellService
): DoctorHandler {
  return new DoctorHandler(output, filesystem, shell);
}
