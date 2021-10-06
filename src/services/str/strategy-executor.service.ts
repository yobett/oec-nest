import { Injectable, Logger } from '@nestjs/common';
import { StrategiesService } from './strategies.service';
import { Strategy } from '../../models/str/strategy';
import { Config } from '../../common/config';
import { CurrentPriceService } from '../mar/current-price.service';
import { OrderForm } from '../ex-api/order-form';
import { ExPriApiService } from '../ex-api/ex-pri-api.service';
import { AssetService } from '../per/asset.service';
import { API } from '../../models/sys/exapi';
import { ExapisService } from '../sys/exapis.service';
import { ExPriSyncService } from '../ex-sync/ex-pri-sync.service';
import { ExchangePair } from '../../models/mar/ex-pair';
import { SpotOrder } from '../../models/per/spot-order';
import { NotificationService } from '../sys/notification.service';

export interface StrategyExecutionOptions {
  type?: string;
  skipCheckStatus?: boolean;
  skipPlaceOrder?: boolean;
  ignoreInterval?: boolean;
  skipSyncExAssets?: boolean;
  skipSyncAfterPlacedOrder?: boolean;
  apis?: Map<string, API>;
  context?: 'web' | 'job';
}

@Injectable()
export class StrategyExecutorService {
  private readonly logger = new Logger(StrategyExecutorService.name);

  constructor(private strategiesService: StrategiesService,
              private currentPriceService: CurrentPriceService,
              private exPriApiService: ExPriApiService,
              private assetService: AssetService,
              private exapisService: ExapisService,
              private exPriSyncService: ExPriSyncService,
              private notificationService: NotificationService
  ) {
  }

  private checkStrategy(strategy: Strategy): void {
    const {
      basePoint, expectingPercent,
      tradeVol, tradeVolPercent, tradeVolByValue
    } = strategy;

    if ((tradeVolByValue && !tradeVol) || (!tradeVolByValue && !tradeVolPercent)) {
      throw new Error('交易量未设置');
    }
    if (!basePoint) {
      throw new Error('基点未设置');
    }
    if (!expectingPercent) {
      throw new Error('期望未设置');
    }
  }

  private checkWatchInterval(strategy: Strategy): boolean {
    const lastCheckAt = strategy.lastCheckAt;
    if (!lastCheckAt) {
      return true;
    }
    const watchLevel = strategy.watchLevel;
    const watchInterval = Config.StrategyWatchInterval[watchLevel];
    if (!watchInterval) {
      throw new Error('未配置关注间隔：' + watchLevel);
    }
    const interval = Date.now() - lastCheckAt.getTime();
    return interval >= watchInterval;
  }

