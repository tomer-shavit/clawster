/**
 * CLI Service Interfaces
 *
 * Exports all service interfaces and tokens for dependency injection.
 */

export {
  IOutputService,
  OUTPUT_SERVICE_TOKEN,
} from "./output.interface";

export {
  IFileSystemService,
  FileStat,
  FILESYSTEM_SERVICE_TOKEN,
} from "./filesystem.interface";

export {
  IShellService,
  ShellExecOptions,
  ShellResult,
  SHELL_SERVICE_TOKEN,
} from "./shell.interface";

export {
  IPromptsService,
  SelectChoice,
  PROMPTS_SERVICE_TOKEN,
} from "./prompts.interface";
