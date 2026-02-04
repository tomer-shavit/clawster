/**
 * SSH Permissions Check
 *
 * Validates SSH key file permissions (Unix only).
 */

import type { IDoctorCheck, CheckResult, CheckContext } from "./check.interface";

export class SshPermissionsCheck implements IDoctorCheck {
  readonly id = "ssh-permissions";
  readonly name = "SSH key permissions";
  readonly securityOnly = true;
  readonly platforms: NodeJS.Platform[] = ["linux", "darwin"];

  async execute(context: CheckContext): Promise<CheckResult> {
    if (context.platform === "win32") {
      return {
        name: this.name,
        status: "skip",
        message: "Not applicable on Windows",
      };
    }

    const sshDir = context.filesystem.join(context.homeDir, ".ssh");

    if (!(await context.filesystem.pathExists(sshDir))) {
      return {
        name: this.name,
        status: "skip",
        message: "No SSH directory found (not applicable)",
      };
    }

    try {
      const sshFiles = await context.filesystem.readDir(sshDir);
      const badPerms: string[] = [];

      for (const file of sshFiles) {
        const filePath = context.filesystem.join(sshDir, file);

        try {
          const stat = await context.filesystem.stat(filePath);
          if (!stat.isFile()) continue;

          const mode = (stat.mode & 0o777).toString(8);

          if (file.endsWith(".pub")) {
            // Public keys should be 644 or stricter
            if (stat.mode & 0o022) {
              badPerms.push(`${file} (${mode}, expected 644 or stricter)`);
            }
          } else if (
            !file.startsWith("known_hosts") &&
            !file.startsWith("config") &&
            !file.startsWith("authorized_keys")
          ) {
            // Private keys should be 600
            if (stat.mode & 0o077) {
              badPerms.push(`${file} (${mode}, expected 600)`);
            }
          }
        } catch {
          // Skip files we can't stat
        }
      }

      if (badPerms.length === 0) {
        return {
          name: this.name,
          status: "pass",
          message: "All SSH key files have correct permissions",
        };
      }

      return {
        name: this.name,
        status: "warn",
        message: `SSH key files have overly permissive modes: ${badPerms.join(", ")}`,
        fix: "Run: chmod 600 ~/.ssh/<private-key> && chmod 644 ~/.ssh/<key>.pub",
      };
    } catch {
      return {
        name: this.name,
        status: "warn",
        message: "Could not read SSH directory",
      };
    }
  }
}