  private setWatchLevelForWatchDirectionDown(strategy: Strategy,
                                             currentPrice: number,
                                             options: StrategyExecutionOptions): void {
    const {basePoint, intenseWatchPercent, mediumWatchPercent} = strategy;
    if (!intenseWatchPercent || !mediumWatchPercent) {
      throw new Error('未设置关注级别价格');
    }

    const intenseWatchValue = basePoint * (100 - intenseWatchPercent) / 100.0;
    const mediumWatchValue = basePoint * (100 - mediumWatchPercent) / 100.0;
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
    const {basePoint, intenseWatchPercent, mediumWatchPercent} = strategy;
    if (!intenseWatchPercent || !mediumWatchPercent) {
      throw new Error('未设置关注级别价格');
    }

    const intenseWatchValue = basePoint * (100 + intenseWatchPercent) / 100.0;
    const mediumWatchValue = basePoint * (100 + mediumWatchPercent) / 100.0;
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

  private checkTradingPointLB(strategy: Strategy,
                              currentPrice: number,
                              options: StrategyExecutionOptions): boolean {
    if (strategy.side !== 'buy') {
      throw new Error('side must be `buy` for strategy type=LB');
    }
    const {basePoint, expectingPoint, valley, drawbackPercent} = strategy;
    if (!drawbackPercent) {
      throw new Error('最大回落未设置');
    }

    this.setWatchLevelForWatchDirectionDown(strategy, currentPrice, options);

    let toTrade = true;
    if (valley > expectingPoint) {
      this.logger.log('not reach Expecting Value.');
      toTrade = false;
      strategy.tradingPoint = expectingPoint + expectingPoint * drawbackPercent / 100.0;
    } else {
      strategy.tradingPoint = valley + valley * drawbackPercent / 100.0;
      strategy.beyondExpect = true;
    }

    if (currentPrice < strategy.tradingPoint) {
      this.logger.log('below Trading Point.');
      toTrade = false;
    }
    const delta = currentPrice - strategy.tradingPoint;
    const executorConfig = Config.StrategyExecutorConfig;
    const tolerantDelta = basePoint * executorConfig.TradingPriceDeltaPercent / 100.0;
    if (delta > tolerantDelta) {
      this.logger.warn('risen too much.');
      toTrade = false;
    }

    return toTrade;
  }

  private checkTradingPointHS(strategy: Strategy,
                              currentPrice: number,
                              options: StrategyExecutionOptions): boolean {
    if (strategy.side !== 'sell') {
      throw new Error('side must be `sell` for strategy type=HS');
    }

    this.setWatchLevelForWatchDirectionUp(strategy, currentPrice, options);

    const {basePoint, expectingPoint, peak, drawbackPercent} = strategy;
    if (!drawbackPercent) {
      throw new Error('最大回落未设置');
    }

    let toTrade = true;
    if (peak < expectingPoint) {
      this.logger.log('not reach Expecting Value.');
      toTrade = false;
      strategy.tradingPoint = expectingPoint - expectingPoint * drawbackPercent / 100.0;
    } else {
      strategy.tradingPoint = peak - peak * drawbackPercent / 100.0;
      strategy.beyondExpect = true;
    }

    if (currentPrice > strategy.tradingPoint) {
      this.logger.log('above Trading Point.');
      toTrade = false;
    }
    const delta = strategy.tradingPoint - currentPrice;
    const executorConfig = Config.StrategyExecutorConfig;
    const tolerantDelta = basePoint * executorConfig.TradingPriceDeltaPercent / 100.0;
    if (delta > tolerantDelta) {
      this.logger.warn('dropped too much.');
      toTrade = false;
    }

    return toTrade;
  }

  private checkTradingPointLS(strategy: Strategy,
                              currentPrice: number,
                              options: StrategyExecutionOptions): boolean {
    if (strategy.side !== 'sell') {
      throw new Error('side must be `sell` for strategy type=LS');
    }

    this.setWatchLevelForWatchDirectionDown(strategy, currentPrice, options);

    strategy.tradingPoint = strategy.expectingPoint;
    const toTrade = currentPrice <= strategy.tradingPoint;
    if (!toTrade) {
      this.logger.log(`currentPrice (${currentPrice}) > expectingPoint (${strategy.tradingPoint})`)
    }
    return toTrade;
  }

  private checkTradingPointHB(strategy: Strategy,
                              currentPrice: number,
                              options: StrategyExecutionOptions): boolean {
    if (strategy.side !== 'buy') {
      throw new Error('side must be `sell` for strategy type=HB');
    }

    this.setWatchLevelForWatchDirectionUp(strategy, currentPrice, options);

    strategy.tradingPoint = strategy.expectingPoint;
    const toTrade = currentPrice >= strategy.tradingPoint;
    if (!toTrade) {
      this.logger.log(`currentPrice (${currentPrice}) < tradingPoint (${strategy.tradingPoint})`)
    }
    return toTrade;
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

    if (!options.skipCheckStatus) {
      const status = strategy.status;
      if (status !== 'started') {
        throw new Error('`status`(' + status + ') is not `started`.');
      }
    }

    this.checkStrategy(strategy);

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

    const {type, peak, valley} = strategy;

    strategy.lastCheckAt = new Date();
    strategy.lastCheckPrice = currentPrice;

    if (!peak || peak < currentPrice) {
      strategy.peak = currentPrice;
      strategy.peakTime = strategy.lastCheckAt;
    }
    if (!valley || valley > currentPrice) {
      strategy.valley = currentPrice;
      strategy.valleyTime = strategy.lastCheckAt;
    }

    // 止损/跟涨
    if (type === Strategy.TypeLS || type === Strategy.TypeHB) {
      if (strategy.updateBasePoint) {
        if ((type === Strategy.TypeLS && currentPrice > strategy.basePoint)
          || (type === Strategy.TypeHB && currentPrice < strategy.basePoint)) {
          this.logger.log(`BasePoint: ${strategy.basePoint} -> ${currentPrice}`);
          strategy.basePoint = currentPrice;
          Strategy.setExpectingPoint(strategy);
        }
      }
    }

    let toTrade = true;
    if (type === Strategy.TypeLB) {
      toTrade = this.checkTradingPointLB(strategy, currentPrice, options);
    } else if (type === Strategy.TypeHS) {
      toTrade = this.checkTradingPointHS(strategy, currentPrice, options);
    } else if (type === Strategy.TypeLS) {
      toTrade = this.checkTradingPointLS(strategy, currentPrice, options);
    } else if (type === Strategy.TypeHB) {
      toTrade = this.checkTradingPointHB(strategy, currentPrice, options);
    } else {
      throw new Error('未知策略类型：' + type);
    }

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


      await this.doTrade(strategy, options);

      await this.doAfterTrade(strategy, currentPrice, options);
    }

    return;
  }

