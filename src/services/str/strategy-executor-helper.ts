import { Logger } from '@nestjs/common';
import { Strategy } from '../../models/str/strategy';
import { API } from '../../models/sys/exapi';
import { Config } from '../../common/config';
import { OrderForm } from '../ex-api/order-form';
import { SpotOrder } from '../../models/per/spot-order';
import { ExchangePair } from '../../models/mar/ex-pair';
import { ExPlaceOrderService } from '../ex-sync/ex-place-order.service';
import { AssetService } from '../per/asset.service';
import { ExapisService } from '../sys/exapis.service';
import { ExPriSyncService } from '../ex-sync/ex-pri-sync.service';
import { StrategiesService } from './strategies.service';
import { NotificationService } from '../sys/notification.service';


export interface StrategyExecutionBasicOptions {
  skipPlaceOrder?: boolean;
  skipSyncAfterPlacedOrder?: boolean;
  apis?: Map<string, API>;
  context?: 'web' | 'job';
}

export class StrategyExecutorHelper {
  protected readonly logger = new Logger(StrategyExecutorHelper.name);

  constructor(protected strategiesService: StrategiesService,
              protected exPriApiService: ExPlaceOrderService,
              protected assetService: AssetService,
              protected exapisService: ExapisService,
              protected exPriSyncService: ExPriSyncService,
              protected notificationService: NotificationService,) {
  }

  protected checkStrategy(strategy: Strategy): string {
    const {
      type, side, status,
      basePoint, expectingPercent, drawbackPercent,
      tradeVol, tradeVolPercent, tradeVolByValue
    } = strategy;

    if (status !== 'started') {
      return `strategy(${status}) is not started.`;
    }
    if (!basePoint) {
      return '基点未设置';
    }
    if (!expectingPercent) {
      return '期望未设置';
    }
    if ((tradeVolByValue && !tradeVol) || (!tradeVolByValue && !tradeVolPercent)) {
      return '交易量未设置';
    }
    if (type == Strategy.TypeLB || type == Strategy.TypeHB) {
      if (!drawbackPercent) {
        return '最大回落未设置';
      }
      if (side !== 'buy') {
        return `side must be 'buy' for strategy type=${type}`;
      }
    } else if (type == Strategy.TypeLS || type == Strategy.TypeHS) {
      if (side !== 'sell') {
        return `side must be 'sell' for strategy type=${type}`;
      }
    }

    return null;
  }

  protected setPeakValley(strategy: Strategy, currentPrice: number) {
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
  }

  protected checkTradingPointLB(strategy: Strategy,
                                currentPrice: number): boolean {
    const {basePoint, expectingPoint, valley, drawbackPercent} = strategy;

    if (valley > expectingPoint) {
      this.logger.log('not reach Expecting Value.');
      strategy.tradingPoint = expectingPoint + expectingPoint * drawbackPercent / 100.0;
      return false;
    }

    strategy.tradingPoint = valley + valley * drawbackPercent / 100.0;
    strategy.beyondExpect = true;
    let toTrade = true;

    if (currentPrice < strategy.tradingPoint) {
      this.logger.log('below Trading Point.');
      toTrade = false;
    } else {
      const delta = currentPrice - strategy.tradingPoint;
      const executorConfig = Config.StrategyExecutorConfig;
      const tolerantDelta = basePoint * executorConfig.TradingPriceDeltaPercent / 100.0;
      if (delta > tolerantDelta) {
        this.logger.warn('risen too much.');
        toTrade = false;
      }
    }

    return toTrade;
  }

  protected checkTradingPointHS(strategy: Strategy,
                                currentPrice: number): boolean {
    const {basePoint, expectingPoint, peak, drawbackPercent} = strategy;

    if (peak < expectingPoint) {
      this.logger.log('not reach Expecting Value.');
      strategy.tradingPoint = expectingPoint - expectingPoint * drawbackPercent / 100.0;
      return false;
    }

    strategy.tradingPoint = peak - peak * drawbackPercent / 100.0;
    strategy.beyondExpect = true;
    let toTrade = true;

    if (currentPrice > strategy.tradingPoint) {
      this.logger.log('above Trading Point.');
      toTrade = false;
    } else {
      const delta = strategy.tradingPoint - currentPrice;
      const executorConfig = Config.StrategyExecutorConfig;
      const tolerantDelta = basePoint * executorConfig.TradingPriceDeltaPercent / 100.0;
      if (delta > tolerantDelta) {
        this.logger.warn('dropped too much.');
        toTrade = false;
      }
    }

    return toTrade;
  }

