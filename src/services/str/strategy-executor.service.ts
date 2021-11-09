import { Injectable, Logger } from '@nestjs/common';
import { StrategiesService } from './strategies.service';
import { Strategy } from '../../models/str/strategy';
import { Config } from '../../common/config';
import { CurrentPriceService } from '../mar/current-price.service';
import { ExPlaceOrderService } from '../ex-sync/ex-place-order.service';
import { AssetService } from '../per/asset.service';
import { ExapisService } from '../sys/exapis.service';
import { ExPriSyncService } from '../ex-sync/ex-pri-sync.service';
import { NotificationService } from '../sys/notification.service';
import { PriceMonitorService, PricesSnapshot } from '../mar/price-monitor.service';
import { StrategyExecutionBasicOptions, StrategyExecutorHelper } from './strategy-executor-helper';

export interface StrategyExecutionOptions extends StrategyExecutionBasicOptions {
  type?: string;
  ignoreInterval?: boolean;
  skipSyncExAssets?: boolean;
}

@Injectable()
export class StrategyExecutorService extends StrategyExecutorHelper {
  protected readonly logger = new Logger(StrategyExecutorService.name);

  constructor(protected strategiesService: StrategiesService,
              protected currentPriceService: CurrentPriceService,
              protected exPriApiService: ExPlaceOrderService,
              protected assetService: AssetService,
              protected exapisService: ExapisService,
              protected exPriSyncService: ExPriSyncService,
              protected notificationService: NotificationService,
              protected priceMonitorService: PriceMonitorService
  ) {
    super(strategiesService, exPriApiService, assetService, exapisService, exPriSyncService, notificationService);
  }

  private checkWatchInterval(strategy: Strategy): boolean {
    const lastCheckAt = strategy.lastCheckAt;
    if (!lastCheckAt) {
      return true;
    }
    const watchLevel = strategy.watchLevel;
    const StrategyWatch = Config.StrategyWatch;
    let watchInterval = StrategyWatch.StrategyWatchInterval[watchLevel];
    if (!watchInterval) {
      throw new Error('未配置关注间隔：' + watchLevel);
    }
    const ts = Date.now();
    const lastQuotePrice: PricesSnapshot = this.priceMonitorService.getLastPricesSnapshot();
    if (lastQuotePrice) {
      const PriceMonitorInterval = Config.PriceMonitorConfig.IntervalMinutes
      if ((ts - lastQuotePrice.ts) < PriceMonitorInterval * 1.5) {
        let avg1HAbs = lastQuotePrice.avg1HAbs;
        const quotePrice = lastQuotePrice.prices.find(p => p.symbol === strategy.baseCcy);
        if (quotePrice) {
          const quote1h = Math.abs(quotePrice.percentChange1h);
          avg1HAbs = Math.max(avg1HAbs, quote1h);
        }
        // console.log('avg1HAbs: ' + avg1HAbs);
        const fold = StrategyWatch.Price1HPercentWatchIntervalFold(avg1HAbs);
        // console.log('fold: ' + fold);
        watchInterval /= fold;
        // console.log('watchInterval: ' + watchInterval);
      }
    }
    const interval = ts - lastCheckAt.getTime();
    return interval >= watchInterval;
  }

  private calculateWatchValue(strategy: Strategy): { intenseWatchValue: number, mediumWatchValue: number } {
    const {basePoint, expectingPercent} = strategy;
    const WatchIntervalPercentFromExpect = Config.StrategyWatch.WatchIntervalPercentFromExpect;
    const intenseWatchPercent = expectingPercent - WatchIntervalPercentFromExpect.intense;
    const mediumWatchPercent = expectingPercent - WatchIntervalPercentFromExpect.medium;
    const intenseWatchValue = basePoint * (100 - intenseWatchPercent) / 100.0;
    const mediumWatchValue = basePoint * (100 - mediumWatchPercent) / 100.0;
    return {intenseWatchValue, mediumWatchValue};
  }

  private setWatchLevelForWatchDirectionDown(strategy: Strategy,
                                             currentPrice: number,
                                             options: StrategyExecutionOptions): void {
    const {intenseWatchValue, mediumWatchValue} = this.calculateWatchValue(strategy);
    if (currentPrice <= intenseWatchValue) {
      if (strategy.watchLevel !== 'intense') {
        strategy.watchLevel = 'intense';
        this.logger.log('set watchLevel to: intense.');
        if (options.context === 'job') {
          this.notifyWatchLevelChange(strategy, strategy.watchLevel);
        }
      }
    } else if (currentPrice <= mediumWatchValue) {
      if (strategy.watchLevel !== 'medium') {
        strategy.watchLevel = 'medium';
        this.logger.log('set watchLevel to: medium.');
      }
    } else {
      strategy.watchLevel = 'loose';
    }
  }

