import { Module, forwardRef } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { HealthService } from "./health.service";
import { HealthController } from "./health.controller";
import { OpenClawHealthService } from "./openclaw-health.service";
import { HealthAggregatorService } from "./health-aggregator.service";
import { DiagnosticsService } from "./diagnostics.service";
import { AlertingService } from "./alerting.service";
import { LogStreamingGateway } from "./log-streaming.gateway";
import { AlertsModule } from "../alerts/alerts.module";
import { NotificationChannelsModule } from "../notification-channels/notification-channels.module";

@Module({
  imports: [
    forwardRef(() => AlertsModule),
    NotificationChannelsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    OpenClawHealthService,
    HealthAggregatorService,
    DiagnosticsService,
    AlertingService,
    LogStreamingGateway,
  ],
  exports: [
    HealthService,
    OpenClawHealthService,
    HealthAggregatorService,
    DiagnosticsService,
    AlertingService,
  ],
})
export class HealthModule {}