  protected checkTradingPointLS(strategy: Strategy,
                                currentPrice: number): boolean {
    strategy.tradingPoint = strategy.expectingPoint;
    const toTrade = currentPrice <= strategy.tradingPoint;
    if (!toTrade) {
      this.logger.log(`currentPrice (${currentPrice}) > expectingPoint (${strategy.tradingPoint})`)
    }
    return toTrade;
  }

  protected checkTradingPointHB(strategy: Strategy,
                                currentPrice: number): boolean {
    strategy.tradingPoint = strategy.expectingPoint;
    const toTrade = currentPrice >= strategy.tradingPoint;
    if (!toTrade) {
      this.logger.log(`currentPrice (${currentPrice}) < tradingPoint (${strategy.tradingPoint})`)
    }
    return toTrade;
  }

  protected checkToTrade(strategy: Strategy, currentPrice: number): boolean {
    const type = strategy.type;
    if (type === Strategy.TypeLB) {
      return this.checkTradingPointLB(strategy, currentPrice);
    }
    if (type === Strategy.TypeHS) {
      return this.checkTradingPointHS(strategy, currentPrice);
    }
    if (type === Strategy.TypeLS) {
      return this.checkTradingPointLS(strategy, currentPrice);
    }
    if (type === Strategy.TypeHB) {
      return this.checkTradingPointHB(strategy, currentPrice);
    }
    throw new Error('未知策略类型：' + type);
  }

  protected notificationStrategyStr(s: Strategy): string {
    return `#${s.id}, ${s.ex}, ${s.type}, ${s.side}, ${s.baseCcy}-${s.quoteCcy}`;
  }

  protected async doTrade(strategy: Strategy,
                          currentPrice: number,
                          options: StrategyExecutionBasicOptions) {
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
      if (Config.StableCoins.includes(assetCcy)) {
        if (available < executorConfig.MinAssetUsdtAvailable) {
          throw new Error('可用余额不足');
        }
      } else {
        if (isSell && Config.StableCoins.includes(strategy.quoteCcy)) {
          const volumeUsdt = available * currentPrice;
          if (volumeUsdt < executorConfig.MinAssetUsdtAvailable) {
            throw new Error('可用余额不足');
          }
        } else if (available < executorConfig.MinAssetAvailable) {
          throw new Error('可用余额不足');
        }
      }
      volume = available * strategy.tradeVolPercent / 100.0;
    }

    const form = new OrderForm();
    form.ex = strategy.ex;
    form.side = strategy.side;
    form.type = 'market';
    form.symbol = strategy.symbol;
    form.baseCcy = strategy.baseCcy;
    form.quoteCcy = strategy.quoteCcy;
    if (isSell) {
      form.quantity = volume;
    } else {
      form.quoteQuantity = volume;
    }
    form.clientOrderId = SpotOrder.genClientOrderId(strategy.side, Config.ClientOrderIdPrefixes.strategy);

    let api: API = options.apis ? options.apis.get(strategy.ex) : null;
    if (!api) {
      api = await this.exapisService.findExapi(ex);
    }
    if (!api) {
      throw new Error(`API未配置（${ex}）`);
    }

    let placeOrderResult;
    try {
      placeOrderResult = await this.exPriApiService.placeOrder(api, form);
    } catch (e) {
      const formStr = JSON.stringify(form);
      this.logger.error(formStr);
      e.notificationTitle = '下单失败';
      e.extraMessage = 'Form: ' + formStr;
      throw e;
    }

    const formStr = JSON.stringify(form);
    this.logger.log(formStr);
    this.logger.log(placeOrderResult);
    this.notificationService.pushNotification('已下单',
      `strategy: #${strategy.id},\nForm: ${formStr}`);

    strategy.status = 'placed';
    strategy.orderPlacedAt = new Date();
    strategy.clientOrderId = form.clientOrderId;
    await this.strategiesService.update(strategy.id, strategy);

    asset.frozen += volume;
    await this.assetService.update(asset.id, {holding: asset.holding, frozen: asset.frozen});
  }

  protected async doAfterTrade(strategy: Strategy,
                               currentPrice: number,
                               options: StrategyExecutionBasicOptions = {}) {
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
}
