import { Injectable } from '@nestjs/common';
import { OePriSyncService } from './oe/oe-pri-sync.service';
import { BaPriSyncService } from './ba/ba-pri-sync.service';
import { HbPriSyncService } from './hb/hb-pri-sync.service';
import { ExapisService } from '../sys/exapis.service';
import { SyncResult, SyncResults } from '../../models/sync-result';
import { API } from '../../models/sys/exapi';
import { Exch } from '../../models/sys/exch';
import { SpotOrder } from '../../models/per/spot-order';
import { BaPriApiService } from '../ex-api/ba/ba-pri-api.service';
import { OePriApiService } from '../ex-api/oe/oe-pri-api.service';
import { HbPriApiService } from '../ex-api/hb/hb-pri-api.service';
import { ExPairsService } from '../mar/pairs.service';
import { ExchangePair } from '../../models/mar/ex-pair';
import { ExPendingOrdersHolder, OrderBasic } from './ex-pending-orders-holder';

@Injectable()
export class ExPriSyncService {

  constructor(private baPriService: BaPriApiService,
              private oePriService: OePriApiService,
              private hbPriService: HbPriApiService,
              private oePriSyncService: OePriSyncService,
              private baPriSyncService: BaPriSyncService,
              private hbPriSyncService: HbPriSyncService,
              private pairsService: ExPairsService,
              private exapisService: ExapisService,
              private exPendingOrdersHolder: ExPendingOrdersHolder) {
  }

  async syncEach(syncAction: (exCode: string, api: API) => Promise<SyncResult>): Promise<SyncResults> {
    const apis: Map<string, API> = await this.exapisService.findExapis();
    const syncResults: SyncResults = {};
    const promises: Promise<SyncResult>[] = [];
    const exCodes: string[] = [];

    for (const code of [Exch.CODE_OE, Exch.CODE_BA, Exch.CODE_HB]) {
      const api = apis.get(code);
      if (api) {
        const action: Promise<SyncResult> = syncAction(code, api);
        promises.push(action);
        exCodes.push(code);
      }
    }
    if (promises.length === 0) {
      throw new Error('API未设置');
    }
    const results = await Promise.all(promises);
    exCodes.forEach((code, i) => {
      syncResults[code] = results[i];
    })

    return syncResults;
  }

  async syncAssets(): Promise<SyncResults> {

    return this.syncEach((exCode: string, api: API): Promise<SyncResult> => {
      if (exCode === Exch.CODE_OE) {
        return this.oePriSyncService.syncAssets(api);
      }
      if (exCode === Exch.CODE_BA) {
        return this.baPriSyncService.syncAssets(api);
      }
      if (exCode === Exch.CODE_HB) {
        return this.hbPriSyncService.syncAssets(api);
      }
      throw new Error('未知交易所：' + exCode);
    });
  }


  async syncExAssets(exCode: string, api?: API): Promise<SyncResult> {
    if (!api) {
      api = await this.exapisService.findExapi(exCode);
    }
    if (exCode === Exch.CODE_OE) {
      return this.oePriSyncService.syncAssets(api);
    }
    if (exCode === Exch.CODE_BA) {
      return this.baPriSyncService.syncAssets(api);
    }
    if (exCode === Exch.CODE_HB) {
      return this.hbPriSyncService.syncAssets(api);
    }
    throw new Error('未知交易所：' + exCode);
  }

  async syncOrdersDefault(): Promise<SyncResults> {
    return this.syncEach(this.syncOrdersDefaultFor.bind(this));
  }

  async syncOrdersDefaultFor(exCode: string, api?: API): Promise<SyncResult> {
    if (!api) {
      api = await this.exapisService.findExapi(exCode);
    }
    if (exCode === Exch.CODE_OE) {
      return this.oePriSyncService.syncOrders(api);
    }
    if (exCode === Exch.CODE_BA) {
      return this.baPriSyncService.syncOrdersForConcernedPairs(api);
    }
    if (exCode === Exch.CODE_HB) {
      return this.hbPriSyncService.syncOrders2d(api);
    }
    throw new Error('未知交易所：' + exCode);
  }


  async syncAfterPlacedOrder(exp: ExchangePair): Promise<boolean> {
    const exCode: string = exp.ex;
    const api = await this.exapisService.findExapi(exCode);
    if (exCode === Exch.CODE_OE) {
      return this.oePriSyncService.syncAssetAndOrders(api);
    }
    if (exCode === Exch.CODE_BA) {
      return this.baPriSyncService.syncForPair(api, exp);
    }
    if (exCode === Exch.CODE_HB) {
      return this.hbPriSyncService.syncAfterPlacedOrder(api, exp);
    }
    throw new Error('未知交易所：' + exCode);
  }


