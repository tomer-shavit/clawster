/**
 * Start Servers Step
 *
 * Starts the API and Web development servers.
 */

import type { ISetupStep, StepResult, SetupContext } from "./step.interface";

export class StartServersStep implements ISetupStep {
  readonly id = "start-servers";
  readonly name = "Start development servers";
  readonly order = 40;
  readonly skippable = true;

  private readonly serverStartupTimeout = 60_000; // 60 seconds

  async shouldSkip(context: SetupContext): Promise<boolean> {
    if (context.options.skipStart) {
      return true;
    }

    if (context.options.nonInteractive) {
      return false;
    }

    const shouldStart = await context.prompts.confirm(
      "Start development servers now?",
      true
    );

    return !shouldStart;
  }

  async execute(context: SetupContext): Promise<StepResult> {
    const { apiPort, webPort } = context.state;

    context.output.startSpinner("Starting development servers...");

    try {
      // Kill any existing processes on the ports
      await this.killExistingProcesses(context, apiPort, webPort);

      // Start API server
      const shellEnv = context.shell.getShellEnv();

      const apiProcess = context.shell.spawn(
        "pnpm",
        ["--filter", "@clawster/api", "dev"],
        {
          cwd: context.projectRoot,
          detached: true,
          stdio: "ignore",
          shell: true,
          env: shellEnv,
        }
      );
      apiProcess.unref();

      // Start web server
      const webProcess = context.shell.spawn(
        "pnpm",
        ["--filter", "@clawster/web", "dev"],
        {
          cwd: context.projectRoot,
          detached: true,
          stdio: "ignore",
          shell: true,
          env: shellEnv,
        }
      );
      webProcess.unref();

      context.output.updateSpinner("Waiting for servers to be ready...");

      // Wait for servers
      const apiReady = await this.waitForServer(
        `http://localhost:${apiPort}/health`
      );
      const webReady = await this.waitForServer(`http://localhost:${webPort}`);

      context.state.serversStarted = apiReady && webReady;

      if (apiReady && webReady) {
        context.output.succeedSpinner("Development servers started");
        context.output.dim(`  API: http://localhost:${apiPort}`);
        context.output.dim(`  Web: http://localhost:${webPort}`);

        return {
          success: true,
          message: "Servers started successfully",
        };
      }

      context.output.warnSpinner(
        "Servers started but may take a moment to be fully ready"
      );
      context.output.yellow(
        `  Check the processes with: lsof -i:${apiPort} && lsof -i:${webPort}`
      );

      context.state.serversStarted = true;
      return {
        success: true,
        message: "Servers started (may still be initializing)",
      };
    } catch (error) {
      context.output.failSpinner("Failed to start servers");
      const err = error as Error;
      context.output.error(`  ${err.message}`);
      context.output.yellow("  Start manually with: pnpm dev");

      return {
        success: false,
        message: err.message,
      };
    }
  }

  private async killExistingProcesses(
    context: SetupContext,
    apiPort: number,
    webPort: number
  ): Promise<void> {
    try {
      context.shell.exec(
        `lsof -ti:${apiPort} | xargs -r kill -9 2>/dev/null || true`,
        { stdio: "pipe" }
      );
      context.shell.exec(
        `lsof -ti:${webPort} | xargs -r kill -9 2>/dev/null || true`,
        { stdio: "pipe" }
      );
    } catch {
      // Ignore errors - ports might not be in use or lsof not available
    }
  }

  private async waitForServer(url: string): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 1000;

    while (Date.now() - startTime < this.serverStartupTimeout) {
      try {
        const response = await fetch(url, {
          method: "GET",
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok || response.status < 500) {
          return true;
        }
      } catch {
        // Server not ready yet
      }
      await this.sleep(checkInterval);
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
