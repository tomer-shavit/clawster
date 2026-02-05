/**
 * Interface for executing commands on compute instances.
 * Part of ISP-compliant compute service split.
 */
export interface IInstanceCommandExecutor {
  /**
   * Run commands on a compute instance.
   * Uses provider-specific mechanisms (SSM, Run Command, SSH, etc.)
   * @param name - Instance name or ID
   * @param commands - Array of commands to execute
   * @returns Combined command output
   */
  runCommand(name: string, commands: string[]): Promise<string>;
}
