/**
 * Node Version Check
 *
 * Verifies Node.js version is 18 or higher.
 */

import type { IDoctorCheck, CheckResult, CheckContext } from "./check.interface";

export class NodeVersionCheck implements IDoctorCheck {
  readonly id = "node-version";
  readonly name = "Node.js version";
  readonly securityOnly = false;

  async execute(_context: CheckContext): Promise<CheckResult> {
    try {
      const version = process.version;
      const majorVersion = parseInt(version.slice(1).split(".")[0], 10);

      if (majorVersion >= 18) {
        return {
          name: this.name,
          status: "pass",
          message: version,
        };
      }

      return {
        name: this.name,
        status: "fail",
        message: `${version} (requires 18+)`,
        fix: "Upgrade Node.js to version 18 or higher",
      };
    } catch {
      return {
        name: this.name,
        status: "fail",
        message: "Could not determine version",
      };
    }
  }
}
