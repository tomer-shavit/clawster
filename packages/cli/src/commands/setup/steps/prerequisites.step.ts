/**
 * Prerequisites Step
 *
 * Checks system prerequisites (Node.js, pnpm, Docker).
 */

import type { ISetupStep, StepResult, SetupContext } from "./step.interface";

interface PrerequisiteCheck {
  name: string;
  passed: boolean;
  message: string;
  fix?: string;
  optional?: boolean;
}

export class PrerequisitesStep implements ISetupStep {
  readonly id = "prerequisites";
  readonly name = "Check prerequisites";
  readonly order = 10;
  readonly skippable = false;

  async execute(context: SetupContext): Promise<StepResult> {
    const checks = await this.runChecks(context);
    this.displayResults(context, checks);

    const requiredChecks = checks.filter((c) => !c.optional);
    const allPassed = requiredChecks.every((c) => c.passed);

    context.state.prerequisitesPassed = allPassed;

    if (!allPassed) {
      return {
        success: false,
        message: "Please fix the issues above and run setup again.",
      };
    }

    return {
      success: true,
      message: "All prerequisites passed",
    };
  }

  private async runChecks(context: SetupContext): Promise<PrerequisiteCheck[]> {
    const checks: PrerequisiteCheck[] = [];

    // Check Node.js version (>= 18)
    const nodeVersion = process.versions.node;
    const majorVersion = parseInt(nodeVersion.split(".")[0], 10);
    checks.push({
      name: "Node.js 18+",
      passed: majorVersion >= 18,
      message: `v${nodeVersion}`,
      fix: "Install Node.js 18+ from https://nodejs.org",
    });

    // Check pnpm
    try {
      const pnpmVersion = context.shell.execWithEnv("pnpm --version").trim();
      checks.push({
        name: "pnpm",
        passed: true,
        message: `v${pnpmVersion}`,
      });
    } catch {
      checks.push({
        name: "pnpm",
        passed: false,
        message: "Not found",
        fix: "npm install -g pnpm",
      });
    }

    // Check Docker (optional)
    try {
      context.shell.exec("docker info", { stdio: "pipe" });
      checks.push({
        name: "Docker",
        passed: true,
        message: "Running",
        optional: true,
      });
    } catch {
      checks.push({
        name: "Docker",
        passed: true, // Optional, so we still pass
        message: "Not running (optional, needed for deploying OpenClaw instances)",
        optional: true,
      });
    }

    return checks;
  }

  private displayResults(
    context: SetupContext,
    checks: PrerequisiteCheck[]
  ): void {
    for (const check of checks) {
      const status = check.passed ? "pass" : "fail";
      const name = check.optional ? `${check.name} (optional)` : check.name;

      context.output.statusLine(status, name, check.message);

      if (!check.passed && check.fix) {
        context.output.fixSuggestion(check.fix);
      }
    }
  }
}
