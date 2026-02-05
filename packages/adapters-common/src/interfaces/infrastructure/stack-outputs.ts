/**
 * Interface for retrieving infrastructure stack outputs.
 * Part of ISP-compliant infrastructure service split.
 */
export interface IStackOutputs {
  /**
   * Get the outputs of an infrastructure stack.
   * @param name - Stack name or ID
   * @returns Map of output keys to values
   */
  getStackOutputs(name: string): Promise<Record<string, string>>;
}