  private async doTrade(strategy: Strategy, options: StrategyExecutionOptions) {
    const ex = strategy.ex;
    const isSell = strategy.side === 'sell';

    let volume; // sell: base; buy: quote
    const assetCcy = isSell ? strategy.baseCcy : strategy.quoteCcy;
    const asset = await this.assetService.findAsset(ex, assetCcy);
    if (!asset) {
      throw new Error(`资产未找到：${ex}.${assetCcy}`);
    }

    const available = asset.holding - asset.frozen;
    if (strategy.tradeVolByValue) {
      if (available < strategy.tradeVol) {
        throw new Error('可用余额不足');
      }
      volume = strategy.tradeVol;
    } else {
      const executorConfig = Config.StrategyExecutorConfig;
      if (assetCcy === 'USDT') {
        if (available < executorConfig.MinAssetUsdtAvailable) {
          throw new Error('可用余额不足');
        }
      } else if (available < executorConfig.MinAssetAvailable) {
        throw new Error('可用余额不足');
      }
      volume = available * strategy.tradeVolPercent / 100.0;
    }

    const orderForm = new OrderForm();
    orderForm.side = strategy.side;
    orderForm.type = 'market';
    orderForm.symbol = strategy.symbol;
    if (isSell) {
      orderForm.quantity = volume;
    } else {
      orderForm.quoteQuantity = volume;
    }
    orderForm.clientOrderId = SpotOrder.genClientOrderId(strategy.side, Config.ClientOrderIdPrefixes.strategy);

    let api: API = options.apis ? options.apis.get(strategy.ex) : null;
    if (!api) {
      api = await this.exapisService.findExapi(ex);
    }
    if (!api) {
      throw new Error(`API未配置（${ex}）`);
    }

    let placeOrderResult;
    try {
      placeOrderResult = await this.exPriApiService.placeOrder(api, ex, orderForm);
    } catch (e) {
      const formStr = JSON.stringify(orderForm);
      this.logger.error(formStr);
      e.notificationTitle = '下单失败';
      e.extraMessage = 'Form: ' + formStr;
      throw e;
    }

    const formStr = JSON.stringify(orderForm);
    this.logger.log(formStr);
    this.logger.log(placeOrderResult);
    this.notificationService.pushNotification('已下单',
      `strategy: ${this.notificationStrategyStr(strategy)}),\nForm: ${formStr}`);

    strategy.status = 'placed';
    strategy.orderPlacedAt = new Date();
    strategy.clientOrderId = orderForm.clientOrderId;
    await this.strategiesService.update(strategy.id, strategy);

    asset.frozen -= volume;
    await this.assetService.update(asset.id, {holding: asset.holding, frozen: asset.frozen});
  }

  private async doAfterTrade(strategy: Strategy,
                             currentPrice: number,
                             options: StrategyExecutionOptions = {}) {
    const nextStrategy = await this.strategiesService.tryInstantiateNext(strategy, currentPrice);
    if (nextStrategy) {
      this.logger.log('Next Strategy: ' + nextStrategy.id);
    }

    if (!options.skipSyncAfterPlacedOrder) {
      setTimeout(() => {
        const exp: ExchangePair = {
          ex: strategy.ex,
          baseCcy: strategy.baseCcy,
          quoteCcy: strategy.quoteCcy,
          symbol: strategy.symbol
        };
        this.exPriSyncService.syncAfterPlacedOrder(exp)
          .then(updated => {
            this.logger.log('syncAfterPlacedOrder, updated: ' + updated);
          });
      }, Config.PlaceOrderSyncDelay);
    }
  }

  private notificationStrategyStr(s: Strategy): string {
    return `#${s.id}, ${s.type}, ${s.ex}, ${s.baseCcy}-${s.quoteCcy}`;
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
    if (!options.apis) {
      options.apis = await this.exapisService.findExapis();
    }
    const apis = options.apis;
    const strategies = await this.strategiesService.findAllToExecute(options.type);
    const strategies2: Strategy[] = [];
    for (const strategy of strategies) {
      if (!apis.get(strategy.ex)) {
        this.logger.log(`no api (${strategy.ex}), skip: ` + strategy.id);
        continue;
      }
      strategies2.push(strategy);
    }

    this.logger.log('strategy size: ' + strategies2.length);
    if (strategies2.length === 0) {
      return;
    }

    for (const strategy of strategies2) {
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
