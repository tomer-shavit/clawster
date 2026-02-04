/**
 * Docker Socket Permissions Check
 *
 * Validates Docker socket has restricted permissions (Unix only).
 */

import type { IDoctorCheck, CheckResult, CheckContext } from "./check.interface";

export class DockerSocketCheck implements IDoctorCheck {
  readonly id = "docker-socket";
  readonly name = "Docker socket permissions";
  readonly securityOnly = true;
  readonly platforms: NodeJS.Platform[] = ["linux", "darwin"];

  private readonly dockerSocket = "/var/run/docker.sock";

  async execute(context: CheckContext): Promise<CheckResult> {
    if (context.platform === "win32") {
      return {
        name: this.name,
        status: "skip",
        message: "Not applicable on Windows",
      };
    }

    if (!(await context.filesystem.pathExists(this.dockerSocket))) {
      return {
        name: this.name,
        status: "skip",
        message: "Docker socket not found",
      };
    }

    try {
      const stat = await context.filesystem.stat(this.dockerSocket);
      const mode = stat.mode & 0o777;

      // Check if world-readable (others have read permission)
      if (mode & 0o004) {
        return {
          name: this.name,
          status: "warn",
          message: `Docker socket is world-readable (mode: ${mode.toString(8)})`,
          fix: "Run: sudo chmod 660 /var/run/docker.sock",
        };
      }

      return {
        name: this.name,
        status: "pass",
        message: "Docker socket has restricted permissions",
      };
    } catch {
      return {
        name: this.name,
        status: "pass",
        message: "Docker socket not accessible (restricted)",
      };
    }
  }
}
