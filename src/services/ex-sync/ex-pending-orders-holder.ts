import { Injectable } from '@nestjs/common';
import { differenceBy } from 'lodash';
import { NotificationService } from '../sys/notification.service';
import { SpotOrder } from '../../models/per/spot-order';
import { OrderForm } from '../ex-api/order-form';
import { ExchangePair } from '../../models/mar/ex-pair';
import { Exch } from '../../models/sys/exch';
import { Config } from '../../common/config';

export interface OrderBasic extends ExchangePair {
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
export class ExPendingOrdersHolder {

  knownPendingOrders: { [ex: string]: OrderBasic[] } = {
    [Exch.CODE_OE]: [],
    [Exch.CODE_BA]: [],
    [Exch.CODE_HB]: [],
  };

  lastFetchTimestamps: { [ex: string]: number } = {};

  lastNotification: { ts: number, orderBasic: OrderBasic };

  constructor(private notificationService: NotificationService) {
  }

  toCheckPendingOrders(ex: string): boolean {
    const currentObs = this.knownPendingOrders[ex];
    if (!currentObs) {
      console.error('未知交易所：' + ex);
      return;
    }
    if (currentObs.length === 0) {
      return false;
    }
    const lastFetchTs = this.lastFetchTimestamps[ex];
    if (!lastFetchTs) {
      return true;
    }
    const checkInterval = Config.PendingOrdersCheckIntervalMinutes * 60 * 1000;
    return (Date.now() - lastFetchTs) >= checkInterval;
  }

  private pushNotification(ob: OrderBasic): void {
    if (!this.lastNotification) {
      this.doPushNotification(ob);
      return;
    }
    const minInterval = 5 * 1000;
    const elapse = Date.now() - this.lastNotification.ts;
    if (elapse >= minInterval) {
      this.doPushNotification(ob);
    } else {
      setTimeout(() => {
        this.doPushNotification(ob);
      }, minInterval - elapse);
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

  refreshKnownPendingOrders(ex: string, orders: SpotOrder[]): OrderBasic[] {
    const currentObs = this.knownPendingOrders[ex];
    if (!currentObs) {
      console.error('未知交易所：' + ex);
      return;
    }
    this.lastFetchTimestamps[ex] = Date.now();
    const obs: OrderBasic[] = orders.map(orderBasicFromOrder);
    const disappeared = differenceBy(currentObs, obs, ob => `${ob.ex}.${ob.orderId}`);
    for (const ob of disappeared) {
      this.pushNotification(ob);
    }
    this.knownPendingOrders[ex] = obs;
    return disappeared;
  }

}
