import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { Notification } from '../../models/sys/notification';

@Injectable()
export class NotificationService {
  notificationSubject: Subject<Notification> = new Subject<Notification>();

  getNotificationObservable(): Observable<Notification> {
    return this.notificationSubject;
  }

  push(notification: Notification) {
    this.notificationSubject.next(notification);
  }


  pushNotification(title: string, body: string) {
    this.push({title, body});
  }
}
