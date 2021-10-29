import { Injectable, Logger } from '@nestjs/common';
import { AssetService } from '../../per/asset.service';
import { SpotOrderService } from '../../per/spot-order.service';
import { Exch } from '../../../models/sys/exch';
import { Asset, CreateAssetDto } from '../../../models/per/asset';
import { OePriApiService } from '../../ex-api/oe/oe-pri-api.service';
import { SyncResult } from '../../../models/sync-result';
import { SpotOrder, UpdateSpotOrderDto } from '../../../models/per/spot-order';
import { ExPairsService } from '../../mar/pairs.service';
import { ExPair } from '../../../models/mar/ex-pair';
import { LastTransactionService } from '../../per/last-transaction.service';
import { API } from '../../../models/sys/exapi';
import { Config } from '../../../common/config';
import { StrategiesService } from '../../str/strategies.service';

@Injectable()
export class OePriSyncService {

  exchCode = Exch.CODE_OE;
  static exchCode = Exch.CODE_OE;

  private readonly logger = new Logger(OePriSyncService.name);

  constructor(private oePriService: OePriApiService,
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
    const res = await this.oePriService.balance(api);
    const balances = res.details;

    const assets: Asset[] = await this.assetService.findByEx(this.exchCode);
    const assetsMap: Map<string, Asset> = new Map<string, Asset>(assets.map(a => [a.ccy, a]));

    const lastSync = new Date();
    const threshold = Config.EX_DATA_SYNC.UPDATE_ASSET_THRESHOLD;
    for (const balance of balances) {
      const {ccy, eq: eqStr, frozenBal: frozenBalStr} = balance;
      const asset = assetsMap.get(ccy);
      const holding = +eqStr;
      const frozen = +frozenBalStr;
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

  static setOrderProps(order: SpotOrder | UpdateSpotOrderDto, odr: any): void {
    order.type = odr.ordType;
    order.status = odr.state;
    order.askPrice = +odr.px;
    order.askQty = +odr.sz;
    order.avgPrice = +odr.avgPx;
    order.execQty = +odr.accFillSz;
    order.quoteAmount = order.avgPrice * order.execQty;
    order.updateTs = +odr.uTime;
  }

  static setNewOrderProps(order: SpotOrder, odr: any): void {
    order.ex = this.exchCode;
    order.pairSymbol = odr.instId;
    order.orderId = odr.ordId;
    order.clientOrderId = odr.clOrdId;
    order.side = odr.side;
    order.createTs = +odr.cTime;
    OePriSyncService.setOrderProps(order, odr);
  }

  async syncOrders(api: API): Promise<SyncResult> {
    let create = 0;
    let update = 0;
    let skip = 0;

    const latestOrder = await this.spotOrderService.latestOrderForEx(this.exchCode);

    let odrs;
    if (!latestOrder) {
      odrs = await this.oePriService.ordersHistory3m(api);
    } else {
      const createTs = +latestOrder.createTs;
      const nowTs = Date.now();
      if (nowTs - createTs > 6 * 24 * 60 * 60 * 1000) {
        odrs = await this.oePriService.ordersHistory3m(api, latestOrder.orderId);
      } else {
        odrs = await this.oePriService.ordersHistory7d(api, latestOrder.orderId);
      }
    }

    const pairsMap = new Map<string, ExPair>()
    const clientOrderIds: string[] = [];

    // odrs.sort((o1, o2) => (+o1.uTime) - (+o2.uTime));
    for (const odr of odrs) {
      let theOrder = await this.spotOrderService.findByOrderId(this.exchCode, odr.ordId);
      if (theOrder) {
        if (+theOrder.updateTs === +odr.uTime) {
          skip++;
          continue;
        }
        const order = new UpdateSpotOrderDto();
        OePriSyncService.setOrderProps(order, odr);
        await this.spotOrderService.update(theOrder.id, order);

        Object.assign(theOrder, order);
        update++;
      } else {
        const symbol = odr.instId;
        let pair = pairsMap.get(symbol);
        if (!pair) {
          pair = await this.pairsService.findBySymbol(this.exchCode, symbol);
          pairsMap.set(symbol, pair);
        }
        if (!pair) {
          throw new Error('尚未同步交易对（OE）');
        }
        const order = new SpotOrder();
        order.baseCcy = pair.baseCcy;
        order.quoteCcy = pair.quoteCcy;
        OePriSyncService.setNewOrderProps(order, odr);
        theOrder = await this.spotOrderService.create(order);
        if (order.clientOrderId) {
          clientOrderIds.push(order.clientOrderId);
        }
        create++;
      }

      await this.lastTransactionService.syncFromOrder(theOrder);
    }

    if (clientOrderIds.length > 0) {
      const strategies = await this.strategiesService.findByExWithClientOrderId(this.exchCode);
      for (const strategy of strategies) {
        if (clientOrderIds.includes(strategy.clientOrderId)) {
          await this.strategiesService.completeStrategy(strategy);
        }
      }
    }

    return {update, create, skip} as SyncResult;
  }


  async syncAfterPlacedOrder(api: API): Promise<boolean> {
    const assetSyncResult = await this.syncAssets(api);
    if (assetSyncResult.update === 0 && assetSyncResult.create === 0) {
      return false;
    }
    await this.syncOrders(api);
    return true;
  }

}
