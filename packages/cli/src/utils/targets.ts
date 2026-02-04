/**
 * Deployment Target Utilities
 *
 * Shared functions for displaying deployment targets.
 */

import chalk from "chalk";
import type { IOutputService } from "../interfaces/output.interface";

export interface TargetInfo {
  name: string;
  description: string;
  status: "ready" | "beta" | "coming-soon";
}

/**
 * Format target status badge.
 */
export function formatTargetStatus(status: TargetInfo["status"]): {
  icon: string;
  label: string;
} {
  switch (status) {
    case "ready":
      return { icon: chalk.green("✓"), label: chalk.green("Ready") };
    case "beta":
      return { icon: chalk.yellow("β"), label: chalk.yellow("Beta") };
    case "coming-soon":
      return { icon: chalk.gray("○"), label: chalk.gray("Coming Soon") };
  }
}

/**
 * Display a list of deployment targets.
 */
export function displayTargetList(
  output: IOutputService,
  targets: TargetInfo[],
  options?: { showDescription?: boolean }
): void {
  const showDescription = options?.showDescription ?? true;

  for (const target of targets) {
    const { icon } = formatTargetStatus(target.status);
    output.log(`  ${icon} ${chalk.cyan(target.name)}`);

    if (showDescription) {
      output.dim(`      ${target.description}`);
    }
  }
}

/**
 * Get deployment targets from the factory.
 */
export function getDeploymentTargets(): TargetInfo[] {
  // Dynamic import to avoid circular dependencies
  const { DeploymentTargetFactory } = require("@clawster/cloud-providers");
  return DeploymentTargetFactory.getAvailableTargets();
}
