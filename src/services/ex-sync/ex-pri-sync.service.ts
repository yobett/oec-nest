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

@Injectable()
export class ExPriSyncService {

  constructor(private baPriService: BaPriApiService,
              private oePriService: OePriApiService,
              private hbPriService: HbPriApiService,
              private oePriSyncService: OePriSyncService,
              private baPriSyncService: BaPriSyncService,
              private hbPriSyncService: HbPriSyncService,
              private pairsService: ExPairsService,
              private exapisService: ExapisService) {
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
    });
  }


  async syncExAssets(exCode: string): Promise<SyncResult> {
    const api = await this.exapisService.findExapi(exCode);
    if (exCode === Exch.CODE_OE) {
      return this.oePriSyncService.syncAssets(api);
    }
    if (exCode === Exch.CODE_BA) {
      return this.baPriSyncService.syncAssets(api);
    }
    if (exCode === Exch.CODE_HB) {
      return this.hbPriSyncService.syncAssets(api);
    }
  }

  async syncOrdersDefault(): Promise<SyncResults> {

    return this.syncEach((exCode: string, api: API): Promise<SyncResult> => {
      if (exCode === Exch.CODE_OE) {
        return this.oePriSyncService.syncOrders(api);
      }
      if (exCode === Exch.CODE_BA) {
        return this.baPriSyncService.syncOrdersForConcernedPairs(api);
      }
      if (exCode === Exch.CODE_HB) {
        return this.hbPriSyncService.syncOrders2d(api);
      }
    });
  }


  async syncAfterPlacedOrder(exp: ExchangePair): Promise<boolean> {

    const api = await this.exapisService.findExapi(exp.ex);
    if (exp.ex === Exch.CODE_OE) {
      return this.oePriSyncService.syncAfterPlacedOrder(api);
    }
    if (exp.ex === Exch.CODE_BA) {
      return this.baPriSyncService.syncAfterPlacedOrder(api, exp);
    }
    if (exp.ex === Exch.CODE_HB) {
      return this.hbPriSyncService.syncAfterPlacedOrder(api, exp);
    }
    throw new Error('未知交易所：' + exp.ex);
  }


  async getPendingOrders(): Promise<SpotOrder[]> {

    const apis: Map<string, API> = await this.exapisService.findExapis();

    const promises: any[] = [];
    const oeApi = apis.get(Exch.CODE_OE);
    if (oeApi) {
      promises.push(this.oePriService.pendingOrders(oeApi));
    } else {
      promises.push(Promise.resolve([]));
    }
    const baApi = apis.get(Exch.CODE_BA);
    if (baApi) {
      promises.push(this.baPriService.openOrders(baApi));
    } else {
      promises.push(Promise.resolve([]));
    }
    const hbApi = apis.get(Exch.CODE_HB);
    if (hbApi) {
      const hbPairs = await this.pairsService.findByExConcerned(Exch.CODE_HB);
      const hbSymbols = hbPairs.map(p => p.hbSymbol);
      promises.push(this.hbPriService.openOrders(hbApi, hbSymbols));
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

    for (const so of list) {
      if (!so.baseCcy) {
        const pair = await this.pairsService.findBySymbol(so.ex, so.pairSymbol);
        so.baseCcy = pair.baseCcy;
        so.quoteCcy = pair.quoteCcy;
      }
    }

    return list;
  }

}
