import { Injectable, Logger } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { differenceBy } from 'lodash';
import { StrategiesService } from './strategies.service';
import { NotificationService } from '../sys/notification.service';
import { AssetService } from '../per/asset.service';
import { ExapisService } from '../sys/exapis.service';
import { ExPriSyncService } from '../ex-sync/ex-pri-sync.service';
import { ExPlaceOrderService } from '../ex-sync/ex-place-order.service';
import { Strategy } from '../../models/str/strategy';
import { WsTickerService } from '../ex-api/ws-ticker.service';
import { WsTicker } from '../ex-api/ws-ticker';
import { StrategyExecutorHelper } from './strategy-executor-helper';
import { StrategyChange } from './running-strategies-holder';
import { Config } from '../../common/config';


class RunningStrategy {
  strategy: Strategy;
  tickerSubscription?: Subscription;
  lastSaveTs?: number;

  constructor(strategy: Strategy) {
    this.strategy = strategy;
  }
}

@Injectable()
export class StrategyExecutorWsService extends StrategyExecutorHelper {
  protected readonly logger = new Logger(StrategyExecutorWsService.name);

  private runningMap: Map<number, RunningStrategy> = new Map<number, RunningStrategy>();


  constructor(protected strategiesService: StrategiesService,
              protected exPriApiService: ExPlaceOrderService,
              protected assetService: AssetService,
              protected exapisService: ExapisService,
              protected exPriSyncService: ExPriSyncService,
              protected notificationService: NotificationService,
              protected wsTickerService: WsTickerService
  ) {
    super(strategiesService, exPriApiService, assetService, exapisService, exPriSyncService, notificationService);
    strategiesService.watchRunningStrategiesChange()
      .subscribe(
        (change: StrategyChange) => this.onRunningStrategyChange(change),
        e => this.logger.error(e));
  }

  private onRunningStrategyChange(change: StrategyChange): void {
    const strategy = change.strategy;
    if (strategy && strategy.executor !== Strategy.ExecutorWs) {
      const curr = this.runningMap.get(strategy.id);
      if (curr) {
        this.stopRunning(curr);
      }
      return;
    }
    this.logger.log('on change, ' + change.type);
    if (change.type === 'full') {
      this.refresh();
      return;
    }

    // strategy is not null

    if (change.type === 'add') {
      this.runStrategy(strategy);
      return;
    }
    if (change.type === 'remove') {
      this.stopStrategy(strategy);
      return;
    }
    if (change.type === 'update') {
      const curr = this.runningMap.get(strategy.id);
      if (curr) {
        const errMsg = this.checkStrategy(strategy);
        if (errMsg) {
          this.logger.error(errMsg);
          return;
        }
        curr.strategy = strategy;
      } else {
        this.runStrategy(strategy);
      }
    }
  }

  refresh(): void {
    const strategies = this.strategiesService.getRunningStrategies().filter(s => s.executor === Strategy.ExecutorWs);
    const currentRunning = Array.from(this.runningMap.values()).map(rs => rs.strategy);
    const toRemove = differenceBy(currentRunning, strategies, 'id');
    this.logger.log(`to remove: ${toRemove.length}`);
    for (const strategy of toRemove) {
      try {
        this.stopStrategy(strategy);
      } catch (e) {
        this.logger.error(e);
      }
    }
    const toAdd = differenceBy(strategies, currentRunning, 'id');
    this.logger.log(`to add: ${toAdd.length}`);
    for (const strategy of toAdd) {
      try {
        this.runStrategy(strategy);
      } catch (e) {
        this.logger.error(e);
      }
    }
  }

  stopStrategy(strategy: Strategy): void {
    const rs = this.runningMap.get(strategy.id);
    if (!rs) {
      return;
    }
    this.stopRunning(rs);
  }

  stopRunning(rs: RunningStrategy): void {
    const strategy = rs.strategy;
    this.logger.log('stopRunning, ' + this.notificationStrategyStr(strategy));
    if (rs.tickerSubscription) {
      rs.tickerSubscription.unsubscribe();
    }
    this.runningMap.delete(strategy.id);
  }

  runStrategy(strategy: Strategy): void {
    let rs = this.runningMap.get(strategy.id);
    if (rs) {
      return;
    }
    const errMsg = this.checkStrategy(strategy);
    if (errMsg) {
      this.logger.error(errMsg);
      return;
    }
    this.logger.log('runStrategy, ' + this.notificationStrategyStr(strategy));
    rs = new RunningStrategy(strategy);
    const {ex, symbol} = strategy;
    const rate = Config.StrategyExecutorWsConfig.TickerRateSeconds * 1000;
    rs.tickerSubscription = this.wsTickerService.watch(ex, symbol, rate)
      .subscribe(
        async (ticker: WsTicker) => this.onTicker(rs, ticker).catch(e => this.logger.error(e)),
        e => this.logger.error(e));
    this.runningMap.set(strategy.id, rs);
  }

  protected checkStrategy(strategy: Strategy): string {
    if (strategy.executor !== Strategy.ExecutorWs) {
      return `executor was changed(${strategy.executor})`;
    }
    return super.checkStrategy(strategy);
  }

  async onTicker(rs: RunningStrategy, ticker: WsTicker): Promise<void> {
    const strategy = rs.strategy;
    const errMsg = this.checkStrategy(strategy);
    if (errMsg) {
      this.logger.error(errMsg);
      this.stopRunning(rs);
      return;
    }
    this.logger.debug('onTicker, ' + this.notificationStrategyStr(strategy));

    if (strategy.symbol !== ticker.symbol) {
      // shouldn't happened
      this.logger.error(`symbol mismatch: ${strategy.symbol} ~ ${ticker.symbol}`);
      return;
    }
    if (!ticker.price) {
      // shouldn't happened
      this.logger.error(`no price.`);
      return;
    }
    const currentPrice = ticker.price;

    this.setPeakValley(strategy, currentPrice);

    const toTrade = this.checkToTrade(strategy, currentPrice);

    const saveRate = Config.StrategyExecutorWsConfig.StrategySaveRateSeconds * 1000;
    if (!rs.lastSaveTs || (Date.now() - rs.lastSaveTs) > saveRate) {
      await this.strategiesService.update0(strategy.id, strategy);
      rs.lastSaveTs = Date.now();
    }

    if (!toTrade) {
      return;
    }

    await this.exPriSyncService.syncExAssets(strategy.ex).catch(e => this.logger.error(e));

    await this.doTrade(strategy, currentPrice, {});

    await this.doAfterTrade(strategy, currentPrice, {});
  }

}
