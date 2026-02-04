/**
 * Command Registration
 *
 * Centralized command registration for the CLI.
 */

import type { Command } from "commander";
import type { IServiceContainer } from "../container/service-container";
import { SERVICE_TOKENS } from "../container/tokens";
import type { IOutputService } from "../interfaces/output.interface";
import type { IFileSystemService } from "../interfaces/filesystem.interface";
import type { IShellService } from "../interfaces/shell.interface";
import type { IPromptsService } from "../interfaces/prompts.interface";

import { createSetupHandler } from "./setup";
import { createDoctorHandler } from "./doctor";
import { createBootstrapHandler } from "./bootstrap";
import { createStatusHandler } from "./status";
import { createSysboxStatusHandler, createSysboxInstallHandler } from "./sysbox";
import { createProviderListHandler } from "./provider";
import { createDbHandler } from "./db";
import { createDevHandler } from "./dev";

/**
 * Register all commands with the Commander program.
 */
export function registerCommands(
  program: Command,
  container: IServiceContainer
): void {
  // Resolve services
  const output = container.resolve<IOutputService>(SERVICE_TOKENS.Output);
  const filesystem = container.resolve<IFileSystemService>(SERVICE_TOKENS.FileSystem);
  const shell = container.resolve<IShellService>(SERVICE_TOKENS.Shell);
  const prompts = container.resolve<IPromptsService>(SERVICE_TOKENS.Prompts);

  // Register setup command
  registerSetupCommand(program, output, filesystem, shell, prompts);

  // Register doctor command
  registerDoctorCommand(program, output, filesystem, shell);

  // Register bootstrap/init commands
  registerBootstrapCommands(program, output);

  // Register status command
  registerStatusCommand(program, output);

  // Register sysbox commands
  registerSysboxCommands(program, output, shell);

  // Register provider commands
  registerProviderCommands(program, output);

  // Register db commands
  registerDbCommands(program, output);

  // Register dev commands
  registerDevCommands(program, output);
}

function registerSetupCommand(
  program: Command,
  output: IOutputService,
  filesystem: IFileSystemService,
  shell: IShellService,
  prompts: IPromptsService
): void {
  program
    .command("setup")
    .description("Set up Clawster for local development (environment, database)")
    .option("--skip-start", "Don't start development servers after setup")
    .option("--skip-open", "Don't open browser after setup")
    .option("--non-interactive", "Use defaults without prompting")
    .action(async (options) => {
      const handler = createSetupHandler(output, filesystem, shell, prompts);
      await handler.execute(options);
    });
}

function registerDoctorCommand(
  program: Command,
  output: IOutputService,
  filesystem: IFileSystemService,
  shell: IShellService
): void {
  program
    .command("doctor")
    .description("Diagnose common issues with Clawster setup")
    .option("--security", "Run security-focused checks only")
    .action(async (options) => {
      const handler = createDoctorHandler(output, filesystem, shell);
      await handler.execute(options);
    });
}

function registerBootstrapCommands(
  program: Command,
  output: IOutputService
): void {
  const bootstrapAction = async (options: Record<string, unknown>) => {
    const handler = createBootstrapHandler(output);
    await handler.execute(options);
  };

  program
    .command("init")
    .description("Initialize Clawster infrastructure with interactive wizard")
    .option("-p, --provider <provider>", "Cloud provider (aws, azure, gcp, digitalocean, selfhosted)")
    .option("-r, --region <region>", "Cloud region")
    .option("-w, --workspace <name>", "Workspace name")
    .option("-y, --yes", "Skip confirmation prompts")
    .action(bootstrapAction);

  program
    .command("bootstrap")
    .description("Alias for 'init'")
    .option("-p, --provider <provider>", "Cloud provider")
    .option("-r, --region <region>", "Cloud region")
    .option("-w, --workspace <name>", "Workspace name")
    .option("-y, --yes", "Skip confirmation prompts")
    .action(bootstrapAction);
}

function registerStatusCommand(
  program: Command,
  output: IOutputService
): void {
  program
    .command("status")
    .description("Check Clawster status and instance health")
    .option("-w, --workspace <name>", "Workspace name")
    .action(async (options) => {
      const handler = createStatusHandler(output);
      await handler.execute(options);
    });
}

function registerSysboxCommands(
  program: Command,
  output: IOutputService,
  shell: IShellService
): void {
  const sysbox = program
    .command("sysbox")
    .description("Sysbox runtime management for Docker sandbox support");

  sysbox
    .command("status")
    .description("Check Sysbox installation status")
    .action(async () => {
      const handler = createSysboxStatusHandler(output, shell);
      await handler.execute();
    });

  sysbox
    .command("install")
    .description("Install Sysbox for the current platform")
    .action(async () => {
      const handler = createSysboxInstallHandler(output, shell);
      await handler.execute();
    });
}

function registerProviderCommands(
  program: Command,
  output: IOutputService
): void {
  const provider = program
    .command("provider")
    .description("Cloud provider management");

  provider
    .command("list")
    .description("List available deployment targets")
    .action(async () => {
      const handler = createProviderListHandler(output);
      await handler.execute();
    });
}

function registerDbCommands(
  program: Command,
  output: IOutputService
): void {
  const db = program
    .command("db")
    .description("Database management commands");

  const handler = createDbHandler(output);

  db
    .command("start")
    .description("Start local PostgreSQL database (self-hosted only)")
    .action(() => handler.start());

  db
    .command("migrate")
    .description("Run database migrations")
    .action(() => handler.migrate());

  db
    .command("status")
    .description("Check database connection status")
    .action(() => handler.status());
}

function registerDevCommands(
  program: Command,
  output: IOutputService
): void {
  const dev = program
    .command("dev")
    .description("Development commands");

  const handler = createDevHandler(output);

  dev
    .command("api")
    .description("Start API server in development mode")
    .action(() => handler.api());

  dev
    .command("web")
    .description("Start web UI in development mode")
    .action(() => handler.web());

  dev
    .command("all")
    .description("Start all services in development mode")
    .action(() => handler.all());
}
