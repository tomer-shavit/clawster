/**
 * CLI Service Factory
 *
 * Creates service containers with production or test implementations.
 */

import { ServiceContainer, type IServiceContainer } from "./service-container";
import { SERVICE_TOKENS } from "./tokens";
import { OutputService } from "../services/output.service";
import { FileSystemService } from "../services/filesystem.service";
import { ShellService } from "../services/shell.service";
import { PromptsService } from "../services/prompts.service";
import type { IOutputService } from "../interfaces/output.interface";
import type { IFileSystemService } from "../interfaces/filesystem.interface";
import type { IShellService } from "../interfaces/shell.interface";
import type { IPromptsService } from "../interfaces/prompts.interface";

export interface ServiceOverrides {
  output?: IOutputService;
  filesystem?: IFileSystemService;
  shell?: IShellService;
  prompts?: IPromptsService;
}

export class CliServiceFactory {
  /**
   * Create a service container with production implementations.
   */
  static createContainer(): IServiceContainer {
    const container = new ServiceContainer();

    container.register(SERVICE_TOKENS.Output, new OutputService());
    container.register(SERVICE_TOKENS.FileSystem, new FileSystemService());
    container.register(SERVICE_TOKENS.Shell, new ShellService());
    container.register(SERVICE_TOKENS.Prompts, new PromptsService());

    return container;
  }

  /**
   * Create a service container with optional overrides for testing.
   */
  static createTestContainer(overrides?: ServiceOverrides): IServiceContainer {
    const container = new ServiceContainer();

    container.register(
      SERVICE_TOKENS.Output,
      overrides?.output ?? new OutputService()
    );
    container.register(
      SERVICE_TOKENS.FileSystem,
      overrides?.filesystem ?? new FileSystemService()
    );
    container.register(
      SERVICE_TOKENS.Shell,
      overrides?.shell ?? new ShellService()
    );
    container.register(
      SERVICE_TOKENS.Prompts,
      overrides?.prompts ?? new PromptsService()
    );

    return container;
  }

  /**
   * Helper to resolve all services from a container.
   */
  static resolveAll(container: IServiceContainer): {
    output: IOutputService;
    filesystem: IFileSystemService;
    shell: IShellService;
    prompts: IPromptsService;
  } {
    return {
      output: container.resolve<IOutputService>(SERVICE_TOKENS.Output),
      filesystem: container.resolve<IFileSystemService>(SERVICE_TOKENS.FileSystem),
      shell: container.resolve<IShellService>(SERVICE_TOKENS.Shell),
      prompts: container.resolve<IPromptsService>(SERVICE_TOKENS.Prompts),
    };
  }
}
