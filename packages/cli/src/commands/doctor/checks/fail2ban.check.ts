/**
 * fail2ban Check
 *
 * Checks fail2ban installation and status (Linux only).
 */

import type { IDoctorCheck, CheckResult, CheckContext } from "./check.interface";

export class Fail2banCheck implements IDoctorCheck {
  readonly id = "fail2ban";
  readonly name = "fail2ban";
  readonly securityOnly = true;
  readonly platforms: NodeJS.Platform[] = ["linux"];

  async execute(context: CheckContext): Promise<CheckResult> {
    if (context.platform !== "linux") {
      return {
        name: this.name,
        status: "skip",
        message: "Not a Linux system",
      };
    }

    // Check if fail2ban service is active
    try {
      const status = context.shell
        .exec("systemctl is-active fail2ban", { stdio: "pipe" })
        .trim();

      if (status === "active") {
        return {
          name: this.name,
          status: "pass",
          message: "fail2ban is installed and active",
        };
      }

      return {
        name: this.name,
        status: "warn",
        message: `fail2ban is installed but not active (status: ${status})`,
        fix: "Run: sudo systemctl enable --now fail2ban",
      };
    } catch {
      // Check if fail2ban is installed at all
      try {
        context.shell.exec("which fail2ban-server", { stdio: "pipe" });

        return {
          name: this.name,
          status: "warn",
          message: "fail2ban is installed but not running",
          fix: "Run: sudo systemctl enable --now fail2ban",
        };
      } catch {
        return {
          name: this.name,
          status: "warn",
          message: "fail2ban is not installed — recommended for SSH protection",
          fix: "Run: sudo apt install fail2ban && sudo systemctl enable --now fail2ban",
        };
      }
    }
  }
}
