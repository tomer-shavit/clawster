import { Controller, Get, Param } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { ProvisioningEventsService } from "./provisioning-events.service";

@Controller("instances")
export class ProvisioningController {
  constructor(
    private readonly provisioningEvents: ProvisioningEventsService,
  ) {}

  @Public()
  @Get(":id/provisioning/status")
  getProvisioningStatus(@Param("id") instanceId: string) {
    const progress = this.provisioningEvents.getProgress(instanceId);
    if (!progress) {
      return { instanceId, status: "unknown", steps: [] };
    }
    return progress;
  }
}
