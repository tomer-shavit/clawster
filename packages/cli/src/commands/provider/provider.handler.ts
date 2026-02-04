/**
 * Provider Command Handler
 *
 * Lists available deployment targets.
 */

import type { IOutputService } from "../../interfaces/output.interface";
import { displayTargetList, getDeploymentTargets } from "../../utils/targets";

export class ProviderListHandler {
  constructor(private readonly output: IOutputService) {}

  /**
   * Execute the provider list command.
   */
  async execute(): Promise<void> {
    this.output.header("Available Deployment Targets", "");
    this.output.newline();

    const targets = getDeploymentTargets();
    displayTargetList(this.output, targets);

    this.output.newline();
  }
}

/**
 * Factory function.
 */
export function createProviderListHandler(output: IOutputService): ProviderListHandler {
  return new ProviderListHandler(output);
}
