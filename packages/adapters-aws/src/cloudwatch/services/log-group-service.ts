/**
 * Log Group Service
 *
 * Handles log group lifecycle operations (create, delete, exists).
 * Part of SRP-compliant CloudWatch service split.
 */

import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  DeleteLogGroupCommand,
  DescribeLogGroupsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import type { ILogGroupService } from "@clawster/adapters-common";
import { AwsErrorHandler } from "../../errors";

export class LogGroupService implements ILogGroupService {
  constructor(private readonly client: CloudWatchLogsClient) {}

  /**
   * Create a log group if it doesn't exist.
   */
  async createLogGroup(
    logGroupName: string,
    tags?: Record<string, string>
  ): Promise<void> {
    try {
      await this.client.send(
        new CreateLogGroupCommand({
          logGroupName,
          tags,
        })
      );
    } catch (error) {
      // Ignore if already exists
      if (!AwsErrorHandler.isResourceAlreadyExists(error)) {
        throw error;
      }
    }
  }

  /**
   * Delete a log group.
   */
  async deleteLogGroup(logGroupName: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteLogGroupCommand({
          logGroupName,
        })
      );
    } catch (error) {
      // Ignore if not found
      if (!AwsErrorHandler.isResourceNotFound(error)) {
        throw error;
      }
    }
  }

  /**
   * Check if a log group exists.
   */
  async logGroupExists(logGroupName: string): Promise<boolean> {
    try {
      const result = await this.client.send(
        new DescribeLogGroupsCommand({
          logGroupNamePattern: logGroupName,
        })
      );
      return (
        result.logGroups?.some((lg) => lg.logGroupName === logGroupName) ??
        false
      );
    } catch {
      return false;
    }
  }
}
