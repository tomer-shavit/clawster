#!/usr/bin/env node

/**
 * Clawster CLI
 *
 * Control plane for OpenClaw instances.
 *
 * This is the main entry point for the CLI. It uses a minimal bootstrapping
 * approach that delegates to the service container and command registration.
 */

import { Command } from "commander";
import chalk from "chalk";
import { CLAWSTER_VERSION } from "@clawster/core";
import { CliServiceFactory } from "./container/cli-factory";
import { registerCommands } from "./commands/register";

// Create the Commander program
const program = new Command();

program
  .name("clawster")
  .description("Clawster CLI - Control plane for OpenClaw instances")
  .version(CLAWSTER_VERSION);

// Create the service container with production implementations
const container = CliServiceFactory.createContainer();

// Register all commands
registerCommands(program, container);

// Add error handling
program.exitOverride();

try {
  program.parse();
} catch (error: unknown) {
  const err = error as { code?: string; message?: string };
  if (err.code !== "commander.help" && err.code !== "commander.version") {
    console.error(chalk.red("Error:"), err.message ?? String(error));
    process.exit(1);
  }
}
