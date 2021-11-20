import { Injectable } from '@nestjs/common';
import { CmcApiService, ListingOptions } from '../ex-api/cmc/cmc-api.service';
import { ExapisService } from '../sys/exapis.service';
import { CmcSyncService } from '../ex-sync/cmc/cmc-sync.service';
import { API, Exapi } from '../../models/sys/exapi';
import { CountList } from '../../models/result';
import { CcyListingItem, CcyListingItemRaw, CcyListingWithStatus } from '../../models/mar/ccy-listing-item';
import { Quote } from '../../models/mar/quote';
import { SyncResult } from '../../models/sync-result';
import { Ccy } from '../../models/mar/ccy';

@Injectable()
export class CcyListingService {

  constructor(private cmcApiService: CmcApiService,
              private cmcSyncService: CmcSyncService,
              private exapisService: ExapisService) {
  }


  async listing(opts: ListingOptions): Promise<CountList<CcyListingItem>> {
    const api: API = await this.exapisService.findExapi(Exapi.EX_CMC);
    if (!api) {
      throw new Error('API未配置（CMC）');
    }

    // num_market_pairs,cmc_rank,date_added,tags,platform,max_supply,circulating_supply,total_supply
    opts.aux = 'cmc_rank,date_added,max_supply,circulating_supply,total_supply';
    const listingWithStatus: CcyListingWithStatus = await this.cmcApiService.listings(api, opts);
    const rawList = listingWithStatus.data;

    let ccyMap: Map<string, Ccy>;

    try {
      const symbols = rawList.map(item => item.symbol);
      const cmcRanksMap = new Map<string, number>(rawList.map(item => [item.symbol, item.cmc_rank]));
      const scOpts: any = {newOnly: true, cmcRanksMap};
      const sr: SyncResult = await this.cmcSyncService.syncCurrenciesForSymbols(api, symbols, scOpts);
      ccyMap = scOpts.ccyMap;
      console.dir(sr);
    } catch (e) {
      console.error(e);
    }

    const list = rawList.map((item: CcyListingItemRaw) => {
      const item2: CcyListingItem = item as any;
      item2.quote = item.quote['USD'] || {} as Quote;
      if (ccyMap) {
        item2.ccy = ccyMap.get(item2.symbol);
      }
      return item2;
    });

    const count = listingWithStatus.status.total_count || list.length;
    return {count, list};
  }


}
