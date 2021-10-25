import { Injectable, Logger } from '@nestjs/common';
import { CurrentPriceService } from './current-price.service';
import { Config } from '../../common/config';
import { NotificationService } from '../sys/notification.service';
import { Quote } from '../../models/mar/quote';

const {IntervalMinutes, IdleIntervalMinutes, PercentThreshold, PercentDiffThreshold} = Config.PriceMonitorConfig;

export type SymbolPrice = {
  symbol: string,
  price: number,
  percentChange1h: number,
  // percentChange24h: number,
  avg1HDiff: number,
  avg1HDiffAbs: number,
};

export type PricesSnapshot = {
  ts: number,
  prices: SymbolPrice[],
  avg1H: number,
  avg1HAbs: number,
  /*avg24H: number,*/
}


@Injectable()
export class PriceMonitorService {

  private readonly logger = new Logger(PriceMonitorService.name);

  lastQuotePrice: PricesSnapshot;

  lastPriceRequestTs: number;

  constructor(protected currentPriceService: CurrentPriceService,
              protected notificationService: NotificationService) {
  }

  getLastPricesSnapshot(): PricesSnapshot {
    this.lastPriceRequestTs = Date.now();
    return this.lastQuotePrice;
  }

  async queryPrices(): Promise<PricesSnapshot> {
    const quotes: Quote[] = await this.currentPriceService.ccyQuotes();
    if (quotes.length === 0) {
      return null;
    }
    const ts = Date.now();
    let avg1H = 0;
    // let avg24H = 0;
    let count = 0;
    const prices: SymbolPrice[] = [];
    for (const quote of quotes) {
      if (Config.StableCoins.includes(quote.symbol)) {
        continue;
      }
      const c1h = quote['percent_change_1h'];
      // const c24h = quote['percent_change_24h'];
      if (typeof c1h !== 'undefined'/* && typeof c24h !== 'undefined'*/) {
        avg1H += c1h;
        // avg24H += c24h;
        count++;
      }
      prices.push({
        symbol: quote.symbol,
        price: quote.price,
        percentChange1h: c1h,
        avg1HDiff: 0,
        avg1HDiffAbs: 0
      })
    }
    if (count > 0) {
      avg1H /= count;
      // avg24H /= count;
    }
    for (const price of prices) {
      price.avg1HDiff = price.percentChange1h - avg1H;
      price.avg1HDiffAbs = Math.abs(price.avg1HDiff);
    }
    return {
      ts,
      prices,
      avg1H,
      avg1HAbs: Math.abs(avg1H)
    };
  }

  notifyAvg1H(snapshot: PricesSnapshot, lastQuotePrice: PricesSnapshot | null): boolean {
    const {ts, avg1H, avg1HAbs} = snapshot;
    const avg1HStr = avg1H.toFixed(2) + '%';
    this.logger.log(`avg 1H: ${avg1HStr}, threshold: ${PercentThreshold}%`);
    if (avg1HAbs < PercentThreshold) {
      return false;
    }
    if (lastQuotePrice) {
      if ((ts - lastQuotePrice.ts) < IntervalMinutes * 1.5) {
        if (avg1HAbs <= lastQuotePrice.avg1HAbs) {
          return false;
        }
      }
    }
    const title = avg1H > 0 ? 'Price 🠕' : 'Price 🠗';
    const body = `avg 1H: ${avg1H > 0 ? '+' : ''}${avg1HStr}`;
    this.notificationService.pushNotification(title, body);
    return true;
  }

  notifyBooming(snapshot: PricesSnapshot, lastQuotePrice: PricesSnapshot | null): boolean {
    let lastPrices: SymbolPrice[] = null;
    if (lastQuotePrice) {
      if ((snapshot.ts - lastQuotePrice.ts) < IntervalMinutes * 1.5) {
        lastPrices = lastQuotePrice.prices;
      }
    }
    let prices = snapshot.prices.filter(p => {
      if (p.avg1HDiffAbs <= PercentDiffThreshold) {
        return false;
      }
      if (lastPrices) {
        const lastPrice = lastPrices.find(lp => lp.symbol === p.symbol);
        if (lastPrice && p.avg1HDiffAbs <= lastPrice.avg1HDiffAbs) {
          return false;
        }
      }
      return true;
    }).sort((p1, p2) => p2.avg1HDiffAbs - p1.avg1HDiffAbs);
    if (prices.length === 0) {
      return false;
    }
    prices = prices.slice(0, 3);
    let title = 'Boom';
    if (prices.every(p => p.avg1HDiff > 0)) {
      title += ' 🠕';
    } else if (prices.every(p => p.avg1HDiff < 0)) {
      title += ' 🠗';
    }
    const body = prices.map(p => `${p.symbol}: ${p.avg1HDiff > 0 ? '+' : ''}${p.avg1HDiff.toFixed(2)}%`)
      .join(', ');
    this.notificationService.pushNotification(title, body);
    return true;
  }

  async checkPricesAndNotifyIfNecessary(): Promise<void> {

    const observersCount = this.notificationService.getObserversCount();
    if (observersCount === 0) {
      const lts = this.lastPriceRequestTs;
      if (lts) {
        const priceRequestInterval = Date.now() - lts;
        if (priceRequestInterval && priceRequestInterval > IdleIntervalMinutes * 60 * 1000) {
          this.logger.log(`not request prices for last ${IdleIntervalMinutes} minutes.`);
          return;
        }
      }
    }

    const snapshot = await this.queryPrices();
    if (!snapshot) {
      return;
    }
    const lastQuotePrice: PricesSnapshot = this.lastQuotePrice;
    this.lastQuotePrice = snapshot;

    if (observersCount === 0) {
      this.logger.log('no observer.');
      return;
    }

    const notified = this.notifyAvg1H(snapshot, lastQuotePrice);
    if (notified) {
      setTimeout(() => {
        this.notifyBooming(snapshot, lastQuotePrice);
      }, 20 * 1000);
    } else {
      this.notifyBooming(snapshot, lastQuotePrice);
    }

  }

}
