/**
 * Clawster Config Check
 *
 * Verifies workspace configurations in ~/.clawster directory.
 */

import type { IDoctorCheck, CheckResult, CheckContext } from "./check.interface";

export class ClawsterConfigCheck implements IDoctorCheck {
  readonly id = "clawster-config";
  readonly name = "Clawster configuration";
  readonly securityOnly = false;

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const configFiles = await context.filesystem.readDir(context.clawsterDir);
      const workspaceConfigs = configFiles.filter(
        (f) => f.endsWith(".json") && f !== "users.json"
      );

      if (workspaceConfigs.length === 0) {
        return {
          name: this.name,
          status: "warn",
          message: "No workspaces configured",
          fix: "Run 'clawster init' to set up a workspace",
        };
      }

      return {
        name: this.name,
        status: "pass",
        message: `${workspaceConfigs.length} workspace(s) configured`,
      };
    } catch {
      return {
        name: this.name,
        status: "warn",
        message: "No workspaces configured",
        fix: "Run 'clawster init' to set up a workspace",
      };
    }
  }
}

/**
 * Individual Workspace Config Check
 *
 * Validates a specific workspace configuration file.
 */
export class WorkspaceConfigCheck implements IDoctorCheck {
  readonly id: string;
  readonly name: string;
  readonly securityOnly = false;

  constructor(private readonly configFile: string) {
    this.id = `workspace-config-${configFile}`;
    this.name = `  └─ ${configFile.replace(".json", "")}`;
  }

  async execute(context: CheckContext): Promise<CheckResult> {
    const configPath = context.filesystem.join(context.clawsterDir, this.configFile);

    try {
      const config = await context.filesystem.readJson<{
        resources?: unknown;
        provider?: string;
        region?: string;
      }>(configPath);

      if (config.resources && config.provider) {
        return {
          name: this.name,
          status: "pass",
          message: `${config.provider} in ${config.region}`,
        };
      }

      return {
        name: this.name,
        status: "warn",
        message: "Incomplete configuration",
        fix: "Run 'clawster init' to reconfigure",
      };
    } catch {
      return {
        name: this.name,
        status: "fail",
        message: "Invalid JSON",
        fix: `Delete ${configPath} and reconfigure`,
      };
    }
  }
}
