import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import fs from "fs-extra";
import path from "path";
import os from "os";

const CLAWSTER_DIR = path.join(os.homedir(), ".clawster");
const TOKEN_FILE = path.join(CLAWSTER_DIR, "token");
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Find the Clawster project root by walking up the directory tree
 */
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
        // Ignore JSON parse errors
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break; // Reached root
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Get the database path for the current project
 */
function getDatabasePath(): string | null {
  const projectRoot = findProjectRoot();
  if (!projectRoot) {
    return null;
  }

  const dbPath = path.join(projectRoot, "packages", "database", "prisma", "dev.db");
  if (!fs.existsSync(dbPath)) {
    return null;
  }

  return dbPath;
}

/**
 * Create a Prisma client with the correct database path
 */
async function createPrismaClient() {
  const dbPath = getDatabasePath();
  if (!dbPath) {
    return null;
  }

  const { PrismaClient } = await import("@clawster/database");
  return new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbPath}`,
      },
    },
  });
}

export async function createUser(options: {
  username?: string;
  password?: string;
  role?: string;
  workspace?: string;
}) {
  console.log(chalk.blue.bold("👤 Create Clawster User\n"));

  const prisma = await createPrismaClient();
  if (!prisma) {
    console.log(chalk.red("❌ Could not find Clawster database."));
    console.log(chalk.gray("Run 'clawster setup' first to initialize the database."));
    process.exit(1);
  }

  // Get user input
  let { username, password, role } = options;

  if (!username) {
    const result = await inquirer.prompt([{
      type: "input",
      name: "username",
      message: "Username:",
      validate: (input: string) => {
        if (!input) return "Username is required";
        if (!/^[a-z0-9_-]+$/.test(input)) {
          return "Username must be lowercase alphanumeric with hyphens/underscores";
        }
        return true;
      },
    }]);
    username = result.username;
  }

  if (!password) {
    const result = await inquirer.prompt([{
      type: "password",
      name: "password",
      message: "Password:",
      mask: "*",
      validate: (input: string) => {
        if (input.length < 8) return "Password must be at least 8 characters";
        return true;
      },
    }]);
    password = result.password;
  }

  if (!role) {
    const result = await inquirer.prompt([{
      type: "list",
      name: "role",
      message: "Role:",
      choices: [
        { name: "Admin - Full access to all resources", value: "ADMIN" },
        { name: "Operator - Can manage bots, read-only on infrastructure", value: "OPERATOR" },
        { name: "Viewer - Read-only access", value: "VIEWER" },
      ],
      default: "OPERATOR",
    }]);
    role = result.role;
  }

  const spinner = ora("Creating user...").start();

  try {
    // Check for duplicate username
    const existingUser = await prisma.authUser.findUnique({
      where: { username },
    });

    if (existingUser) {
      spinner.fail(`User '${username}' already exists`);
      await prisma.$disconnect();
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password!, BCRYPT_SALT_ROUNDS);

    // Create user
    const user = await prisma.authUser.create({
      data: {
        username: username!,
        passwordHash,
        role: role as "ADMIN" | "OPERATOR" | "VIEWER",
        isActive: true,
      },
    });

    await prisma.$disconnect();

    spinner.succeed(`User '${username}' created successfully`);
    console.log();
    console.log(chalk.gray("User ID: ") + user.id);
    console.log(chalk.gray("Role: ") + user.role);

  } catch (error) {
    await prisma.$disconnect();
    spinner.fail("Failed to create user");
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}

export async function login(options: {
  username?: string;
  password?: string;
}) {
  console.log(chalk.blue.bold("🔐 Clawster Login\n"));

  const prisma = await createPrismaClient();
  if (!prisma) {
    console.log(chalk.red("❌ Could not find Clawster database."));
    console.log(chalk.gray("Run 'clawster setup' first to initialize the database."));
    process.exit(1);
  }

  let { username, password } = options;

  if (!username) {
    const result = await inquirer.prompt([{
      type: "input",
      name: "username",
      message: "Username:",
    }]);
    username = result.username;
  }

  if (!password) {
    const result = await inquirer.prompt([{
      type: "password",
      name: "password",
      message: "Password:",
      mask: "*",
    }]);
    password = result.password;
  }

  const spinner = ora("Authenticating...").start();

  try {
    // Find user
    const user = await prisma.authUser.findUnique({
      where: { username },
    });

    if (!user) {
      spinner.fail("Invalid username or password");
      await prisma.$disconnect();
      process.exit(1);
    }

    if (!user.isActive) {
      spinner.fail("User account is deactivated");
      await prisma.$disconnect();
      process.exit(1);
    }

    // Verify password
    const valid = await bcrypt.compare(password!, user.passwordHash);
    if (!valid) {
      spinner.fail("Invalid username or password");
      await prisma.$disconnect();
      process.exit(1);
    }

    // Generate JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      spinner.fail("JWT_SECRET environment variable is required. Set it before logging in.");
      await prisma.$disconnect();
      process.exit(1);
    }

    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        role: user.role
      },
      jwtSecret,
      { expiresIn: "24h" }
    );

    // Update last login
    await prisma.authUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await prisma.$disconnect();

    spinner.succeed("Login successful");
    console.log();
    console.log(chalk.green("JWT Token:"));
    console.log(chalk.gray(token));
    console.log();
    console.log(chalk.gray("Use this token in the Authorization header:"));
    console.log(chalk.cyan(`Authorization: Bearer ${token}`));

    // Save token to file for CLI use
    await fs.ensureDir(CLAWSTER_DIR);
    await fs.writeFile(TOKEN_FILE, token, "utf-8");
    console.log();
    console.log(chalk.gray(`Token saved to: ${TOKEN_FILE}`));

  } catch (error) {
    await prisma.$disconnect();
    spinner.fail("Login failed");
    console.error(chalk.red((error as Error).message));
    process.exit(1);
  }
}

export async function listUsers() {
  console.log(chalk.blue.bold("👥 Clawster Users\n"));

  const prisma = await createPrismaClient();
  if (!prisma) {
    console.log(chalk.red("❌ Could not find Clawster database."));
    console.log(chalk.gray("Run 'clawster setup' first to initialize the database."));
    process.exit(1);
  }

  try {
    const users = await prisma.authUser.findMany({
      orderBy: { createdAt: "asc" },
    });

    await prisma.$disconnect();

    if (users.length === 0) {
      console.log(chalk.yellow("No users found. Run 'clawster auth create-user' to create one."));
      return;
    }

    console.log(chalk.white("Users:"));
    console.log();

    for (const user of users) {
      const status = user.isActive ? chalk.green("active") : chalk.red("inactive");
      console.log(chalk.cyan(`  ${user.username}`) + ` (${status})`);
      console.log(chalk.gray(`    ID: ${user.id}`));
      console.log(chalk.gray(`    Role: ${user.role}`));
      console.log(chalk.gray(`    Created: ${new Date(user.createdAt).toLocaleDateString()}`));
      if (user.lastLoginAt) {
        console.log(chalk.gray(`    Last Login: ${new Date(user.lastLoginAt).toLocaleDateString()}`));
      }
      console.log();
    }

  } catch (error) {
    await prisma.$disconnect();
    console.error(chalk.red("Failed to list users:"), (error as Error).message);
    process.exit(1);
  }
}

export async function deleteUser(options: { username?: string }) {
  const prisma = await createPrismaClient();
  if (!prisma) {
    console.log(chalk.red("❌ Could not find Clawster database."));
    console.log(chalk.gray("Run 'clawster setup' first to initialize the database."));
    process.exit(1);
  }

  let { username } = options;

  try {
    if (!username) {
      // Load users for selection
      const users = await prisma.authUser.findMany({
        orderBy: { createdAt: "asc" },
      });

      if (users.length === 0) {
        console.log(chalk.yellow("No users to delete."));
        await prisma.$disconnect();
        return;
      }

      const result = await inquirer.prompt([{
        type: "list",
        name: "username",
        message: "Select user to delete:",
        choices: users.map(u => ({ name: `${u.username} (${u.role})`, value: u.username })),
      }]);
      username = result.username;
    }

    const { confirm } = await inquirer.prompt([{
      type: "confirm",
      name: "confirm",
      message: chalk.red(`Are you sure you want to delete user '${username}'?`),
      default: false,
    }]);

    if (!confirm) {
      console.log(chalk.yellow("Cancelled."));
      await prisma.$disconnect();
      return;
    }

    const spinner = ora("Deleting user...").start();

    const user = await prisma.authUser.findUnique({
      where: { username },
    });

    if (!user) {
      spinner.fail(`User '${username}' not found`);
      await prisma.$disconnect();
      process.exit(1);
    }

    await prisma.authUser.delete({
      where: { id: user.id },
    });

    await prisma.$disconnect();
    spinner.succeed(`User '${username}' deleted`);

  } catch (error) {
    await prisma.$disconnect();
    console.error(chalk.red("Failed to delete user:"), (error as Error).message);
    process.exit(1);
  }
}
