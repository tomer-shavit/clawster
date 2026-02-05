/**
 * Log Console Service
 *
 * Handles console link generation.
 * Part of SRP-compliant CloudWatch service split.
 */

import type { ILogConsoleService } from "@clawster/adapters-common";

export class LogConsoleService implements ILogConsoleService {
  constructor(private readonly region: string) {}

  /**
   * Get a console link to view logs in CloudWatch.
   */
  getConsoleLink(resourceId: string): string {
    return `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#logsV2:log-groups/log-group/${encodeURIComponent(resourceId)}`;
  }
}
