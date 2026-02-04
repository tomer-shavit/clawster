/**
 * Database Step
 *
 * Initializes the database with Prisma.
 */

import type { ISetupStep, StepResult, SetupContext } from "./step.interface";

export class DatabaseStep implements ISetupStep {
  readonly id = "database";
  readonly name = "Initialize database";
  readonly order = 30;
  readonly skippable = false;

  async execute(context: SetupContext): Promise<StepResult> {
    const databaseDir = context.filesystem.join(
      context.projectRoot,
      "packages",
      "database"
    );

    try {
      // Generate Prisma client
      context.output.startSpinner("Generating Prisma client...");

      context.shell.exec("pnpm prisma generate", {
        cwd: databaseDir,
        stdio: "pipe",
        env: context.shell.getShellEnv(),
      });

      context.output.succeedSpinner("Prisma client generated");

      // Push schema to database
      context.output.startSpinner("Pushing database schema...");

      context.shell.exec("pnpm prisma db push", {
        cwd: databaseDir,
        stdio: "pipe",
        env: {
          ...context.shell.getShellEnv(),
          DATABASE_URL: "file:./dev.db",
        },
      });

      context.output.succeedSpinner("Database schema pushed");

      return {
        success: true,
        message: "Database initialized successfully",
      };
    } catch (error) {
      context.output.failSpinner("Database setup failed");

      const err = error as { stderr?: Buffer; message?: string };
      if (err.stderr) {
        context.output.error(err.stderr.toString());
      }

      context.output.yellow("Try running manually:");
      context.output.yellow(
        "  cd packages/database && pnpm prisma generate && pnpm prisma db push"
      );

      return {
        success: false,
        message: err.message ?? "Database setup failed",
      };
    }
  }
}
