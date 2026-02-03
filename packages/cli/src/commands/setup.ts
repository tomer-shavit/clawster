import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import { execSync, spawn } from "child_process";
import bcrypt from "bcrypt";

import os from "os";

// Configuration constants
const API_PORT = 4000;
const WEB_PORT = 3000;
const SERVER_STARTUP_TIMEOUT_MS = 60_000; // 60 seconds
const BCRYPT_SALT_ROUNDS = 10;

// Get shell environment with user's PATH (for NVM, corepack, etc.)
function getShellEnv(): NodeJS.ProcessEnv {
  // Include common paths where pnpm/node might be installed
  const homeDir = os.homedir();
  const additionalPaths = [
    `${homeDir}/.nvm/versions/node`,
    `${homeDir}/.local/share/pnpm`,
    `${homeDir}/.pnpm`,
    `/usr/local/bin`,
    `/usr/bin`,
  ];

  // Find node version directories
  const nvmPath = `${homeDir}/.nvm/versions/node`;
  let nodeBinPaths: string[] = [];
  if (fs.existsSync(nvmPath)) {
    try {
      const versions = fs.readdirSync(nvmPath);
      nodeBinPaths = versions.map(v => `${nvmPath}/${v}/bin`);
      // Also add corepack shims paths
      nodeBinPaths = nodeBinPaths.concat(
        versions.map(v => `${nvmPath}/${v}/lib/node_modules/corepack/shims`)
      );
    } catch {
      // Ignore errors reading NVM directory
    }
  }

  const allPaths = [...nodeBinPaths, ...additionalPaths, process.env.PATH || ""];

  return {
    ...process.env,
    PATH: allPaths.join(":"),
  };
}

// Execute command with proper shell environment
function execWithEnv(command: string, options: { cwd?: string; encoding?: BufferEncoding; stdio?: "pipe" | "inherit" } = {}): string {
  return execSync(command, {
    ...options,
    encoding: options.encoding || "utf-8",
    env: getShellEnv(),
  }) as string;
}

interface SetupOptions {
  skipStart?: boolean;
  skipOpen?: boolean;
  nonInteractive?: boolean;
  username?: string;
  password?: string;
}

interface PrerequisiteCheck {
  name: string;
  passed: boolean;
  message: string;
  fix?: string;
  optional?: boolean;
}

export async function setup(options: SetupOptions) {
  console.log(chalk.blue.bold("🚀 Clawster Setup"));
  console.log(chalk.gray("Get Clawster up and running in minutes\n"));

  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    console.log(chalk.red("❌ Could not find Clawster project root."));
    console.log(chalk.gray("Run this command from within the Clawster repository."));
    process.exit(1);
  }

  // Step 1: Check prerequisites
  console.log(chalk.white.bold("Step 1: Checking prerequisites...\n"));
  const prereqs = await checkPrerequisites();
  displayPrerequisiteResults(prereqs);

  if (!prereqs.allPassed) {
    console.log(chalk.red("\n❌ Please fix the issues above and run setup again."));
    process.exit(1);
  }

  console.log(chalk.green("✓ All prerequisites passed\n"));

  // Step 2: Environment setup
  console.log(chalk.white.bold("Step 2: Setting up environment...\n"));
  await setupEnvironment(projectRoot, options.nonInteractive);

  // Step 3: Database initialization
  console.log(chalk.white.bold("\nStep 3: Initializing database...\n"));
  await setupDatabase(projectRoot);

  // Step 4: Create admin user
  console.log(chalk.white.bold("\nStep 4: Creating admin user...\n"));
  await createAdminUser(projectRoot, options);

  // Step 5: Optionally start dev servers
  let serversStarted = false;
  if (!options.skipStart) {
    if (options.nonInteractive) {
      console.log(chalk.white.bold("\nStep 5: Starting development servers...\n"));
      serversStarted = await startDevServers(projectRoot);
    } else {
      const { startServers } = await inquirer.prompt([{
        type: "confirm",
        name: "startServers",
        message: "Start development servers now?",
        default: true,
      }]);

      if (startServers) {
        console.log(chalk.white.bold("\nStep 5: Starting development servers...\n"));
        serversStarted = await startDevServers(projectRoot);
      }
    }
  }

  // Step 6: Optionally open browser
  if (serversStarted && !options.skipOpen) {
    if (options.nonInteractive) {
      await openBrowser();
    } else {
      const { openInBrowser } = await inquirer.prompt([{
        type: "confirm",
        name: "openInBrowser",
        message: "Open browser to http://localhost:3000?",
        default: true,
      }]);

      if (openInBrowser) {
        await openBrowser();
      }
    }
  }

  // Success message
  console.log();
  console.log(chalk.green.bold("✓ Clawster setup complete!"));
  console.log();

  if (!serversStarted) {
    console.log(chalk.white("To start the development servers:"));
    console.log(chalk.cyan("  pnpm dev"));
    console.log();
    console.log(chalk.gray("Or start individually:"));
    console.log(chalk.gray("  Terminal 1: pnpm --filter @clawster/api dev"));
    console.log(chalk.gray("  Terminal 2: pnpm --filter @clawster/web dev"));
    console.log();
  }

  console.log(chalk.white("Access the dashboard:"));
  console.log(chalk.cyan("  http://localhost:3000"));
  console.log();

  console.log(chalk.white("Next steps:"));
  console.log(chalk.gray("  1. Create your first fleet in the dashboard"));
  console.log(chalk.gray("  2. Deploy OpenClaw instances to your fleet"));
  console.log(chalk.gray("  3. For AWS deployment, run: ") + chalk.cyan("pnpm cli init"));
  console.log();
}

