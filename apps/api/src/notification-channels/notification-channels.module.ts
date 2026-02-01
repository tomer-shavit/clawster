import { Module } from "@nestjs/common";
import { NotificationChannelsController } from "./notification-channels.controller";
import { NotificationChannelsService } from "./notification-channels.service";
import { NotificationDeliveryService } from "./notification-delivery.service";

@Module({
  controllers: [NotificationChannelsController],
  providers: [NotificationChannelsService, NotificationDeliveryService],
  exports: [NotificationChannelsService, NotificationDeliveryService],
})
export class NotificationChannelsModule {}
