import { Controller, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { NotificationService } from '../../services/sys/notification.service';
import { Notification } from '../../models/sys/notification';

@Controller('sys/notifications')
// @UseGuards(JwtAuthGuard)
// @Roles('admin')
export class NotificationsController {

  constructor(private notificationService: NotificationService) {
  }


  @Sse('sse')
  sse(): Observable<MessageEvent> {
    return this.notificationService.getNotificationObservable()
      .pipe(
        map((notification: Notification) => {
          return {
            // lastEventId: '',
            data: notification
          } as MessageEvent;
        }),
      );
  }
}
