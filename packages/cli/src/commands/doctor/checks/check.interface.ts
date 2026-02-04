/**
 * Doctor Check Interface
 *
 * Defines the contract for all doctor checks.
 */

import type { IFileSystemService } from "../../../interfaces/filesystem.interface";
import type { IShellService } from "../../../interfaces/shell.interface";

export interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn" | "skip";
  message: string;
  fix?: string;
}

export interface CheckContext {
  platform: NodeJS.Platform;
  homeDir: string;
  clawsterDir: string;
  filesystem: IFileSystemService;
  shell: IShellService;
}

export interface IDoctorCheck {
  /**
   * Unique identifier for this check.
   */
  readonly id: string;

  /**
   * Human-readable name for display.
   */
  readonly name: string;

  /**
   * Whether this check runs only in security mode.
   */
  readonly securityOnly: boolean;

  /**
   * Platforms this check is applicable to.
   * If undefined, the check runs on all platforms.
   */
  readonly platforms?: NodeJS.Platform[];

  /**
   * Execute the check and return result.
   */
  execute(context: CheckContext): Promise<CheckResult>;
}
