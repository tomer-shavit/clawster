/**
 * Display Utilities
 *
 * Shared display formatting functions.
 */

import chalk from "chalk";

export type StatusLevel =
  | "pass"
  | "fail"
  | "warn"
  | "skip"
  | "available"
  | "not-installed"
  | "unavailable"
  | "unsupported";

/**
 * Get status icon for a given status level.
 */
export function getStatusIcon(status: StatusLevel): string {
  switch (status) {
    case "pass":
    case "available":
      return chalk.green("✓");
    case "fail":
    case "unavailable":
    case "unsupported":
      return chalk.red("✗");
    case "warn":
    case "not-installed":
      return chalk.yellow("⚠");
    case "skip":
      return chalk.gray("—");
    default:
      return chalk.gray("?");
  }
}

/**
 * Get color function for a given status level.
 */
export function getStatusColor(
  status: StatusLevel
): (text: string) => string {
  switch (status) {
    case "pass":
    case "available":
      return chalk.green;
    case "fail":
    case "unavailable":
    case "unsupported":
      return chalk.red;
    case "warn":
    case "not-installed":
      return chalk.yellow;
    case "skip":
      return chalk.gray;
    default:
      return chalk.gray;
  }
}

/**
 * Format a status line with icon, name, and message.
 */
export function formatStatusLine(
  status: StatusLevel,
  name: string,
  message: string
): string {
  const icon = getStatusIcon(status);
  const color = getStatusColor(status);
  return `${icon} ${name}: ${color(message)}`;
}

/**
 * Format duration in human-readable format.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}
