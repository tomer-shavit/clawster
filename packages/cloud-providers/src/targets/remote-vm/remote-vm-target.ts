import {
  DeploymentTarget,
  DeploymentTargetType,
  InstallOptions,
  InstallResult,
  MoltbotConfigPayload,
  ConfigureResult,
  TargetStatus,
  DeploymentLogOptions,
  GatewayEndpoint,
  RemoteVMConfig,
} from "../../interface/deployment-target";

/**
 * Represents an SSH command to be executed on the remote host.
 * Used internally to construct command strings that will be
 * executed via SSH when the transport layer is wired up.
 */
interface SSHCommand {
  command: string;
  args: string[];
  /** Combined shell command string for execution */
  asShellString(): string;
}

/**
 * Creates an SSHCommand object from a command and arguments.
 */
function sshCommand(command: string, args: string[]): SSHCommand {
  return {
    command,
    args,
    asShellString(): string {
      const escaped = args.map((a) => {
        // Escape single quotes for shell safety
        if (a.includes(" ") || a.includes("'") || a.includes('"')) {
          return `'${a.replace(/'/g, "'\\''")}'`;
        }
        return a;
      });
      return `${command} ${escaped.join(" ")}`;
    },
  };
}

/**
 * RemoteVMTarget manages a Moltbot gateway on a remote machine via SSH.
 *
 * This implementation constructs the correct command strings for all
 * operations. The actual SSH transport is stubbed — commands are built
 * and stored, but not yet executed over a real SSH connection.
 *
 * When SSH execution is wired up, each method will send its constructed
 * command through the SSH channel instead of running locally.
 */
export class RemoteVMTarget implements DeploymentTarget {
  readonly type = DeploymentTargetType.REMOTE_VM;

  private sshConfig: RemoteVMConfig;
  private profileName: string = "";
  private port: number = 0;

  /** Last constructed command (useful for testing/debugging) */
  private lastCommand: SSHCommand | null = null;

  constructor(config: RemoteVMConfig) {
    this.sshConfig = config;
  }

  /**
   * Constructs an SSH command and records it.
   * In the future, this will execute the command over SSH.
   * For now, it returns the constructed command string.
   */
  private async executeRemote(command: string, args: string[]): Promise<string> {
    const cmd = sshCommand(command, args);
    this.lastCommand = cmd;

    // Stub: In production, this would use ssh2 to execute:
    //   ssh -p <sshPort> <user>@<host> <cmd.asShellString()>
    // For now, return a stub response indicating the command that would run.
    const connStr = `${this.sshConfig.username}@${this.sshConfig.host}:${this.sshConfig.port}`;
    return `[SSH stub] Would execute on ${connStr}: ${cmd.asShellString()}`;
  }

  /**
   * Returns the systemd service unit name.
   * Remote VMs are assumed to be Linux.
   */
  private getSystemdUnitName(profile: string): string {
    return `moltbot-gateway-${profile}.service`;
  }

  /**
   * Returns the SSH connection string for display/logging purposes.
   */
  getConnectionString(): string {
    return `${this.sshConfig.username}@${this.sshConfig.host}:${this.sshConfig.port}`;
  }

  /**
   * Returns the last command that was constructed (for testing).
   */
  getLastCommand(): SSHCommand | null {
    return this.lastCommand;
  }

  async install(options: InstallOptions): Promise<InstallResult> {
    this.profileName = options.profileName;
    this.port = options.port;

    const serviceName = this.getSystemdUnitName(options.profileName);

    const args = [
      "gateway",
      "install",
      "--profile",
      options.profileName,
      "--port",
      options.port.toString(),
    ];

    if (options.moltbotVersion) {
      args.push("--version", options.moltbotVersion);
    }

    try {
      const output = await this.executeRemote("moltbot", args);

      // Enable linger on the remote host
      await this.executeRemote("loginctl", [
        "enable-linger",
        this.sshConfig.username,
      ]);

      return {
        success: true,
        instanceId: `${this.sshConfig.host}:${serviceName}`,
        message: `Installed Moltbot gateway on remote VM ${this.sshConfig.host}. ${output}`,
        serviceName,
      };
    } catch (error) {
      return {
        success: false,
        instanceId: `${this.sshConfig.host}:${serviceName}`,
        message: `Failed to install on remote VM: ${error instanceof Error ? error.message : String(error)}`,
        serviceName,
      };
    }
  }

  async configure(config: MoltbotConfigPayload): Promise<ConfigureResult> {
    this.profileName = config.profileName;
    this.port = config.gatewayPort;

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
      await this.executeRemote("moltbot", args);
      return {
        success: true,
        message: `Configuration applied to profile "${config.profileName}" on ${this.sshConfig.host}`,
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
    const unit = this.getSystemdUnitName(this.profileName);
    await this.executeRemote("systemctl", ["--user", "start", unit]);
  }

  async stop(): Promise<void> {
    if (!this.profileName) {
      throw new Error("Cannot stop: no profile configured.");
    }
    const unit = this.getSystemdUnitName(this.profileName);
    await this.executeRemote("systemctl", ["--user", "stop", unit]);
  }

  async restart(): Promise<void> {
    if (!this.profileName) {
      throw new Error("Cannot restart: no profile configured.");
    }
    const unit = this.getSystemdUnitName(this.profileName);
    await this.executeRemote("systemctl", ["--user", "restart", unit]);
  }

  async getStatus(): Promise<TargetStatus> {
    if (!this.profileName) {
      return { state: "not-installed" };
    }

    try {
      const unit = this.getSystemdUnitName(this.profileName);
      const output = await this.executeRemote("systemctl", [
        "--user",
        "show",
        unit,
        "--property=ActiveState,MainPID",
      ]);

      // In stub mode, we return a synthetic status.
      // When SSH is wired, we would parse the actual output.
      return {
        state: "stopped",
        gatewayPort: this.port,
      };
    } catch {
      return { state: "not-installed" };
    }
  }

  async getLogs(options?: DeploymentLogOptions): Promise<string[]> {
    if (!this.profileName) {
      return [];
    }

    const unit = this.getSystemdUnitName(this.profileName);
    const args = ["--user", "-u", unit, "--no-pager", "-n", String(options?.lines ?? 100)];

    if (options?.since) {
      args.push("--since", options.since.toISOString());
    }

    try {
      const output = await this.executeRemote("journalctl", args);
      return output.split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  async getEndpoint(): Promise<GatewayEndpoint> {
    return {
      host: this.sshConfig.host,
      port: this.port,
      protocol: "ws",
    };
  }

  async destroy(): Promise<void> {
    if (!this.profileName) return;

    try {
      await this.stop();
    } catch {
      // May already be stopped
    }

    try {
      await this.executeRemote("moltbot", [
        "gateway",
        "uninstall",
        "--profile",
        this.profileName,
      ]);
    } catch {
      // Best-effort cleanup
    }

    this.profileName = "";
    this.port = 0;
  }
}
