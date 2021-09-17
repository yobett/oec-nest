import { Injectable, Logger } from '@nestjs/common';
import { AssetService } from '../../per/asset.service';
import { SpotOrderService } from '../../per/spot-order.service';
import { BaPriApiService } from '../../ex-api/ba/ba-pri-api.service';
import { Exch } from '../../../models/sys/exch';
import { Asset, CreateAssetDto } from '../../../models/per/asset';
import { SyncResult } from '../../../models/sync-result';
import { CreateSpotOrderDto, SpotOrder, UpdateSpotOrderDto } from '../../../models/per/spot-order';
import { ExPairsService } from '../../mar/pairs.service';
import { ExchangePair } from '../../../models/mar/ex-pair';
import { LastTransactionService } from '../../per/last-transaction.service';
import { API } from '../../../models/sys/exapi';
import { Config } from '../../../common/config';
import { StrategiesService } from '../../str/strategies.service';

@Injectable()
export class BaPriSyncService {

  exchCode = Exch.CODE_BA;
  static exchCode = Exch.CODE_BA;

  private readonly logger = new Logger(BaPriSyncService.name);

  constructor(private baPriService: BaPriApiService,
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
    const res = await this.baPriService.account(api);
    const balances = res.balances;

    const assets: Asset[] = await this.assetService.findByEx(this.exchCode);
    const assetsMap: Map<string, Asset> = new Map<string, Asset>(assets.map(a => [a.ccy, a]));

    const lastSync = new Date();
    const threshold = Config.EX_DATA_SYNC.UPDATE_ASSET_THRESHOLD;
    for (const balance of balances) {
      const {asset: ccy, free: freeStr, locked: lockedStr} = balance;
      const asset = assetsMap.get(ccy);
      const free = +freeStr;
      const frozen = +lockedStr;
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
        dto.ccy = ccy;
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
    order.type = odr.type.toLowerCase();
    order.status = odr.status.toLowerCase();
    order.askPrice = +odr.price;
    order.askQty = +odr.origQty;
    const cqq = +odr.cummulativeQuoteQty;
    const eq = +odr.executedQty;
    if (!isNaN(cqq) && !isNaN(eq) && eq !== 0.0) {
      order.avgPrice = cqq / eq;
    }
    order.quoteAmount = cqq;
    order.execQty = eq;
    order.updateTs = +odr.updateTime;
  }

  static setNewOrderProps(order: SpotOrder | CreateSpotOrderDto, odr: any): void {
    order.ex = this.exchCode;
    order.pairSymbol = odr.symbol;
    order.orderId = '' + odr.orderId;
    order.clientOrderId = odr.clientOrderId;
    order.side = odr.side.toLowerCase();
    order.createTs = +odr.time;
    BaPriSyncService.setOrderProps(order, odr);
  }

  private async syncOrders(api: API, baseCcy: string, quoteCcy: string, symbol: string, syncResult: SyncResult): Promise<void> {

    const latestOrder = await this.spotOrderService.latestOrderForExPair(this.exchCode, symbol);
    const clientOrderIds: string[] = [];

    const odrs = await this.baPriService.orders(api, symbol, latestOrder ? latestOrder.orderId : null);
    for (const odr of odrs) {
      if (odr.status.toLowerCase() === 'new') {
        continue;
      }
      let theOrder = await this.spotOrderService.findByOrderId(this.exchCode, '' + odr.orderId);
      if (theOrder) {
        if (+theOrder.updateTs === +odr.updateTime) {
          syncResult.skip++;
          continue;
        }
        const order = new UpdateSpotOrderDto();
        BaPriSyncService.setOrderProps(order, odr);
        await this.spotOrderService.update(theOrder.id, order);

        Object.assign(theOrder, order);
        syncResult.update++;
      } else {
        const order = new CreateSpotOrderDto();
        order.baseCcy = baseCcy;
        order.quoteCcy = quoteCcy;
        BaPriSyncService.setNewOrderProps(order, odr);
        theOrder = await this.spotOrderService.create(order);
        if (order.clientOrderId) {
          clientOrderIds.push(order.clientOrderId);
        }
        syncResult.create++;
      }

      for (const clientOrderId of clientOrderIds) {
        const strategy = await this.strategiesService.findByExAndClientOrderId(this.exchCode, clientOrderId);
        if (strategy) {
          await this.strategiesService.completeStrategy(strategy);
        }
      }

      await this.lastTransactionService.syncFromOrder(theOrder);
    }
  }

  async syncOrdersForSymbol(api: API, symbol: string): Promise<SyncResult> {
    const syncResult = new SyncResult();
    const pair = await this.pairsService.findBySymbol(this.exchCode, symbol);
    if (!pair) {
      throw new Error('尚未同步交易对（BA）');
    }
    await this.syncOrders(api, pair.baseCcy, pair.quoteCcy, symbol, syncResult);
    return syncResult;
  }

  async syncOrdersForConcernedPairs(api: API): Promise<SyncResult> {
    const syncResult = new SyncResult();

    const pairs = await this.pairsService.findByExConcerned(this.exchCode);
    for (const pair of pairs) {
      await this.syncOrders(api, pair.baseCcy, pair.quoteCcy, pair.baSymbol, syncResult);
    }

    return syncResult;
  }


  async syncAfterPlacedOrder(api: API, exp: ExchangePair): Promise<boolean> {
    const assetSyncResult = await this.syncAssets(api);
    if (assetSyncResult.update === 0 && assetSyncResult.create === 0) {
      return false;
    }
    await this.syncOrders(api, exp.baseCcy, exp.quoteCcy, exp.symbol, assetSyncResult);
    return true;
  }

}
