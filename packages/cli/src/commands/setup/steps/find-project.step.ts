/**
 * Find Project Step
 *
 * Locates the Clawster project root directory.
 */

import type { ISetupStep, StepResult, SetupContext } from "./step.interface";

export class FindProjectStep implements ISetupStep {
  readonly id = "find-project";
  readonly name = "Find project root";
  readonly order = 0;
  readonly skippable = false;

  async execute(context: SetupContext): Promise<StepResult> {
    const projectRoot = await this.findProjectRoot(context);

    if (!projectRoot) {
      return {
        success: false,
        message: "Could not find Clawster project root. Run this command from within the Clawster repository.",
      };
    }

    // Update context with found project root
    context.projectRoot = projectRoot;

    return {
      success: true,
      message: `Found project at ${projectRoot}`,
    };
  }

  private async findProjectRoot(context: SetupContext): Promise<string | null> {
    let currentDir = process.cwd();

    // Walk up the directory tree looking for package.json with "clawster" workspaces
    for (let i = 0; i < 10; i++) {
      const packageJsonPath = context.filesystem.join(currentDir, "package.json");

      if (await context.filesystem.pathExists(packageJsonPath)) {
        try {
          const packageJson = await context.filesystem.readJson<{
            workspaces?: string[];
            name?: string;
          }>(packageJsonPath);

          // Check if this is the root package.json (has workspaces)
          if (packageJson.workspaces || packageJson.name === "clawster") {
            return currentDir;
          }
        } catch {
          // Continue searching
        }
      }

      const parentDir = context.filesystem.dirname(currentDir);
      if (parentDir === currentDir) break; // Reached filesystem root
      currentDir = parentDir;
    }

    // Fallback: check if current directory has apps/ and packages/
    const cwd = process.cwd();
    const hasApps = await context.filesystem.pathExists(
      context.filesystem.join(cwd, "apps")
    );
    const hasPackages = await context.filesystem.pathExists(
      context.filesystem.join(cwd, "packages")
    );

    if (hasApps && hasPackages) {
      return cwd;
    }

    return null;
  }
}
