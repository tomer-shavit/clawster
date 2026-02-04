/**
 * Sysbox Command Handlers
 *
 * Manages Sysbox runtime for Docker sandbox support.
 */

import type { IOutputService } from "../../interfaces/output.interface";
import type { IShellService } from "../../interfaces/shell.interface";
import {
  detectPlatform,
  detectSysboxCapability,
  type SysboxCapability,
  type Platform,
} from "@clawster/cloud-providers";
import { getStatusIcon, getStatusColor } from "../../utils/display";

export class SysboxStatusHandler {
  constructor(
    private readonly output: IOutputService,
    private readonly shell: IShellService
  ) {}

  /**
   * Display Sysbox status.
   */
  async execute(): Promise<void> {
    this.output.header("Sysbox Runtime Status", "");
    this.output.newline();

    this.output.startSpinner("Detecting platform...");

    const platform = detectPlatform();
    this.output.updateSpinner("Checking Sysbox availability...");

    const capability = await detectSysboxCapability({ skipCache: true });

    this.output.stopSpinner();

    // Display platform
    this.output.cyan(`Platform: ${this.getPlatformDisplay(platform)}`);
    this.output.newline();

    // Display Sysbox status
    const statusIcon = getStatusIcon(capability.available as any);
    const statusColor = getStatusColor(capability.available as any);
    this.output.log(`Sysbox Status: ${statusIcon} ${statusColor(capability.available)}`);

    if (capability.version) {
      this.output.cyan(`Version: ${capability.version}`);
    }

    if (capability.reason) {
      this.output.dim(`Details: ${capability.reason}`);
    }

    this.output.newline();

    // Display sandbox support info
    const sandboxSupported = capability.available === "available";
    if (sandboxSupported) {
      this.output.success("✓ OpenClaw sandbox mode is supported");
      this.output.dim("  Containers will use --runtime=sysbox-runc");
    } else {
      this.output.yellow("⚠ OpenClaw sandbox mode is NOT supported");
      this.output.dim("  Containers will use default runc runtime");
      this.output.dim("  Sandbox isolation will be disabled for Docker deployments");
    }

    this.output.newline();

    // Show installation instructions
    if (capability.available === "not-installed" && capability.installCommand) {
      this.output.cyan("To install Sysbox:");
      this.output.log(`  ${capability.installCommand}`);
      this.output.newline();
      this.output.dim("Or run: clawster sysbox install");
      this.output.newline();
    }
  }

  private getPlatformDisplay(platform: Platform): string {
    switch (platform) {
      case "linux":
        return "Linux";
      case "macos":
        return "macOS";
      case "wsl2":
        return "Windows (WSL2)";
      case "windows-native":
        return "Windows (native)";
      default:
        return platform;
    }
  }
}

export class SysboxInstallHandler {
  constructor(
    private readonly output: IOutputService,
    private readonly shell: IShellService
  ) {}

  /**
   * Install Sysbox for the current platform.
   */
  async execute(): Promise<void> {
    this.output.header("Sysbox Installation", "");
    this.output.newline();

    this.output.startSpinner("Detecting platform...");

    const platform = detectPlatform();
    const capability = await detectSysboxCapability({ skipCache: true });

    this.output.stopSpinner();

    // Check if already installed
    if (capability.available === "available") {
      this.output.success("✓ Sysbox is already installed");
      if (capability.version) {
        this.output.dim(`  Version: ${capability.version}`);
      }
      this.output.newline();
      return;
    }

    // Check if platform supports Sysbox
    if (capability.available === "unavailable") {
      this.output.error("✗ Sysbox is not available on this platform");
      this.output.dim(`  ${capability.reason}`);
      this.output.newline();
      return;
    }

    // Check if we have an install command
    if (!capability.installCommand) {
      this.output.error("✗ No installation command available for this platform");
      this.output.dim("Please install Sysbox manually:");
      this.output.dim("https://github.com/nestybox/sysbox#installation");
      this.output.newline();
      return;
    }

    // Show installation plan
    this.output.cyan(`Platform: ${this.getPlatformDisplay(platform)}`);
    this.output.cyan(`Install method: ${capability.installMethod ?? "manual"}`);
    this.output.newline();
    this.output.cyan("Installation command:");
    this.output.log(`  ${capability.installCommand}`);
    this.output.newline();

    // Platform-specific installation
    switch (platform) {
      case "linux":
      case "wsl2":
        await this.installLinuxSysbox(capability);
        break;
      case "macos":
        await this.installMacosSysbox(capability);
        break;
      default:
        this.output.error("✗ Automatic installation not supported for this platform");
        this.output.dim("Please run the installation command manually.");
    }
  }

