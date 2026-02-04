/**
 * Shell Service Implementation
 *
 * Wraps child_process for command execution.
 */

import { execSync, spawn, type ChildProcess, type SpawnOptions } from "child_process";
import fs from "fs";
import os from "os";
import type {
  IShellService,
  ShellExecOptions,
  ShellResult,
} from "../interfaces/shell.interface";

export class ShellService implements IShellService {
  private cachedEnv: NodeJS.ProcessEnv | null = null;

  exec(command: string, options?: ShellExecOptions): string {
    return execSync(command, {
      cwd: options?.cwd,
      env: options?.env ?? process.env,
      encoding: options?.encoding ?? "utf-8",
      stdio: options?.stdio ?? "pipe",
      timeout: options?.timeout,
    }) as string;
  }

  async execAsync(command: string, options?: ShellExecOptions): Promise<ShellResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [], {
        cwd: options?.cwd,
        env: options?.env ?? process.env,
        shell: true,
        stdio: "pipe",
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
        });
      });

      child.on("error", (error) => {
        reject(error);
      });
    });
  }

  spawn(
    command: string,
    args: string[],
    options?: SpawnOptions
  ): ChildProcess {
    return spawn(command, args, options ?? {});
  }

  getShellEnv(): NodeJS.ProcessEnv {
    if (this.cachedEnv) {
      return this.cachedEnv;
    }

    const homeDir = os.homedir();
    const additionalPaths = [
      `${homeDir}/.nvm/versions/node`,
      `${homeDir}/.local/share/pnpm`,
      `${homeDir}/.pnpm`,
      `/usr/local/bin`,
      `/usr/bin`,
    ];

    // Find node version directories from NVM
    const nvmPath = `${homeDir}/.nvm/versions/node`;
    let nodeBinPaths: string[] = [];

    if (fs.existsSync(nvmPath)) {
      try {
        const versions = fs.readdirSync(nvmPath);
        nodeBinPaths = versions.map((v) => `${nvmPath}/${v}/bin`);
        // Also add corepack shims paths
        nodeBinPaths = nodeBinPaths.concat(
          versions.map((v) => `${nvmPath}/${v}/lib/node_modules/corepack/shims`)
        );
      } catch {
        // Ignore errors reading NVM directory
      }
    }

    const allPaths = [
      ...nodeBinPaths,
      ...additionalPaths,
      process.env.PATH || "",
    ];

    this.cachedEnv = {
      ...process.env,
      PATH: allPaths.join(":"),
    };

    return this.cachedEnv;
  }

  execWithEnv(command: string, options?: ShellExecOptions): string {
    return this.exec(command, {
      ...options,
      env: this.getShellEnv(),
    });
  }

  commandExists(command: string): boolean {
    try {
      const which = process.platform === "win32" ? "where" : "which";
      this.exec(`${which} ${command}`, { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }

  getPlatform(): NodeJS.Platform {
    return process.platform;
  }
}