  private setWatchLevelForWatchDirectionUp(strategy: Strategy,
                                           currentPrice: number,
                                           options: StrategyExecutionOptions): void {
    const {intenseWatchValue, mediumWatchValue} = this.calculateWatchValue(strategy);
    if (currentPrice >= intenseWatchValue) {
      if (strategy.watchLevel !== 'intense') {
        strategy.watchLevel = 'intense';
        this.logger.log('set watchLevel to: intense.');
        if (options.context === 'job') {
          this.notifyWatchLevelChange(strategy, strategy.watchLevel);
        }
      }
    } else if (currentPrice >= mediumWatchValue) {
      if (strategy.watchLevel !== 'medium') {
        strategy.watchLevel = 'medium';
        this.logger.log('set watchLevel to: medium.');
      }
    } else {
      strategy.watchLevel = 'loose';
    }
  }


  async executeStrategyDirectly(id: number,
                                options: StrategyExecutionOptions = {}): Promise<Strategy> {
    const strategy = await this.strategiesService.findOne(id);
    if (!strategy) {
      throw new Error('策略不存在');
    }
    options.ignoreInterval = true;
    await this.executeStrategy(strategy, options);
    return strategy;
  }

  async executeStrategy(strategy: Strategy,
                        options: StrategyExecutionOptions = {}): Promise<any> {

    const errMsg = this.checkStrategy(strategy);
    if (errMsg) {
      throw new Error(errMsg);
    }

    if (!options.ignoreInterval) {
      const exe = this.checkWatchInterval(strategy);
      if (!exe) {
        return;
      }
    }

    this.logger.log(`execute Strategy ${this.notificationStrategyStr(strategy)}`);

    const currentPrice = +(await this.currentPriceService.inquirePrice(strategy.ex, strategy.symbol));
    if (!currentPrice) {
      throw new Error('未能获取当前价格');
    }

    this.setPeakValley(strategy, currentPrice);

    const type = strategy.type;

    if (type === Strategy.TypeLB || type === Strategy.TypeLS) {
      this.setWatchLevelForWatchDirectionDown(strategy, currentPrice, options);
    }
    if (type === Strategy.TypeHB || type === Strategy.TypeHS) {
      this.setWatchLevelForWatchDirectionUp(strategy, currentPrice, options);
    }

    const toTrade = this.checkToTrade(strategy, currentPrice);

    await this.strategiesService.update(strategy.id, strategy);

    if (!toTrade) {
      return;
    }

    // trade

    if (options.skipPlaceOrder) {
      this.logger.log('skip placing order.');
    } else {
      if (options.skipSyncExAssets) {
        await this.exPriSyncService.syncExAssets(strategy.ex);
      }

      await this.doTrade(strategy, currentPrice, options);

      await this.doAfterTrade(strategy, currentPrice, options);
    }

  }


  private notifyWatchLevelChange(s: Strategy, level: string): void {
    this.notificationService.pushNotification(`关注级别`,
      `(${this.notificationStrategyStr(s)}) set watchLevel to ${level}`);
  }

  private notifyError(s: Strategy, err: any): void {
    const title = err.notificationTitle ? err.notificationTitle : `执行失败`;
    let body = `(${this.notificationStrategyStr(s)})\n${err.message}`;
    if (err.extraMessage) {
      body += `\n${err.extraMessage}`;
    }
    this.notificationService.pushNotification(title, body);
  }

  async executeAll(options: StrategyExecutionOptions = {}): Promise<void> {
    // if (!options.apis) {
    //   options.apis = await this.exapisService.findExapis();
    // }
    // const apis = options.apis;
    // const strategies = await this.strategiesService.findAllToExecute(options.type);
    const strategies = this.strategiesService.getRunningStrategies(options.type)
      .filter(s => !s.executor || s.executor === Strategy.ExecutorPr);
    // const strategies2: Strategy[] = [];
    // for (const strategy of strategies) {
    //   if (!apis.get(strategy.ex)) {
    //     this.logger.log(`no api (${strategy.ex}), skip: ` + strategy.id);
    //     continue;
    //   }
    //   strategies2.push(strategy);
    // }

    if (strategies.length === 0) {
      return;
    }
    this.logger.log('strategy size: ' + strategies.length);

    for (const strategy of strategies) {
      try {
        await this.executeStrategy(strategy, options);
      } catch (e) {
        if (options.context === 'web') {
          throw e;
        }
        this.logger.error(e);
        if (options.context === 'job') {
          this.notifyError(strategy, e);
        }
      }
    }
  }

}
