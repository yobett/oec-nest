import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { CmcSyncService } from '../services/ex-sync/cmc/cmc-sync.service';
import { ExPubSyncService } from '../services/ex-sync/ex-pub-sync.service';
import { Config } from '../common/config';


@Injectable()
export class PubSyncTasks {
  private readonly logger = new Logger(PubSyncTasks.name);

  constructor(private cmcSyncService: CmcSyncService,
              private exPubSyncService: ExPubSyncService) {
  }


  @Cron('2 01 * * *', {
    name: 'syncCurrencies 100',
    timeZone: Config.Timezone
  })
  async syncCurrencies100() {
    await this.syncCurrencies(100);
  }

  @Cron('2 02 * * 1', {
    name: 'syncCurrencies 1000',
    timeZone: Config.Timezone
  })
  async syncCurrencies1000() {
    await this.syncCurrencies(1000);
  }

  // @Cron('30 02 1 * *', {name: 'syncCurrencies5000'})
  // async syncCurrencies5000() {
  //   await this.syncCurrencies(5000);
  // }

  async syncCurrencies(limit: number) {
    this.logger.debug(`同步币种（前${limit}） ...`);

    const stat = await this.cmcSyncService.syncHeadingCurrencies(limit);

    const resultStr = JSON.stringify(stat, null, 2);
    this.logger.debug(`同步币种（前${limit}） \n` + resultStr);
  }


  @Cron('2 03 * * 1', {
    name: 'sync Pairs And New Currencies',
    timeZone: Config.Timezone
  })
  async syncPairsAndNewCurrencies() {
    this.logger.debug('同步交易对，并同步出现的新币种 ...');

    const syncResults = await this.exPubSyncService.syncPairsAndNewCurrencies();

    const resultStr = JSON.stringify(syncResults, null, 2);
    this.logger.debug('同步交易对，并同步出现的新币种，结果：\n' + resultStr);
  }


  /*@Cron('2 04 1 * *', {
    name: 'syncNewCurrencies',
    timeZone: Config.Timezone
  })
  async syncNewCurrencies() {
    this.logger.debug('同步交易对中的新币种 ...');

    const stat = await this.cmcSyncService.syncNewCurrenciesForPairs();

    const resultStr = JSON.stringify(stat, null, 2);
    this.logger.debug('同步交易对中的新币种，结果：\n' + resultStr);
  }*/
}
