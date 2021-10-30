import { Injectable } from '@nestjs/common';
import { NotificationService } from '../sys/notification.service';
import { SpotOrder } from '../../models/per/spot-order';
import { OrderForm } from '../ex-api/order-form';
import { ExchangePair } from '../../models/mar/ex-pair';
import { Exch } from '../../models/sys/exch';

interface OrderBasic extends ExchangePair {
  side: string;
  orderId: string;
}

function orderBasicFromOrder(order: SpotOrder): OrderBasic {
  return {
    ex: order.ex,
    symbol: order.pairSymbol,
    baseCcy: order.baseCcy,
    quoteCcy: order.quoteCcy,
    side: order.side,
    orderId: order.orderId
  };
}


@Injectable()
export class ExPendingOrdersService {

  knownPendingOrders: { [ex: string]: OrderBasic[] } = {
    [Exch.CODE_OE]: [],
    [Exch.CODE_BA]: [],
    [Exch.CODE_HB]: [],
  }

  lastNotification: { ts: number, orderBasic: OrderBasic };

  constructor(private notificationService: NotificationService) {
  }

  private pushNotification(ob: OrderBasic): void {
    const minInterval = 5 * 1000;
    if (!this.lastNotification || (Date.now() - this.lastNotification.ts) > minInterval) {
      this.doPushNotification(ob);
    } else {
      setTimeout(() => {
        this.doPushNotification(ob);
      }, minInterval);
    }
  }

  private doPushNotification(ob: OrderBasic): void {
    const title = `Order Filled`;
    const body = `${ob.ex}, ${ob.side}, ${ob.baseCcy}-${ob.quoteCcy}`;
    this.notificationService.pushNotification(title, body);
    this.lastNotification = {ts: Date.now(), orderBasic: ob};
  }

  notifyNewOrderPlaced(orderId: string, form: OrderForm): void {
    if (form.type !== 'limit') {
      return;
    }
    process.nextTick(() => {
      const currentObs = this.knownPendingOrders[form.ex];
      const ob: OrderBasic = {
        ex: form.ex,
        symbol: form.symbol,
        baseCcy: form.baseCcy,
        quoteCcy: form.quoteCcy,
        side: form.side,
        orderId: orderId
      };
      currentObs.push(ob);
    });
  }

  notifySynchronized(order: SpotOrder): void {
    if (order.type !== 'limit') {
      return;
    }
    process.nextTick(() => {
      const ex = order.ex;
      const currentObs = this.knownPendingOrders[ex];
      if (!currentObs) {
        console.error('未知交易所：' + ex);
        return;
      }
      const ob = orderBasicFromOrder(order);
      const currentOb = currentObs.find(cob => cob.ex === ob.ex && cob.orderId === ob.orderId);
      if (currentOb) {
        this.knownPendingOrders[ex] = currentObs.filter(cob => !(cob.ex === ob.ex && cob.orderId === ob.orderId));
        if (order.status !== 'canceled' && order.status !== 'submitted') {
          this.pushNotification(currentOb);
        }
      }
    });
  }

  notifyFetchedEx(ex: string, orders: SpotOrder[]): void {
    process.nextTick(() => {
      const currentObs = this.knownPendingOrders[ex];
      if (!currentObs) {
        console.error('未知交易所：' + ex);
        return;
      }
      const obs: OrderBasic[] = orders.map(orderBasicFromOrder);
      for (const ob of obs) {
        const currentOb = currentObs.find(cob => cob.ex === ob.ex && cob.orderId === ob.orderId);
        if (currentOb) {
          this.pushNotification(currentOb);
        }
      }
      this.knownPendingOrders[ex] = obs;
    });
  }

}
