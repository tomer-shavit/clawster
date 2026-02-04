/**
 * Plaintext Secrets Check
 *
 * Scans config files for potential plaintext secrets.
 */

import { glob } from "glob";
import type { IDoctorCheck, CheckResult, CheckContext } from "./check.interface";

export class PlaintextSecretsCheck implements IDoctorCheck {
  readonly id = "plaintext-secrets";
  readonly name = "Plaintext secrets detection";
  readonly securityOnly = true;

  private readonly secretPattern =
    /(?:token|secret|password|api[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/i;

  async execute(context: CheckContext): Promise<CheckResult> {
    try {
      const configGlobs = [
        context.filesystem.join(context.clawsterDir, "**", "*.json"),
        context.filesystem.join(context.clawsterDir, "**", "*.yaml"),
      ];

      const filesWithSecrets: string[] = [];

      for (const pattern of configGlobs) {
        const matchedFiles = await glob(pattern, { nodir: true });

        for (const file of matchedFiles) {
          try {
            const content = await context.filesystem.readFile(file);
            if (this.secretPattern.test(content)) {
              // Make path relative to home dir for cleaner output
              const relativePath = file.replace(context.homeDir, "~");
              filesWithSecrets.push(relativePath);
            }
          } catch {
            // Skip unreadable files
          }
        }
      }

      if (filesWithSecrets.length === 0) {
        return {
          name: this.name,
          status: "pass",
          message: "No plaintext secrets detected in config files",
        };
      }

      return {
        name: this.name,
        status: "warn",
        message: `Possible plaintext secrets found in: ${filesWithSecrets.join(", ")}`,
        fix: "Move secrets to environment variables or a secret manager",
      };
    } catch {
      return {
        name: this.name,
        status: "pass",
        message: "No config directory to scan",
      };
    }
  }
}
