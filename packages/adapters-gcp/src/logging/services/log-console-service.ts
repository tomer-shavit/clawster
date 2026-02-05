/**
 * GCP Log Console Service
 *
 * Handles console link generation for logs.
 * Part of the ISP-compliant logging service split.
 */

import type { ILogConsoleService } from "@clawster/adapters-common";

/**
 * GCP Log Console Service for generating console links.
 * Implements ILogConsoleService interface.
 */
export class LogConsoleService implements ILogConsoleService {
  private readonly projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  /**
   * Get a console link to view logs in the cloud provider's UI.
   * Implements ILogConsoleService.getConsoleLink.
   */
  getConsoleLink(resourceId: string): string {
    const filter = encodeURIComponent(
      `resource.labels.instance_id="${resourceId}"`
    );
    return `https://console.cloud.google.com/logs/query;query=${filter}?project=${this.projectId}`;
  }

  /**
   * Get a link to the Cloud Logging console for a specific instance.
   *
   * @param instanceName - VM instance name
   * @param zone - Zone where the instance is located
   * @returns URL to Cloud Console logs viewer
   */
  getInstanceConsoleLink(instanceName: string, zone: string): string {
    const filter = encodeURIComponent(
      `resource.type="gce_instance" resource.labels.instance_id="${instanceName}"`
    );
    return `https://console.cloud.google.com/logs/query;query=${filter}?project=${this.projectId}`;
  }

  /**
   * Get a link to Cloud Console logs with a custom filter.
   *
   * @param filter - Cloud Logging filter expression
   * @returns URL to Cloud Console logs viewer
   */
  getConsoleQueryLink(filter: string): string {
    const encodedFilter = encodeURIComponent(filter);
    return `https://console.cloud.google.com/logs/query;query=${encodedFilter}?project=${this.projectId}`;
  }
}
