/**
 * Setup Step Interface
 *
 * Defines the contract for all setup steps.
 */

import type { IFileSystemService } from "../../../interfaces/filesystem.interface";
import type { IShellService } from "../../../interfaces/shell.interface";
import type { IOutputService } from "../../../interfaces/output.interface";
import type { IPromptsService } from "../../../interfaces/prompts.interface";

export interface StepResult {
  success: boolean;
  message: string;
  skipReason?: string;
}

export interface SetupOptions {
  skipStart?: boolean;
  skipOpen?: boolean;
  nonInteractive?: boolean;
}

export interface SetupContext {
  projectRoot: string;
  options: SetupOptions;
  filesystem: IFileSystemService;
  shell: IShellService;
  output: IOutputService;
  prompts: IPromptsService;
  /** Shared state between steps */
  state: SetupState;
}

export interface SetupState {
  /** Whether prerequisites passed */
  prerequisitesPassed?: boolean;
  /** Whether servers were started */
  serversStarted?: boolean;
  /** API port */
  apiPort: number;
  /** Web port */
  webPort: number;
}

export interface ISetupStep {
  /**
   * Unique identifier for this step.
   */
  readonly id: string;

  /**
   * Human-readable name for display.
   */
  readonly name: string;

  /**
   * Order in which this step runs (lower = earlier).
   */
  readonly order: number;

  /**
   * Whether this step can be skipped.
   */
  readonly skippable: boolean;

  /**
   * Execute the step.
   */
  execute(context: SetupContext): Promise<StepResult>;

  /**
   * Check if this step should be skipped based on context.
   */
  shouldSkip?(context: SetupContext): Promise<boolean>;
}