  private async installLinuxSysbox(capability: SysboxCapability): Promise<void> {
    this.output.yellow("⚠ This requires sudo permissions");
    this.output.newline();

    // Check for sudo
    try {
      this.shell.exec("sudo -n true", { stdio: "pipe" });
    } catch {
      this.output.dim("Requesting sudo permissions...");
      this.output.newline();
    }

    this.output.startSpinner("Installing Sysbox...");

    try {
      const child = this.shell.spawn("bash", ["-c", capability.installCommand!], {
        stdio: ["inherit", "pipe", "pipe"],
      });

      let output = "";

      child.stdout?.on("data", (data: Buffer) => {
        output += data.toString();
        const lines = output.split("\n").filter(Boolean);
        if (lines.length > 0) {
          this.output.updateSpinner(`Installing: ${lines[lines.length - 1].slice(0, 60)}`);
        }
      });

      child.stderr?.on("data", (data: Buffer) => {
        output += data.toString();
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        child.on("close", (code: number | null, signal: string | null) => {
          if (signal) {
            reject(new Error(`Process terminated by signal: ${signal}`));
          } else {
            resolve(code ?? 1);
          }
        });
        child.on("error", reject);
      });

      this.output.stopSpinner();

      if (exitCode === 0) {
        this.output.success("✓ Sysbox installed successfully");
        this.output.newline();

        // Verify installation
        this.output.cyan("Verifying installation...");
        const postCapability = await detectSysboxCapability({ skipCache: true });

        if (postCapability.available === "available") {
          this.output.success("✓ Sysbox is now available");
          if (postCapability.version) {
            this.output.dim(`  Version: ${postCapability.version}`);
          }

          this.output.newline();
          this.output.yellow("⚠ You may need to restart Docker:");
          this.output.log("  sudo systemctl restart docker");
        } else {
          this.output.yellow("⚠ Sysbox installed but not detected yet");
          this.output.dim("  You may need to restart Docker:");
          this.output.log("  sudo systemctl restart docker");
        }
      } else {
        this.output.error("✗ Installation failed");
        this.output.dim(`Exit code: ${exitCode}`);
        this.output.newline();
        this.output.dim("Try running the command manually:");
        this.output.log(`  ${capability.installCommand}`);
      }
    } catch (error) {
      this.output.stopSpinner();
      this.output.error("✗ Installation failed");
      this.output.dim(error instanceof Error ? error.message : String(error));
    }

    this.output.newline();
  }

  private async installMacosSysbox(capability: SysboxCapability): Promise<void> {
    // Check if Lima is installed
    try {
      this.shell.exec("limactl --version", { stdio: "pipe" });
    } catch {
      this.output.yellow("Lima is not installed. Installing via Homebrew...");
      this.output.newline();

      try {
        this.shell.exec("brew install lima", { stdio: "inherit" });
        this.output.newline();
      } catch {
        this.output.error("✗ Failed to install Lima");
        this.output.dim("Please install manually: brew install lima");
        return;
      }
    }

    this.output.startSpinner("Creating Sysbox-enabled Lima VM...");

    try {
      const child = this.shell.spawn(
        "limactl",
        ["start", "--name=clawster", "template://sysbox"],
        { stdio: ["inherit", "pipe", "pipe"] }
      );

      child.stdout?.on("data", (data: Buffer) => {
        const line = data.toString().trim();
        if (line) {
          this.output.updateSpinner(`Creating VM: ${line.slice(0, 60)}`);
        }
      });

      const exitCode = await new Promise<number>((resolve, reject) => {
        child.on("close", (code: number | null, signal: string | null) => {
          if (signal) {
            reject(new Error(`Process terminated by signal: ${signal}`));
          } else {
            resolve(code ?? 1);
          }
        });
        child.on("error", reject);
      });

      this.output.stopSpinner();

      if (exitCode === 0) {
        this.output.success("✓ Sysbox Lima VM created successfully");
        this.output.newline();

        this.output.cyan("Configure Docker to use the Lima VM:");
        this.output.log("  limactl shell clawster");
        this.output.dim("  or");
        this.output.log("  docker context use lima-clawster");
        this.output.newline();

        const postCapability = await detectSysboxCapability({ skipCache: true });
        if (postCapability.available === "available") {
          this.output.success("✓ Sysbox is now available");
        }
      } else {
        this.output.error("✗ Failed to create Lima VM");
        this.output.dim("Try running manually:");
        this.output.log("  limactl start --name=clawster template://sysbox");
      }
    } catch (error) {
      this.output.stopSpinner();
      this.output.error("✗ Failed to create Lima VM");
      this.output.dim(error instanceof Error ? error.message : String(error));
    }

    this.output.newline();
  }

  private getPlatformDisplay(platform: Platform): string {
    switch (platform) {
      case "linux":
        return "Linux";
      case "macos":
        return "macOS";
      case "wsl2":
        return "Windows (WSL2)";
      case "windows-native":
        return "Windows (native)";
      default:
        return platform;
    }
  }
}

/**
 * Factory functions.
 */
export function createSysboxStatusHandler(
  output: IOutputService,
  shell: IShellService
): SysboxStatusHandler {
  return new SysboxStatusHandler(output, shell);
}

export function createSysboxInstallHandler(
  output: IOutputService,
  shell: IShellService
): SysboxInstallHandler {
  return new SysboxInstallHandler(output, shell);
}
