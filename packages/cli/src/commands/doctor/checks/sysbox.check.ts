/**
 * Sysbox Check
 *
 * Checks Sysbox runtime availability for Docker sandbox support.
 */

import { detectSysboxCapability } from "@clawster/cloud-providers";
import type { IDoctorCheck, CheckResult, CheckContext } from "./check.interface";

export class SysboxCheck implements IDoctorCheck {
  readonly id = "sysbox";
  readonly name = "Sysbox runtime";
  readonly securityOnly = false;

  async execute(_context: CheckContext): Promise<CheckResult> {
    try {
      const capability = await detectSysboxCapability({ skipCache: true });

      if (capability.available === "available") {
        return {
          name: this.name,
          status: "pass",
          message: capability.version
            ? `Installed (${capability.version})`
            : "Installed",
        };
      }

      if (capability.available === "not-installed") {
        return {
          name: this.name,
          status: "warn",
          message: "Not installed — sandbox mode unavailable for local Docker",
          fix: capability.installCommand ?? "Run: clawster sysbox install",
        };
      }

      if (capability.available === "unavailable") {
        return {
          name: this.name,
          status: "skip",
          message: capability.reason ?? "Not available on this platform",
        };
      }

      return {
        name: this.name,
        status: "skip",
        message: "Not applicable for this deployment target",
      };
    } catch {
      return {
        name: this.name,
        status: "warn",
        message: "Could not detect Sysbox status",
        fix: "Run: clawster sysbox status",
      };
    }
  }
}
