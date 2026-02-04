/**
 * Output Service Interface
 *
 * Abstracts console output and spinner operations.
 * Enables testing by allowing mock implementations that capture output.
 */

export interface IOutputService {
  // Basic output levels
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  dim(message: string): void;
  log(message: string): void;

  // Styled output
  bold(message: string): void;
  cyan(message: string): void;
  yellow(message: string): void;
  green(message: string): void;
  red(message: string): void;
  gray(message: string): void;

  // Structured output
  header(title: string, emoji?: string): void;
  subheader(title: string): void;
  list(items: string[], indent?: number): void;
  newline(): void;

  // Progress indicators (spinner)
  startSpinner(message: string): void;
  updateSpinner(message: string): void;
  succeedSpinner(message: string): void;
  failSpinner(message: string): void;
  warnSpinner(message: string): void;
  stopSpinner(): void;

  // Status display
  statusLine(
    status: "pass" | "fail" | "warn" | "skip",
    name: string,
    message: string
  ): void;
  fixSuggestion(fix: string): void;
}

export const OUTPUT_SERVICE_TOKEN = Symbol("OutputService");
