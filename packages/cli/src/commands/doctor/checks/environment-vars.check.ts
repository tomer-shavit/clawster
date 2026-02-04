/**
 * Environment Variables Check
 *
 * Verifies required environment variables are set.
 */

import type { IDoctorCheck, CheckResult, CheckContext } from "./check.interface";

export class EnvironmentVarsCheck implements IDoctorCheck {
  readonly id = "environment-vars";
  readonly name = "Environment variables";
  readonly securityOnly = false;

  private readonly requiredVars = ["DATABASE_URL"];

  async execute(_context: CheckContext): Promise<CheckResult> {
    const missingVars = this.requiredVars.filter((v) => !process.env[v]);

    if (missingVars.length === 0) {
      return {
        name: this.name,
        status: "pass",
        message: "Required variables set",
      };
    }

    return {
      name: this.name,
      status: "warn",
      message: `Missing: ${missingVars.join(", ")}`,
      fix: "Source your workspace .env file or set the variables",
    };
  }
}
