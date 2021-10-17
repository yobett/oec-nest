import { Injectable, Logger } from '@nestjs/common';
import { CurrentPriceService } from './current-price.service';
import { Config } from '../../common/config';
import { NotificationService } from '../sys/notification.service';


export type AvgPercents = { avg1H: number, /*avg24H: number,*/ ccyCount: number };

@Injectable()
export class PriceMonitorService {

  private readonly logger = new Logger(PriceMonitorService.name);

  constructor(protected currentPriceService: CurrentPriceService,
              protected notificationService: NotificationService) {
  }

  async getCcyAvgPercents(): Promise<AvgPercents> {
    const quotes = await this.currentPriceService.ccyQuotes();
    let avg1H = 0;
    // let avg24H = 0;
    let count = 0;
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
    }
    if (count > 0) {
      avg1H /= count;
      // avg24H /= count;
    }

    return {avg1H, ccyCount: count};
  }


  async checkQuotesAndNotifyIfNecessary(threshold: number): Promise<void> {
    const observersCount = this.notificationService.getObserversCount();
    if (observersCount === 0) {
      this.logger.log('no observer.');
      return;
    }

    const {avg1H, ccyCount} = await this.getCcyAvgPercents();
    if (ccyCount === 0) {
      return;
    }
    const avg1HStr = avg1H.toFixed(2) + '%';
    this.logger.log(`avg 1H: ${avg1HStr}, threshold: ${threshold}%`);
    if (Math.abs(avg1H) < threshold) {
      return;
    }
    const title = avg1H > 0 ? 'Price 🠕' : 'Price 🠗';
    const body = `Quote avg 1H: ${avg1H > 0 ? '+' : ''}${avg1HStr}`;
    this.notificationService.pushNotification(title, body);
  }

}
