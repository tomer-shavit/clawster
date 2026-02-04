/**
 * Shell Service Interface
 *
 * Abstracts command execution and process spawning.
 * Enables testing with mock command responses.
 */

import type { ChildProcess, SpawnOptions } from "child_process";

export interface ShellExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  encoding?: BufferEncoding;
  stdio?: "pipe" | "inherit" | "ignore";
  timeout?: number;
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface IShellService {
  /**
   * Execute a command synchronously and return stdout.
   * Throws on non-zero exit code.
   */
  exec(command: string, options?: ShellExecOptions): string;

  /**
   * Execute a command asynchronously and return result.
   */
  execAsync(command: string, options?: ShellExecOptions): Promise<ShellResult>;

  /**
   * Spawn a child process.
   */
  spawn(
    command: string,
    args: string[],
    options?: SpawnOptions
  ): ChildProcess;

  /**
   * Get enhanced shell environment with common paths (NVM, pnpm, etc.).
   */
  getShellEnv(): NodeJS.ProcessEnv;

  /**
   * Execute a command with enhanced shell environment.
   */
  execWithEnv(command: string, options?: ShellExecOptions): string;

  /**
   * Check if a command exists in PATH.
   */
  commandExists(command: string): boolean;

  /**
   * Get current platform.
   */
  getPlatform(): NodeJS.Platform;
}

export const SHELL_SERVICE_TOKEN = Symbol("ShellService");
