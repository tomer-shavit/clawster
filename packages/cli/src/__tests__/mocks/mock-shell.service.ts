/**
 * Mock Shell Service
 *
 * Configurable command responses for testing.
 */

import type { ChildProcess, SpawnOptions } from "child_process";
import { EventEmitter } from "events";
import type {
  IShellService,
  ShellExecOptions,
  ShellResult,
} from "../../interfaces/shell.interface";

export interface MockCommandResponse {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: Error;
}

export class MockShellService implements IShellService {
  private responses: Map<string, MockCommandResponse> = new Map();
  private executedCommands: string[] = [];
  private mockPlatform: NodeJS.Platform = "linux";

  exec(command: string, _options?: ShellExecOptions): string {
    this.executedCommands.push(command);

    const response = this.findResponse(command);
    if (response?.error) {
      throw response.error;
    }
    if (response?.exitCode && response.exitCode !== 0) {
      const error = new Error(`Command failed: ${command}`) as Error & {
        status: number;
        stderr: string;
      };
      error.status = response.exitCode;
      error.stderr = response.stderr ?? "";
      throw error;
    }

    return response?.stdout ?? "";
  }

  async execAsync(command: string, _options?: ShellExecOptions): Promise<ShellResult> {
    this.executedCommands.push(command);

    const response = this.findResponse(command);
    if (response?.error) {
      throw response.error;
    }

    return {
      stdout: response?.stdout ?? "",
      stderr: response?.stderr ?? "",
      exitCode: response?.exitCode ?? 0,
    };
  }

  spawn(
    command: string,
    args: string[],
    _options?: SpawnOptions
  ): ChildProcess {
    const fullCommand = `${command} ${args.join(" ")}`;
    this.executedCommands.push(fullCommand);

    const response = this.findResponse(fullCommand) ?? this.findResponse(command);

    // Create a mock ChildProcess
    const emitter = new EventEmitter() as ChildProcess;

    // Mock stdout and stderr streams
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();

    (emitter as any).stdout = stdout;
    (emitter as any).stderr = stderr;
    (emitter as any).pid = 12345;
    (emitter as any).killed = false;
    (emitter as any).connected = true;
    (emitter as any).exitCode = null;
    (emitter as any).signalCode = null;

    emitter.unref = () => emitter;
    emitter.ref = () => emitter;
    emitter.kill = () => true;
    emitter.disconnect = () => {};
    emitter.send = () => false;

    // Emit data and close events asynchronously
    process.nextTick(() => {
      if (response?.stdout) {
        stdout.emit("data", Buffer.from(response.stdout));
      }
      if (response?.stderr) {
        stderr.emit("data", Buffer.from(response.stderr));
      }

      const exitCode = response?.exitCode ?? 0;
      emitter.emit("close", exitCode, null);
    });

    return emitter;
  }

  getShellEnv(): NodeJS.ProcessEnv {
    return { ...process.env };
  }

  execWithEnv(command: string, options?: ShellExecOptions): string {
    return this.exec(command, options);
  }

  commandExists(command: string): boolean {
    const response = this.findResponse(`which ${command}`);
    return response !== undefined && !response.error;
  }

  getPlatform(): NodeJS.Platform {
    return this.mockPlatform;
  }

  // Test helpers
  setResponse(command: string, response: MockCommandResponse): void {
    this.responses.set(command, response);
  }

  setResponses(responses: Record<string, MockCommandResponse>): void {
    for (const [command, response] of Object.entries(responses)) {
      this.responses.set(command, response);
    }
  }

  setPlatform(platform: NodeJS.Platform): void {
    this.mockPlatform = platform;
  }

  getExecutedCommands(): string[] {
    return [...this.executedCommands];
  }

  wasCommandExecuted(command: string): boolean {
    return this.executedCommands.some((cmd) => cmd.includes(command));
  }

  clear(): void {
    this.responses.clear();
    this.executedCommands = [];
  }

  private findResponse(command: string): MockCommandResponse | undefined {
    // Try exact match first
    if (this.responses.has(command)) {
      return this.responses.get(command);
    }

    // Try partial match
    for (const [pattern, response] of this.responses) {
      if (command.includes(pattern) || pattern.includes(command)) {
        return response;
      }
    }

    return undefined;
  }
}
