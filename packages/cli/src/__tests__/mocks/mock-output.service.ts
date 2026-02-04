/**
 * Mock Output Service
 *
 * Captures output for testing assertions.
 */

import type { IOutputService } from "../../interfaces/output.interface";

export interface LogEntry {
  level: string;
  message: string;
  timestamp: Date;
}

export class MockOutputService implements IOutputService {
  readonly logs: LogEntry[] = [];
  private spinnerActive = false;
  private spinnerMessage = "";

  // Basic output levels
  info(message: string): void {
    this.log("info", message);
  }

  success(message: string): void {
    this.log("success", message);
  }

  warn(message: string): void {
    this.log("warn", message);
  }

  error(message: string): void {
    this.log("error", message);
  }

  dim(message: string): void {
    this.log("dim", message);
  }

  log(message: string): void;
  log(level: string, message: string): void;
  log(levelOrMessage: string, message?: string): void {
    if (message === undefined) {
      this.logs.push({
        level: "log",
        message: levelOrMessage,
        timestamp: new Date(),
      });
    } else {
      this.logs.push({
        level: levelOrMessage,
        message,
        timestamp: new Date(),
      });
    }
  }

  // Styled output
  bold(message: string): void {
    this.log("bold", message);
  }

  cyan(message: string): void {
    this.log("cyan", message);
  }

  yellow(message: string): void {
    this.log("yellow", message);
  }

  green(message: string): void {
    this.log("green", message);
  }

  red(message: string): void {
    this.log("red", message);
  }

  gray(message: string): void {
    this.log("gray", message);
  }

  // Structured output
  header(title: string, _emoji?: string): void {
    this.log("header", title);
  }

  subheader(title: string): void {
    this.log("subheader", title);
  }

  list(items: string[], _indent = 0): void {
    for (const item of items) {
      this.log("list", item);
    }
  }

  newline(): void {
    this.log("newline", "");
  }

  // Progress indicators
  startSpinner(message: string): void {
    this.spinnerActive = true;
    this.spinnerMessage = message;
    this.log("spinner-start", message);
  }

  updateSpinner(message: string): void {
    this.spinnerMessage = message;
    this.log("spinner-update", message);
  }

  succeedSpinner(message: string): void {
    this.spinnerActive = false;
    this.log("spinner-succeed", message);
  }

  failSpinner(message: string): void {
    this.spinnerActive = false;
    this.log("spinner-fail", message);
  }

  warnSpinner(message: string): void {
    this.spinnerActive = false;
    this.log("spinner-warn", message);
  }

  stopSpinner(): void {
    this.spinnerActive = false;
    this.log("spinner-stop", this.spinnerMessage);
  }

  // Status display
  statusLine(
    status: "pass" | "fail" | "warn" | "skip",
    name: string,
    message: string
  ): void {
    this.log(`status-${status}`, `${name}: ${message}`);
  }

  fixSuggestion(fix: string): void {
    this.log("fix", fix);
  }

  // Test helpers
  clear(): void {
    this.logs.length = 0;
  }

  hasLog(level: string, messagePattern?: string | RegExp): boolean {
    return this.logs.some((log) => {
      if (log.level !== level) return false;
      if (!messagePattern) return true;
      if (typeof messagePattern === "string") {
        return log.message.includes(messagePattern);
      }
      return messagePattern.test(log.message);
    });
  }

  getLogsOfLevel(level: string): string[] {
    return this.logs
      .filter((log) => log.level === level)
      .map((log) => log.message);
  }

  isSpinnerActive(): boolean {
    return this.spinnerActive;
  }

  getSpinnerMessage(): string {
    return this.spinnerMessage;
  }
}
