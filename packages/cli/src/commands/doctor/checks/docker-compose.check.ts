/**
 * Docker Compose Check
 *
 * Verifies Docker Compose plugin is installed.
 */

import type { IDoctorCheck, CheckResult, CheckContext } from "./check.interface";

export class DockerComposeCheck implements IDoctorCheck {
  readonly id = "docker-compose";
  readonly name = "Docker Compose";
  readonly securityOnly = false;

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      context.shell.exec("docker compose version", { stdio: "pipe" });

      return {
        name: this.name,
        status: "pass",
        message: "Installed",
      };
    } catch {
      return {
        name: this.name,
        status: "warn",
        message: "Plugin not found",
        fix: "Update Docker to include the Compose plugin",
      };
    }
  }
}
