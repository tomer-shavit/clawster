import { Controller, Get } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("metrics")
  async getMetrics() {
    return this.dashboardService.getDashboardMetrics();
  }

  @Get("health")
  async getHealth() {
    return this.dashboardService.getOverallHealth();
  }

  @Get("activity")
  async getActivity() {
    return this.dashboardService.getRecentActivity();
  }
}
