/**
 * Output Service Implementation
 *
 * Wraps chalk and ora for console output and spinners.
 */

import chalk from "chalk";
import ora, { type Ora } from "ora";
import type { IOutputService } from "../interfaces/output.interface";

export class OutputService implements IOutputService {
  private spinner: Ora | null = null;

  // Basic output levels
  info(message: string): void {
    console.log(chalk.blue(message));
  }

  success(message: string): void {
    console.log(chalk.green(message));
  }

  warn(message: string): void {
    console.log(chalk.yellow(message));
  }

  error(message: string): void {
    console.log(chalk.red(message));
  }

  dim(message: string): void {
    console.log(chalk.gray(message));
  }

  log(message: string): void {
    console.log(message);
  }

  // Styled output
  bold(message: string): void {
    console.log(chalk.bold(message));
  }

  cyan(message: string): void {
    console.log(chalk.cyan(message));
  }

  yellow(message: string): void {
    console.log(chalk.yellow(message));
  }

  green(message: string): void {
    console.log(chalk.green(message));
  }

  red(message: string): void {
    console.log(chalk.red(message));
  }

  gray(message: string): void {
    console.log(chalk.gray(message));
  }

  // Structured output
  header(title: string, emoji?: string): void {
    const prefix = emoji ? `${emoji} ` : "";
    console.log(chalk.blue.bold(`${prefix}${title}`));
  }

  subheader(title: string): void {
    console.log(chalk.white.bold(title));
  }

  list(items: string[], indent = 0): void {
    const padding = "  ".repeat(indent);
    for (const item of items) {
      console.log(`${padding}${item}`);
    }
  }

  newline(): void {
    console.log();
  }

  // Progress indicators (spinner)
  startSpinner(message: string): void {
    this.spinner = ora(message).start();
  }

  updateSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  succeedSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    }
  }

  failSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    }
  }

  warnSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.warn(message);
      this.spinner = null;
    }
  }

  stopSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  // Status display
  statusLine(
    status: "pass" | "fail" | "warn" | "skip",
    name: string,
    message: string
  ): void {
    const icon = this.getStatusIcon(status);
    const color = this.getStatusColor(status);
    console.log(`${icon} ${name}: ${color(message)}`);
  }

  fixSuggestion(fix: string): void {
    console.log(chalk.gray(`   Fix: ${fix}`));
  }

  private getStatusIcon(status: "pass" | "fail" | "warn" | "skip"): string {
    switch (status) {
      case "pass":
        return chalk.green("✓");
      case "fail":
        return chalk.red("✗");
      case "warn":
        return chalk.yellow("⚠");
      case "skip":
        return chalk.gray("—");
    }
  }

  private getStatusColor(
    status: "pass" | "fail" | "warn" | "skip"
  ): (text: string) => string {
    switch (status) {
      case "pass":
        return chalk.green;
      case "fail":
        return chalk.red;
      case "warn":
        return chalk.yellow;
      case "skip":
        return chalk.gray;
    }
  }
}
