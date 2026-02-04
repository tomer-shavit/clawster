/**
 * Check Runner
 *
 * Orchestrates check execution and result display.
 */

import type { CheckResult, CheckContext } from "./checks/check.interface";
import type { CheckRegistry } from "./check-registry";
import type { IOutputService } from "../../interfaces/output.interface";
import type { IFileSystemService } from "../../interfaces/filesystem.interface";
import type { IShellService } from "../../interfaces/shell.interface";

export interface DoctorOptions {
  security?: boolean;
}

export class CheckRunner {
  constructor(
    private readonly registry: CheckRegistry,
    private readonly output: IOutputService,
    private readonly filesystem: IFileSystemService,
    private readonly shell: IShellService
  ) {}

  /**
   * Run all applicable checks.
   */
  async runAll(options: DoctorOptions): Promise<CheckResult[]> {
    const context = this.createContext();
    const securityOnly = options.security === true;

    // Get checks to run based on mode
    const checks = securityOnly
      ? this.registry.getSecurityChecks(context.platform)
      : this.registry.getAllChecks(context.platform);

    const results: CheckResult[] = [];

    for (const check of checks) {
      // Skip non-security checks if in security-only mode
      if (securityOnly && !check.securityOnly) {
        continue;
      }

      const result = await check.execute(context);
      results.push(result);
    }

    return results;
  }

  /**
   * Run a single check by ID.
   */
  async runSingle(checkId: string): Promise<CheckResult | null> {
    const check = this.registry.getCheck(checkId);
    if (!check) {
      return null;
    }

    const context = this.createContext();
    return check.execute(context);
  }

  /**
   * Display check results.
   */
  displayResults(results: CheckResult[], securityOnly: boolean): void {
    const passCount = results.filter((c) => c.status === "pass").length;
    const failCount = results.filter((c) => c.status === "fail").length;
    const warnCount = results.filter((c) => c.status === "warn").length;

    this.output.newline();

    // Display each result
    for (const result of results) {
      this.output.statusLine(result.status, result.name, result.message);

      if (result.fix && (securityOnly || result.status !== "pass")) {
        this.output.fixSuggestion(result.fix);
      }
    }

    this.output.newline();

    // Summary
    if (failCount === 0 && warnCount === 0) {
      this.output.success("✓ All checks passed!");
    } else {
      const parts: string[] = [`${passCount} passed`];
      if (failCount > 0) {
        parts.push(`${failCount} failed`);
      }
      if (warnCount > 0) {
        parts.push(`${warnCount} warnings`);
      }
      this.output.log(`Summary: ${parts.join(", ")}`);

      if (failCount > 0) {
        this.output.newline();
        this.output.error("Please fix the failed checks before continuing.");
      }
    }

    this.output.newline();
  }

  /**
   * Get summary statistics.
   */
  getSummary(results: CheckResult[]): {
    pass: number;
    fail: number;
    warn: number;
    skip: number;
  } {
    return {
      pass: results.filter((r) => r.status === "pass").length,
      fail: results.filter((r) => r.status === "fail").length,
      warn: results.filter((r) => r.status === "warn").length,
      skip: results.filter((r) => r.status === "skip").length,
    };
  }

  private createContext(): CheckContext {
    const homeDir = this.filesystem.homedir();
    return {
      platform: this.shell.getPlatform(),
      homeDir,
      clawsterDir: this.filesystem.join(homeDir, ".clawster"),
      filesystem: this.filesystem,
      shell: this.shell,
    };
  }
}
