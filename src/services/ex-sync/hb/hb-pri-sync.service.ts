import { Injectable, Logger } from '@nestjs/common';
import { groupBy } from 'lodash';
import { AssetService } from '../../per/asset.service';
import { SpotOrderService } from '../../per/spot-order.service';
import { Exch } from '../../../models/sys/exch';
import { Asset, CreateAssetDto } from '../../../models/per/asset';
import { SyncResult } from '../../../models/sync-result';
import { CreateSpotOrderDto, SpotOrder, UpdateSpotOrderDto } from '../../../models/per/spot-order';
import { ExPairsService } from '../../mar/pairs.service';
import { HbPriApiService } from '../../ex-api/hb/hb-pri-api.service';
import { ExchangePair, ExPair } from '../../../models/mar/ex-pair';
import { LastTransactionService } from '../../per/last-transaction.service';
import { API } from '../../../models/sys/exapi';
import { Config } from '../../../common/config';
import { StrategiesService } from '../../str/strategies.service';

@Injectable()
export class HbPriSyncService {

  exchCode = Exch.CODE_HB;
  static exchCode = Exch.CODE_HB;

  private readonly logger = new Logger(HbPriSyncService.name);

  constructor(private hbPriApiService: HbPriApiService,
              private assetService: AssetService,
              private pairsService: ExPairsService,
              private spotOrderService: SpotOrderService,
              private lastTransactionService: LastTransactionService,
              private strategiesService: StrategiesService
  ) {

  }

  async syncAssets(api: API): Promise<SyncResult> {
    let create = 0;
    let update = 0;
    let skip = 0;
    const res = await this.hbPriApiService.balance(api);
    const items = res.list;

    const currencyBalances = {};
    for (const item of items) {
      const {currency, type, balance} = item;
      let balObj = currencyBalances[currency];
      if (!balObj) {
        balObj = {};
        currencyBalances[currency] = balObj;
      }
      balObj[type] = balance;
    }

    const assets: Asset[] = await this.assetService.findByEx(this.exchCode);
    const assetsMap: Map<string, Asset> = new Map<string, Asset>(assets.map(a => [a.ccy, a]));

    const threshold = Config.EX_DATA_SYNC.UPDATE_ASSET_THRESHOLD;
    const lastSync = new Date();
    for (const currency in currencyBalances) {
      const balObj = currencyBalances[currency];
      const tradeBal = balObj['trade'];
      const frozenBal = balObj['frozen'];

      const currencyCap = currency.toUpperCase();
      const asset = assetsMap.get(currencyCap);
      const free = +tradeBal;
      const frozen = +frozenBal;
      const holding = free + frozen;
      if (asset) {
        if (holding <= threshold && frozen <= threshold) {
          await this.assetService.remove(asset.id);
        } else {
          if (Math.abs(holding - asset.holding) > threshold
            || Math.abs(frozen - asset.frozen) > threshold) {
            await this.assetService.update(asset.id, {holding, frozen, lastSync});
            update++;
          } else {
            skip++;
          }
        }
      } else {
        if (holding < threshold && frozen < threshold) {
          skip++;
          continue;
        }
        const dto = new CreateAssetDto();
        dto.ex = this.exchCode;
        dto.ccy = currencyCap;
        dto.holding = holding;
        dto.frozen = frozen;
        dto.lastSync = lastSync;
        await this.assetService.create(dto);
        create++;
      }
    }
    return {update, create, skip} as SyncResult;
  }

  static setOrderProps(order: SpotOrder | CreateSpotOrderDto | UpdateSpotOrderDto, odr: any): void {
    let orderType: string = odr.type;
    if (orderType.indexOf('-') > 0) { // sell-limit
      orderType = orderType.substr(orderType.indexOf('-') + 1);
    }
    order.type = orderType;
    order.status = odr.state;
    order.askPrice = +odr.price;
    order.askQty = +odr.amount;
    const cqq = +odr['field-cash-amount'];
    const eq = +odr['field-amount'];
    if (!isNaN(cqq) && !isNaN(eq) && eq !== 0.0) {
      order.avgPrice = cqq / eq;
    }
    order.quoteAmount = cqq;
    order.execQty = eq;
    order.updateTs = +odr['finished-at'];
  }

