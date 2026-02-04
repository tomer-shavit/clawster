/**
 * pnpm Check
 *
 * Verifies pnpm is installed.
 */

import type { IDoctorCheck, CheckResult, CheckContext } from "./check.interface";

export class PnpmCheck implements IDoctorCheck {
  readonly id = "pnpm";
  readonly name = "pnpm";
  readonly securityOnly = false;

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const version = context.shell.exec("pnpm --version", { stdio: "pipe" }).trim();

      return {
        name: this.name,
        status: "pass",
        message: version,
      };
    } catch {
      return {
        name: this.name,
        status: "warn",
        message: "Not installed",
        fix: "Install pnpm: npm install -g pnpm",
      };
    }
  }
}
