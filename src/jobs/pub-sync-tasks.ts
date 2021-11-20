import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { CmcSyncService } from '../services/ex-sync/cmc/cmc-sync.service';
import { ExPubSyncService } from '../services/ex-sync/ex-pub-sync.service';
import { Config } from '../common/config';
import { CcyListingService } from '../services/mar/ccy-listing.service';
import { ListingOptions } from '../services/ex-api/cmc/cmc-api.service';


@Injectable()
export class PubSyncTasks {
  private readonly logger = new Logger(PubSyncTasks.name);

  constructor(private cmcSyncService: CmcSyncService,
              private exPubSyncService: ExPubSyncService,
              private ccyListingService: CcyListingService) {
  }


  // @Cron('2 01 * * *', {
  //   name: 'syncCurrencies 100',
  //   timeZone: Config.Timezone
  // })
  // async syncCurrencies100() {
  //   await this.syncCurrencies(100);
  // }

  @Cron('2 02 * * *', {
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


  @Cron('2 03 * * *', {
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


  @Cron('15 0 * * *', {
    name: 'syncCcyListing',
    timeZone: Config.Timezone
  })
  async syncCcyListing() {

    const opts: ListingOptions = {
      sort: 'date_added',
      sort_dir: 'desc',
      limit: 50,
      start: 1
    };

    this.logger.debug(`同步新币种 ...`);
    let stat = await this.ccyListingService.listingForSync(opts);
    let resultStr = JSON.stringify(stat, null, 2);
    this.logger.debug(`同步新币种 \n` + resultStr);

    opts.sort = 'percent_change_24h';
    this.logger.debug(`同步增长最快币种（24H） ...`);
    stat = await this.ccyListingService.listingForSync(opts);
    resultStr = JSON.stringify(stat, null, 2);
    this.logger.debug(`同步增长最快币种（24H） \n` + resultStr);
  }

}
