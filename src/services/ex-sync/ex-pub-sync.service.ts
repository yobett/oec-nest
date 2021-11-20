import { union } from 'lodash';
import { Injectable } from '@nestjs/common';
import { Command, Console, createSpinner } from 'nestjs-console';

import { OePubSyncService } from './oe/oe-pub-sync.service';
import { BaPubSyncService } from './ba/ba-pub-sync.service';
import { HbPubSyncService } from './hb/hb-pub-sync.service';
import { CmcSyncService } from './cmc/cmc-sync.service';
import { SyncResults } from '../../models/sync-result';
import { API, Exapi } from '../../models/sys/exapi';
import { ExapisService } from '../sys/exapis.service';

@Injectable()
@Console({
  command: 'market-data',
  description: 'ExPubSyncService'
})
export class ExPubSyncService {

  constructor(private oePubSyncService: OePubSyncService,
              private baPubSyncService: BaPubSyncService,
              private hbPubSyncService: HbPubSyncService,
              private cmcSyncService: CmcSyncService,
              private exapisService: ExapisService
  ) {

  }

  async syncPairsAndNewCurrencies(): Promise<SyncResults> {

    let oe;
    let ba;
    let hb;
    try {
      oe = await this.oePubSyncService.syncPairs();
    } catch (e) {
      console.error(e);
    }
    try {
      ba = await this.baPubSyncService.syncPairs();
    } catch (e) {
      console.error(e);
    }
    try {
      hb = await this.hbPubSyncService.syncPairs();
    } catch (e) {
      console.error(e);
    }

    const codes: string[] = union(oe?.payload, ba?.payload, hb?.payload);
    if (codes.length === 0) {
      return;
    }

    const api: API = await this.exapisService.findExapi(Exapi.EX_CMC);
    if (!api) {
      throw new Error('API未配置（CMC）');
    }

    await this.cmcSyncService.syncCurrenciesForSymbols(api, codes, {newOnly: true});

    delete oe.payload;
    delete ba.payload;
    delete hb.payload;
    return {oe, ba, hb};
  }

  @Command({
    command: 'init',
    description: '同步币种/交易对数据'
  })
  async init(): Promise<void> {

    const currenciesCount = 1000;
    const spin = createSpinner();
    spin.start(`同步币种（前${currenciesCount}） ...`);

    const stat = await this.cmcSyncService.syncHeadingCurrencies(currenciesCount);
    const resultStr = JSON.stringify(stat, null, 2);
    console.log(`同步币种完成 \n` + resultStr);

    const syncResults = await this.syncPairsAndNewCurrencies();
    const syncResultsStr = JSON.stringify(syncResults, null, 2);
    console.log(`同步交易对 \n` + syncResultsStr);

    spin.succeed('完成');
  }

}