function findProjectRoot(): string | null {
  let currentDir = process.cwd();

  // Walk up the directory tree looking for package.json with "clawster" workspaces
  for (let i = 0; i < 10; i++) {
    const packageJsonPath = path.join(currentDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = fs.readJsonSync(packageJsonPath);
        // Check if this is the root package.json (has workspaces)
        if (packageJson.workspaces || packageJson.name === "clawster") {
          return currentDir;
        }
      } catch {
        // Continue searching
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached filesystem root
    currentDir = parentDir;
  }

  // Fallback: check if current directory has apps/ and packages/
  const cwd = process.cwd();
  if (
    fs.existsSync(path.join(cwd, "apps")) &&
    fs.existsSync(path.join(cwd, "packages"))
  ) {
    return cwd;
  }

  return null;
}

async function checkPrerequisites(): Promise<{
  allPassed: boolean;
  checks: PrerequisiteCheck[];
}> {
  const checks: PrerequisiteCheck[] = [];

  // Check Node.js version (>= 18)
  const nodeVersion = process.versions.node;
  const majorVersion = parseInt(nodeVersion.split(".")[0], 10);
  checks.push({
    name: "Node.js 18+",
    passed: majorVersion >= 18,
    message: `v${nodeVersion}`,
    fix: "Install Node.js 18+ from https://nodejs.org",
  });

  // Check pnpm (use helper to include NVM/corepack paths)
  try {
    const pnpmVersion = execWithEnv("pnpm --version").trim();
    checks.push({
      name: "pnpm",
      passed: true,
      message: `v${pnpmVersion}`,
    });
  } catch {
    checks.push({
      name: "pnpm",
      passed: false,
      message: "Not found",
      fix: "npm install -g pnpm",
    });
  }

  // Check Docker (optional)
  try {
    execSync("docker info", { stdio: "pipe" });
    checks.push({
      name: "Docker",
      passed: true,
      message: "Running",
      optional: true,
    });
  } catch {
    checks.push({
      name: "Docker",
      passed: true, // Optional, so we still pass
      message: "Not running (optional, needed for deploying OpenClaw instances)",
      optional: true,
    });
  }

  // Required checks must all pass
  const requiredChecks = checks.filter(c => !c.optional);
  const allPassed = requiredChecks.every(c => c.passed);

  return { allPassed, checks };
}

function displayPrerequisiteResults(prereqs: { checks: PrerequisiteCheck[] }) {
  for (const check of prereqs.checks) {
    const icon = check.passed ? chalk.green("✓") : chalk.red("✗");
    const name = check.optional ? chalk.gray(check.name) : chalk.white(check.name);
    const status = check.passed ? chalk.green(check.message) : chalk.red(check.message);

    console.log(`  ${icon} ${name}: ${status}`);

    if (!check.passed && check.fix) {
      console.log(chalk.yellow(`    Fix: ${check.fix}`));
    }
  }
}

async function setupEnvironment(projectRoot: string, nonInteractive?: boolean) {
  const rootEnvPath = path.join(projectRoot, ".env");
  const apiEnvPath = path.join(projectRoot, "apps", "api", ".env");

  // Check if .env already exists
  const envExists = fs.existsSync(rootEnvPath);

  if (envExists && !nonInteractive) {
    const { overwrite } = await inquirer.prompt([{
      type: "confirm",
      name: "overwrite",
      message: ".env file already exists. Overwrite?",
      default: false,
    }]);

    if (!overwrite) {
      console.log(chalk.yellow("  Keeping existing .env file"));
      return;
    }
  } else if (envExists && nonInteractive) {
    console.log(chalk.yellow("  .env already exists, keeping existing configuration"));
    return;
  }

  const spinner = ora("Creating environment configuration...").start();

  // Generate JWT secret
  const jwtSecret = crypto.randomBytes(32).toString("hex");

  const envContent = `# Clawster Environment Configuration
# Generated by 'clawster setup' on ${new Date().toISOString()}

# Authentication
JWT_SECRET=${jwtSecret}

# Database (SQLite for development)
DATABASE_URL=file:./packages/database/prisma/dev.db

# API Server
PORT=4000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000

# AWS (optional - needed for cloud deployments)
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_ACCOUNT_ID=

# ECS (optional - populated by 'clawster init')
# ECS_CLUSTER_ARN=
# ECS_EXECUTION_ROLE_ARN=
# ECS_TASK_ROLE_ARN=
# PRIVATE_SUBNET_IDS=
# SECURITY_GROUP_ID=
`;

  await fs.writeFile(rootEnvPath, envContent, "utf-8");

  // Create symlink or copy for apps/api/.env
  if (!fs.existsSync(apiEnvPath)) {
    // Use API-specific env that references the database correctly
    const apiEnvContent = `# Clawster API Environment
# Generated by 'clawster setup'

# Import from root .env or set values directly
JWT_SECRET=${jwtSecret}
DATABASE_URL=file:../../packages/database/prisma/dev.db
PORT=4000
`;
    await fs.ensureDir(path.dirname(apiEnvPath));
    await fs.writeFile(apiEnvPath, apiEnvContent, "utf-8");
  }

  spinner.succeed("Environment configured");
  console.log(chalk.gray(`  Created: ${rootEnvPath}`));
  console.log(chalk.gray(`  Created: ${apiEnvPath}`));
}

async function setupDatabase(projectRoot: string) {
  const spinner = ora("Generating Prisma client...").start();

  // Run Prisma commands directly on the database package (more reliable than Turbo)
  const databaseDir = path.join(projectRoot, "packages", "database");
  const shellEnv = getShellEnv();

  try {
    // Generate Prisma client
    execSync("pnpm prisma generate", {
      cwd: databaseDir,
      stdio: "pipe",
      env: shellEnv,
    });
    spinner.succeed("Prisma client generated");

    // Push schema to database
    const pushSpinner = ora("Pushing database schema...").start();
    execSync("pnpm prisma db push", {
      cwd: databaseDir,
      stdio: "pipe",
      env: { ...shellEnv, DATABASE_URL: "file:./prisma/dev.db" }
    });
    pushSpinner.succeed("Database schema pushed");

  } catch (error) {
    spinner.fail("Database setup failed");
    const err = error as { stderr?: Buffer; message?: string };
    if (err.stderr) {
      console.log(chalk.red(err.stderr.toString()));
    }
    console.log(chalk.yellow("Try running manually:"));
    console.log(chalk.yellow("  cd packages/database && pnpm prisma generate && pnpm prisma db push"));
    process.exit(1);
  }
}

async function createAdminUser(projectRoot: string, options: SetupOptions) {
  let username = options.username || "admin";
  let password = options.password;

  // Check if admin already exists
  const dbPath = path.join(projectRoot, "packages", "database", "prisma", "dev.db");

  if (!fs.existsSync(dbPath)) {
    console.log(chalk.yellow("  Database not initialized yet. Skipping admin creation."));
    console.log(chalk.gray("  Run setup again after database is ready."));
    return;
  }

  // Interactive prompts if not non-interactive
  if (!options.nonInteractive) {
    const { inputUsername } = await inquirer.prompt([{
      type: "input",
      name: "inputUsername",
      message: "Admin username:",
      default: username,
      validate: (input: string) => {
        if (!input) return "Username is required";
        if (!/^[a-z0-9_-]+$/.test(input)) {
          return "Username must be lowercase alphanumeric with hyphens/underscores";
        }
        return true;
      },
    }]);
    username = inputUsername;
  }

  if (!password) {
    if (options.nonInteractive) {
      // Require password in non-interactive mode for security
      console.log(chalk.red("  Error: --password is required in --non-interactive mode"));
      console.log(chalk.gray("  Usage: pnpm cli setup --non-interactive -u admin -p yourpassword"));
      process.exit(1);
    } else {
      const { inputPassword } = await inquirer.prompt([{
        type: "password",
        name: "inputPassword",
        message: "Admin password:",
        mask: "*",
        validate: (input: string) => {
          if (input.length < 8) return "Password must be at least 8 characters";
          return true;
        },
      }]);
      password = inputPassword;
    }
  }

  const spinner = ora("Creating admin user...").start();

  try {
    // Use the Prisma client from @clawster/database
    const { PrismaClient } = await import("@clawster/database");
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${dbPath}`,
        },
      },
    });

    // Check if user already exists
    const existingUser = await prisma.authUser.findUnique({
      where: { username },
    });

    if (existingUser) {
      spinner.warn(`User '${username}' already exists`);
      await prisma.$disconnect();
      return;
    }

    // Hash password
    if (!password) {
      throw new Error("Password is required but was not provided");
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Create admin user
    await prisma.authUser.create({
      data: {
        username,
        passwordHash,
        role: "ADMIN",
        isActive: true,
      },
    });

    await prisma.$disconnect();
    spinner.succeed(`Admin user '${username}' created`);

  } catch (error) {
    spinner.fail("Failed to create admin user");
    const err = error as Error;
    console.log(chalk.red(`  ${err.message}`));
    console.log(chalk.yellow("  You can create a user later with: pnpm cli auth create-user"));
  }
}

async function startDevServers(projectRoot: string): Promise<boolean> {
  const spinner = ora("Starting development servers...").start();
  const shellEnv = getShellEnv();

  try {
    // Kill any existing processes on the ports (Linux/macOS only)
    try {
      execSync(`lsof -ti:${API_PORT} | xargs -r kill -9 2>/dev/null || true`, { stdio: "pipe" });
      execSync(`lsof -ti:${WEB_PORT} | xargs -r kill -9 2>/dev/null || true`, { stdio: "pipe" });
    } catch {
      // Ignore errors - ports might not be in use or lsof not available (Windows)
    }

    // Start API server in background
    const apiProcess = spawn("pnpm", ["--filter", "@clawster/api", "dev"], {
      cwd: projectRoot,
      detached: true,
      stdio: "ignore",
      shell: true,
      env: shellEnv,
    });
    apiProcess.unref();

    // Start web server in background
    const webProcess = spawn("pnpm", ["--filter", "@clawster/web", "dev"], {
      cwd: projectRoot,
      detached: true,
      stdio: "ignore",
      shell: true,
      env: shellEnv,
    });
    webProcess.unref();

    spinner.text = "Waiting for servers to be ready...";

    // Wait for servers to be ready
    const apiReady = await waitForServer(`http://localhost:${API_PORT}/health`, SERVER_STARTUP_TIMEOUT_MS);
    if (!apiReady) {
      spinner.warn("API server may not be fully ready");
    }

    const webReady = await waitForServer(`http://localhost:${WEB_PORT}`, SERVER_STARTUP_TIMEOUT_MS);
    if (!webReady) {
      spinner.warn("Web server may not be fully ready");
    }

    if (apiReady && webReady) {
      spinner.succeed("Development servers started");
      console.log(chalk.gray(`  API: http://localhost:${API_PORT}`));
      console.log(chalk.gray(`  Web: http://localhost:${WEB_PORT}`));
      return true;
    } else {
      spinner.warn("Servers started but may take a moment to be fully ready");
      console.log(chalk.yellow(`  Check the processes with: lsof -i:${API_PORT} && lsof -i:${WEB_PORT}`));
      return true;
    }

  } catch (error) {
    spinner.fail("Failed to start servers");
    const err = error as Error;
    console.log(chalk.red(`  ${err.message}`));
    console.log(chalk.yellow("  Start manually with: pnpm dev"));
    return false;
  }
}

async function waitForServer(url: string, timeout: number): Promise<boolean> {
  const startTime = Date.now();
  const checkInterval = 1000;

  while (Date.now() - startTime < timeout) {
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
    await sleep(checkInterval);
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function openBrowser() {
  const url = `http://localhost:${WEB_PORT}`;
  try {
    const open = (await import("open")).default;
    await open(url);
    console.log(chalk.gray(`  Opened browser to ${url}`));
  } catch {
    console.log(chalk.yellow("  Could not open browser automatically."));
    console.log(chalk.gray(`  Please open ${url} manually.`));
  }
}
