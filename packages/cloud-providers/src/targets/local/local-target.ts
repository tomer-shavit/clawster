import { execFile } from "child_process";
import { platform } from "os";
import {
  DeploymentTargetType,
  InstallOptions,
  InstallResult,
  OpenClawConfigPayload,
  ConfigureResult,
  TargetStatus,
  DeploymentLogOptions,
  GatewayEndpoint,
  DetectedOS,
  validatePortSpacing,
} from "../../interface/deployment-target";
import { BaseDeploymentTarget } from "../../base/base-deployment-target";
import type { AdapterMetadata, SelfDescribingDeploymentTarget } from "../../interface/adapter-metadata";

/**
 * Executes a command using child_process.execFile and returns stdout.
 * Uses execFile (not exec/shell) for safety.
 */
function runCommand(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 30_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command failed: ${cmd} ${args.join(" ")}\n${stderr || error.message}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * Detects the current operating system type for service management.
 */
function detectOS(): DetectedOS {
  const p = platform();
  if (p === "darwin") return "macos";
  // Check for WSL2 via environment or kernel version
  if (p === "linux") {
    try {
      const release = require("fs").readFileSync("/proc/version", "utf8");
      if (release.toLowerCase().includes("microsoft")) return "wsl2";
    } catch {
      // Ignore — not available
    }
    return "linux";
  }
  // Default to linux for other platforms
  return "linux";
}

/**
 * LocalMachineTarget manages an OpenClaw gateway instance on the
 * current machine using systemd (Linux/WSL2) or launchctl (macOS).
 *
 * Profile-based isolation means each instance gets its own service
 * name, config directory, and port range.
 */
export class LocalMachineTarget extends BaseDeploymentTarget implements SelfDescribingDeploymentTarget {
  readonly type = DeploymentTargetType.LOCAL;

  private profileName: string = "";
  private port: number = 0;
  private os: DetectedOS;

  constructor() {
    super();
    this.os = detectOS();
  }

  /**
   * Returns the OS-appropriate service name for a profile.
   */
  private getServiceName(profile: string): string {
    if (this.os === "macos") {
      return `bot.molt.${profile}`;
    }
    return `openclaw-gateway-${profile}`;
  }

  /**
   * Returns the launchd plist path on macOS.
   */
  private getLaunchdPlistPath(profile: string): string {
    const home = process.env.HOME || "~";
    return `${home}/Library/LaunchAgents/bot.molt.${profile}.plist`;
  }

  /**
   * Returns the systemd user service unit name.
   */
  private getSystemdUnitName(profile: string): string {
    return `openclaw-gateway-${profile}.service`;
  }

  async install(options: InstallOptions): Promise<InstallResult> {
    this.profileName = options.profileName;
    this.port = options.port;

    const serviceName = this.getServiceName(options.profileName);

    // Build the install command arguments
    const args = [
      "gateway",
      "install",
      "--profile",
      options.profileName,
      "--port",
      options.port.toString(),
    ];

    if (options.openclawVersion) {
      args.push("--version", options.openclawVersion);
    }

    try {
      const output = await runCommand("openclaw", args);

      // On Linux, enable linger so user services persist after logout
      if (this.os === "linux" || this.os === "wsl2") {
        const username = process.env.USER || process.env.LOGNAME || "root";
        try {
          await runCommand("loginctl", ["enable-linger", username]);
        } catch {
          // Non-fatal: linger may already be enabled or require elevated permissions
        }
      }

      return {
        success: true,
        instanceId: serviceName,
        message: `Installed OpenClaw gateway profile "${options.profileName}" on ${this.os}. ${output}`,
        serviceName,
      };
    } catch (error) {
      return {
        success: false,
        instanceId: serviceName,
        message: `Failed to install: ${error instanceof Error ? error.message : String(error)}`,
        serviceName,
      };
    }
  }

  async configure(config: OpenClawConfigPayload): Promise<ConfigureResult> {
    this.profileName = config.profileName;
    this.port = config.gatewayPort;

    // OpenClaw profiles scope config automatically via --profile,
    // so we invoke the config command to write settings.
    const args = [
      "gateway",
      "config",
      "--profile",
      config.profileName,
      "--port",
      config.gatewayPort.toString(),
    ];

    if (config.environment) {
      for (const [key, value] of Object.entries(config.environment)) {
        args.push("--env", `${key}=${value}`);
      }
    }

    try {
      await runCommand("openclaw", args);
      return {
        success: true,
        message: `Configuration applied to profile "${config.profileName}"`,
        requiresRestart: true,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to configure: ${error instanceof Error ? error.message : String(error)}`,
        requiresRestart: false,
      };
    }
  }

  async start(): Promise<void> {
    if (!this.profileName) {
      throw new Error("Cannot start: no profile configured. Call install() or configure() first.");
    }

    if (this.os === "macos") {
      const plistPath = this.getLaunchdPlistPath(this.profileName);
      await runCommand("launchctl", ["load", plistPath]);
    } else {
      const unit = this.getSystemdUnitName(this.profileName);
      await runCommand("systemctl", ["--user", "start", unit]);
    }
  }

  async stop(): Promise<void> {
    if (!this.profileName) {
      throw new Error("Cannot stop: no profile configured.");
    }

    if (this.os === "macos") {
      const plistPath = this.getLaunchdPlistPath(this.profileName);
      await runCommand("launchctl", ["unload", plistPath]);
    } else {
      const unit = this.getSystemdUnitName(this.profileName);
      await runCommand("systemctl", ["--user", "stop", unit]);
    }
  }

  async restart(): Promise<void> {
    if (!this.profileName) {
      throw new Error("Cannot restart: no profile configured.");
    }

    if (this.os === "macos") {
      // macOS: unload + load for full restart
      const plistPath = this.getLaunchdPlistPath(this.profileName);
      await runCommand("launchctl", ["unload", plistPath]);
      await runCommand("launchctl", ["load", plistPath]);
    } else {
      const unit = this.getSystemdUnitName(this.profileName);
      await runCommand("systemctl", ["--user", "restart", unit]);
    }
  }

  /**
   * Sends SIGUSR1 to the running process for a hybrid reload
   * (in-process restart for config changes without full restart).
   */
  async hybridReload(): Promise<void> {
    const status = await this.getStatus();
    if (status.state !== "running" || !status.pid) {
      throw new Error("Cannot hybrid-reload: process is not running or PID unknown.");
    }
    process.kill(status.pid, "SIGUSR1");
  }

  async getStatus(): Promise<TargetStatus> {
    if (!this.profileName) {
      return { state: "not-installed" };
    }

    try {
      if (this.os === "macos") {
        const label = this.getServiceName(this.profileName);
        const output = await runCommand("launchctl", ["list", label]);
        // launchctl list <label> outputs: PID\tStatus\tLabel
        const lines = output.split("\n");
        const firstLine = lines.find((l) => l.includes(label));
        if (firstLine) {
          const parts = firstLine.split("\t");
          const pid = parts[0] && parts[0] !== "-" ? parseInt(parts[0], 10) : undefined;
          return {
            state: pid ? "running" : "stopped",
            pid,
            gatewayPort: this.port,
          };
        }
        return { state: "stopped", gatewayPort: this.port };
      } else {
        const unit = this.getSystemdUnitName(this.profileName);
        const output = await runCommand("systemctl", [
          "--user",
          "show",
          unit,
          "--property=ActiveState,MainPID",
        ]);
        const props: Record<string, string> = {};
        for (const line of output.split("\n")) {
          const [key, val] = line.split("=");
          if (key && val) props[key.trim()] = val.trim();
        }

        const activeState = props["ActiveState"];
        const pid = props["MainPID"] ? parseInt(props["MainPID"], 10) : undefined;

        let state: TargetStatus["state"];
        switch (activeState) {
          case "active":
            state = "running";
            break;
          case "inactive":
          case "deactivating":
            state = "stopped";
            break;
          case "failed":
            state = "error";
            break;
          default:
            state = "not-installed";
        }

        return {
          state,
          pid: pid && pid > 0 ? pid : undefined,
          gatewayPort: this.port,
        };
      }
    } catch {
      return { state: "not-installed" };
    }
  }

  async getLogs(options?: DeploymentLogOptions): Promise<string[]> {
    if (!this.profileName) {
      return [];
    }

    try {
      if (this.os === "macos") {
        // macOS: read from OpenClaw log file
        const home = process.env.HOME || "~";
        const logPath = `${home}/.openclaw/profiles/${this.profileName}/gateway.log`;
        const args = ["-n", String(options?.lines ?? 100), logPath];
        if (options?.follow) {
          args.unshift("-f");
        }
        const output = await runCommand("tail", args);
        return output.split("\n").filter(Boolean);
      } else {
        // Linux/WSL2: use journalctl for systemd
        const unit = this.getSystemdUnitName(this.profileName);
        const args = ["--user", "-u", unit, "--no-pager", "-n", String(options?.lines ?? 100)];
        if (options?.since) {
          args.push("--since", options.since.toISOString());
        }
        if (options?.follow) {
          args.push("-f");
        }
        const output = await runCommand("journalctl", args);
        let lines = output.split("\n").filter(Boolean);
        if (options?.filter) {
          const pattern = new RegExp(options.filter, "i");
          lines = lines.filter((line) => pattern.test(line));
        }
        return lines;
      }
    } catch {
      return [];
    }
  }

  async getEndpoint(): Promise<GatewayEndpoint> {
    return {
      host: "localhost",
      port: this.port,
      protocol: "ws",
    };
  }

  async destroy(): Promise<void> {
    if (!this.profileName) return;

    // Stop first
    try {
      await this.stop();
    } catch {
      // May already be stopped
    }

    // Uninstall the gateway profile
    try {
      await runCommand("openclaw", ["gateway", "uninstall", "--profile", this.profileName]);
    } catch {
      // Best-effort cleanup
    }

    // Remove service files
    if (this.os === "macos") {
      try {
        const plistPath = this.getLaunchdPlistPath(this.profileName);
        await runCommand("rm", ["-f", plistPath]);
      } catch {
        // Ignore
      }
    }

    this.profileName = "";
    this.port = 0;
  }

  /**
   * Return metadata describing this adapter's capabilities,
   * provisioning steps, and configuration requirements.
   */
  getMetadata(): AdapterMetadata {
    return {
      type: DeploymentTargetType.LOCAL,
      displayName: "Local Machine",
      icon: "computer",
      description: "Deploy on the current machine using systemd (Linux) or launchctl (macOS)",
      status: "ready",

      provisioningSteps: [
        {
          id: "install_openclaw",
          name: "Install OpenClaw",
          description: "Install OpenClaw gateway service on the local machine",
          estimatedDurationSec: 30,
        },
        {
          id: "configure_gateway",
          name: "Configure Gateway",
          description: "Apply OpenClaw configuration",
          estimatedDurationSec: 5,
        },
        {
          id: "start_service",
          name: "Start Service",
          description: "Start the gateway service via systemd/launchctl",
          estimatedDurationSec: 5,
        },
        {
          id: "connect_gateway",
          name: "Connect Gateway",
          description: "Establish WebSocket connection to gateway",
          estimatedDurationSec: 5,
        },
      ],

      resourceUpdateSteps: [],

      operationSteps: {
        install: "install_openclaw",
        start: "start_service",
      },

      capabilities: {
        scaling: false,
        sandbox: false,
        persistentStorage: true,
        httpsEndpoint: false,
        logStreaming: true,
      },

      credentials: [],
    };
  }

  /**
   * Validates that the given port has adequate spacing from existing ports.
   */
  static validatePortSpacing(existingPorts: number[], newPort: number): boolean {
    return validatePortSpacing([...existingPorts, newPort]).valid;
  }
}