  async getPendingOrdersFor(ex: string): Promise<SpotOrder[]> {
    const api: API = await this.exapisService.findExapi(ex);
    if (!api) {
      throw new Error('API未设置：' + ex);
    }
    const list: SpotOrder[] = [];

    if (ex === Exch.CODE_OE) {
      const oeOdrs = await this.oePriService.pendingOrders(api);
      for (const odr of oeOdrs) {
        const order = new SpotOrder();
        OePriSyncService.setNewOrderProps(order, odr);
        list.push(order);
      }
    } else if (ex === Exch.CODE_BA) {
      const baOdrs = await this.baPriService.openOrders(api);
      for (const odr of baOdrs) {
        const order = new SpotOrder();
        BaPriSyncService.setNewOrderProps(order, odr);
        list.push(order);
      }
    } else if (ex === Exch.CODE_HB) {
      // concerned
      const hbPairs = await this.pairsService.findByExConcerned(Exch.CODE_HB);
      const hbSymbols = hbPairs.map(p => p.hbSymbol);
      const hbOdrs = await this.hbPriService.openOrders(api, hbSymbols);
      for (const odr of hbOdrs) {
        const order = new SpotOrder();
        HbPriSyncService.setNewOrderProps(order, odr);
        list.push(order);
      }
    } else {
      throw new Error('未知交易所：' + ex);
    }

    await this.setOrdersBQ(list);

    process.nextTick(async () => {
      const disappeared: OrderBasic[] = this.exPendingOrdersHolder.refreshKnownPendingOrders(ex, list);
      if (disappeared.length === 0) {
        return;
      }
      if (ex === Exch.CODE_OE) {
        await this.oePriSyncService.syncAssetAndOrders(api);
      } else if (ex === Exch.CODE_BA) {
        await this.baPriSyncService.syncForPairs(api, disappeared);
      } else if (ex === Exch.CODE_HB) {
        await this.hbPriSyncService.syncNewlyFilledOrders(api, disappeared);
      }
    });

    return list;
  }

  async getPendingOrders(): Promise<SpotOrder[]> {

    const apis: Map<string, API> = await this.exapisService.findExapis();

    let successFetchedOe = false;
    let successFetchedBa = false;
    let successFetchedHb = false;

    const promises: Promise<any>[] = [];
    const oeApi = apis.get(Exch.CODE_OE);
    if (oeApi) {
      successFetchedOe = true;
      const oePromise: Promise<any> = this.oePriService.pendingOrders(oeApi)
        .catch(err => {
          successFetchedOe = false
          console.error(err);
          return [];
        });
      promises.push(oePromise);
    } else {
      promises.push(Promise.resolve([]));
    }
    const baApi = apis.get(Exch.CODE_BA);
    if (baApi) {
      successFetchedBa = true;
      const baPromise: Promise<any> = this.baPriService.openOrders(baApi)
        .catch(err => {
          successFetchedBa = false;
          console.error(err);
          return [];
        });
      promises.push(baPromise);
    } else {
      promises.push(Promise.resolve([]));
    }
    const hbApi = apis.get(Exch.CODE_HB);
    if (hbApi) {
      successFetchedHb = true;
      const hbPairs = await this.pairsService.findByExConcerned(Exch.CODE_HB);
      const hbSymbols = hbPairs.map(p => p.hbSymbol);
      const hbPromise: Promise<any> = this.hbPriService.openOrders(hbApi, hbSymbols)
        .catch(err => {
          successFetchedHb = false;
          console.error(err);
          return [];
        });
      promises.push(hbPromise);
    } else {
      promises.push(Promise.resolve([]));
    }

    const [oeOdrs, baOdrs, hbOdrs] = await Promise.all(promises);

    const list: SpotOrder[] = [];

    for (const odr of oeOdrs) {
      const order = new SpotOrder();
      OePriSyncService.setNewOrderProps(order, odr);
      list.push(order);
    }

    for (const odr of baOdrs) {
      const order = new SpotOrder();
      BaPriSyncService.setNewOrderProps(order, odr);
      list.push(order);
    }

    for (const odr of hbOdrs) {
      const order = new SpotOrder();
      HbPriSyncService.setNewOrderProps(order, odr);
      list.push(order);
    }

    list.sort((a, b) => b.createTs - a.createTs);

    await this.setOrdersBQ(list);

    process.nextTick(async () => {
      if (successFetchedOe) {
        const exList = list.filter(o => o.ex === Exch.CODE_OE);
        const disappeared: OrderBasic[] = this.exPendingOrdersHolder.refreshKnownPendingOrders(Exch.CODE_OE, exList);
        if (disappeared.length > 0) {
          await this.oePriSyncService.syncAssetAndOrders(oeApi);
        }
      }
      if (successFetchedBa) {
        const exList = list.filter(o => o.ex === Exch.CODE_BA);
        const disappeared: OrderBasic[] = this.exPendingOrdersHolder.refreshKnownPendingOrders(Exch.CODE_BA, exList);
        if (disappeared.length > 0) {
          await this.baPriSyncService.syncForPairs(baApi, disappeared);
        }
      }
      if (successFetchedHb) {
        const exList = list.filter(o => o.ex === Exch.CODE_HB);
        const disappeared: OrderBasic[] = this.exPendingOrdersHolder.refreshKnownPendingOrders(Exch.CODE_HB, exList);
        if (disappeared.length > 0) {
          await this.hbPriSyncService.syncNewlyFilledOrders(hbApi, disappeared);
        }
      }
    });


    return list;
  }

  private async setOrdersBQ(list: SpotOrder[]) {
    for (const so of list) {
      if (!so.baseCcy) {
        const pair = await this.pairsService.findBySymbol(so.ex, so.pairSymbol);
        so.baseCcy = pair.baseCcy;
        so.quoteCcy = pair.quoteCcy;
      }
    }
  }

}
