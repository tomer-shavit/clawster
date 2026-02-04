/**
 * Docker Check
 *
 * Verifies Docker is installed and accessible.
 */

import type { IDoctorCheck, CheckResult, CheckContext } from "./check.interface";

export class DockerCheck implements IDoctorCheck {
  readonly id = "docker";
  readonly name = "Docker";
  readonly securityOnly = false;

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const version = context.shell.exec("docker --version", { stdio: "pipe" }).trim();

      return {
        name: this.name,
        status: "pass",
        message: version.split("\n")[0],
      };
    } catch {
      return {
        name: this.name,
        status: "fail",
        message: "Not installed or not in PATH",
        fix: "Install Docker from https://docker.com",
      };
    }
  }
}