  static setNewOrderProps(order: SpotOrder | CreateSpotOrderDto, odr: any): void {
    order.ex = this.exchCode;
    order.pairSymbol = odr.symbol;
    order.orderId = '' + odr.id;
    order.clientOrderId = odr['client-order-id'];
    const type: string = odr.type;
    order.side = type.substring(0, type.indexOf('-'));
    order.createTs = +odr['created-at'];
    HbPriSyncService.setOrderProps(order, odr);
  }


  private async syncOrders(pair: ExPair, odrs: any[], syncResult: SyncResult): Promise<void> {
    // odrs.sort((o1, o2) => (+o1['finished-at']) - (+o2['finished-at']));
    for (const odr of odrs) {
      let theOrder = await this.spotOrderService.findByOrderId(this.exchCode, '' + odr.id);
      if (theOrder) {
        if (+theOrder.updateTs === +odr['finished-at']) {
          syncResult.skip++;
          continue;
        }
        const order = new UpdateSpotOrderDto();
        HbPriSyncService.setOrderProps(order, odr);
        await this.spotOrderService.update(theOrder.id, order);

        Object.assign(theOrder, order);
        syncResult.update++;
      } else {
        const order = new CreateSpotOrderDto();
        order.baseCcy = pair.baseCcy;
        order.quoteCcy = pair.quoteCcy;
        HbPriSyncService.setNewOrderProps(order, odr);
        theOrder = await this.spotOrderService.create(order);
        if (order.clientOrderId) {
          const strategy = await this.strategiesService.findByExAndClientOrderId(this.exchCode, order.clientOrderId);
          if (strategy) {
            await this.strategiesService.completeStrategy(strategy);
          }
        }
        syncResult.create++;
      }

      await this.lastTransactionService.syncFromOrder(theOrder);
    }
  }

  async syncOrdersForSymbol(api: API, symbol: string, fromDate: string | number): Promise<SyncResult> {
    const pair = await this.pairsService.findBySymbol(this.exchCode, symbol);
    if (!pair) {
      throw new Error('尚未同步交易对（HB）');
    }

    const odrs = await this.hbPriApiService.orders(api, symbol, {fromDate});
    const syncResult = new SyncResult();
    await this.syncOrders(pair, odrs, syncResult);
    return syncResult;
  }

  async syncOrdersForConcernedPairs(api: API, fromDate: string | number): Promise<SyncResult> {
    const syncResult = new SyncResult();
    const pairs = await this.pairsService.findByExConcerned(this.exchCode);
    for (const pair of pairs) {
      const odrs = await this.hbPriApiService.orders(api, pair.hbSymbol, {fromDate});
      await this.syncOrders(pair, odrs, syncResult);
    }

    return syncResult;
  }

  async syncOrders2d(api: API): Promise<SyncResult> {
    const odrs = await this.hbPriApiService.ordersLatest2d(api);
    const syncResult = new SyncResult();

    const groups = groupBy(odrs, 'symbol');

    const hasOwnProperty = Object.prototype.hasOwnProperty;
    for (const symbol in groups) {
      if (!hasOwnProperty.call(groups, symbol)) {
        continue;
      }
      const os = groups[symbol];
      const pair = await this.pairsService.findBySymbol(this.exchCode, symbol);
      if (!pair) {
        throw new Error('尚未同步交易对（HB）');
      }
      await this.syncOrders(pair, os, syncResult);
    }

    return syncResult;
  }


  async syncAfterPlacedOrder(api: API, exp: ExchangePair): Promise<boolean> {
    const assetSyncResult = await this.syncAssets(api);
    if (assetSyncResult.update === 0 && assetSyncResult.create === 0) {
      return false;
    }
    const fromDate = Date.now() - 30 * 60 * 1000; // 30m
    await this.syncOrdersForSymbol(api, exp.symbol, fromDate);
    return true;
  }

}
