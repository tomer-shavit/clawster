/**
 * Interface for log group lifecycle operations.
 * Part of ISP-compliant logging service split.
 */
export interface ILogGroupService {
  /**
   * Create a log group if it doesn't exist.
   * @param logGroupName - The name of the log group
   * @param tags - Optional tags to attach
   */
  createLogGroup(logGroupName: string, tags?: Record<string, string>): Promise<void>;

  /**
   * Delete a log group.
   * @param logGroupName - The name of the log group
   */
  deleteLogGroup(logGroupName: string): Promise<void>;

  /**
   * Check if a log group exists.
   * @param logGroupName - The name of the log group
   */
  logGroupExists(logGroupName: string): Promise<boolean>;
}
