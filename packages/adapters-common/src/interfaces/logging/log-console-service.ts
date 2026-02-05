/**
 * Interface for generating console links.
 * Part of ISP-compliant logging service split.
 */
export interface ILogConsoleService {
  /**
   * Get a console link to view logs in the cloud provider's UI.
   * @param resourceId - The resource identifier
   */
  getConsoleLink(resourceId: string): string;
}
