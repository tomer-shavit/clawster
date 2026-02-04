/**
 * AWS Credentials Check
 *
 * Validates AWS CLI installation and credentials if AWS is configured.
 */

import type { IDoctorCheck, CheckResult, CheckContext } from "./check.interface";

export class AwsCredentialsCheck implements IDoctorCheck {
  readonly id = "aws-credentials";
  readonly name = "AWS credentials";
  readonly securityOnly = false;

  async execute(context: CheckContext): Promise<CheckResult> {
    // Check if AWS is configured
    const awsConfigPath = context.filesystem.join(context.clawsterDir, ".aws");
    const hasAwsConfig =
      (await context.filesystem.pathExists(awsConfigPath)) ||
      !!process.env.AWS_ACCESS_KEY_ID;

    if (!hasAwsConfig) {
      // Skip if AWS is not configured
      return {
        name: this.name,
        status: "skip",
        message: "AWS not configured (optional)",
      };
    }

    // Check AWS CLI
    try {
      context.shell.exec("aws --version", { stdio: "pipe" });
    } catch {
      return {
        name: "AWS CLI",
        status: "fail",
        message: "Not installed",
        fix: "Install AWS CLI from https://aws.amazon.com/cli",
      };
    }

    // Check credentials validity
    try {
      context.shell.exec("aws sts get-caller-identity", { stdio: "pipe" });

      return {
        name: this.name,
        status: "pass",
        message: "Configured and valid",
      };
    } catch {
      return {
        name: this.name,
        status: "fail",
        message: "Invalid or expired",
        fix: "Run 'aws configure' or check your AWS credentials",
      };
    }
  }
}
