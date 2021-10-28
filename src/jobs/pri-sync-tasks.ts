import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExPriSyncService } from '../services/ex-sync/ex-pri-sync.service';
import { Config } from '../common/config';
import { AssetEvaluatorService } from '../services/per/asset-evaluator.service';
import { SyncResult, SyncResults } from '../models/sync-result';
import { Exch } from '../models/sys/exch';

@Injectable()
export class PriSyncTasks {
  private readonly logger = new Logger(PriSyncTasks.name);

  constructor(private exPriSyncService: ExPriSyncService,
              private assetEvaluatorService: AssetEvaluatorService) {
  }

  /*
  @Cron(CronExpression.EVERY_DAY_AT_5AM,
    {
      name: 'syncAssets',
      timeZone: Config.Timezone
    })
  async syncAssets() {
    this.logger.debug('同步资产 ...');
    const syncResults = await this.exPriSyncService.syncAssets();
    const resultStr = JSON.stringify(syncResults, null, 2);
    this.logger.debug('Sync Assets Result: \n' + resultStr);
  }*/

  @Cron(
    CronExpression.EVERY_4_HOURS,
    // '45 * * * *',
    {
      name: 'syncAssetsAndBuildSnapshots',
      timeZone: Config.Timezone
    })
  async syncAssetsAndBuildSnapshots() {
    this.logger.debug('同步资产并构建快照 ...');
    let syncResults: SyncResults;
    try {
      syncResults = await this.exPriSyncService.syncAssets();
    } catch (e) {
      this.logger.error(e);
    }

    await this.assetEvaluatorService.buildSnapshots();

    if (!syncResults) {
      return
    }
    for (const ex of [Exch.CODE_BA, Exch.CODE_OE, Exch.CODE_HB]) {
      const assetSyncResult: SyncResult = syncResults[ex];
      if (!assetSyncResult) {
        continue;
      }
      if (assetSyncResult.create > 0 || assetSyncResult.update > 0) {
        this.logger.debug(`同步订单（${ex}） ...`);
        const orderSyncResult: SyncResult = await this.exPriSyncService.syncOrdersDefaultFor(ex);
        const resultStr = JSON.stringify(orderSyncResult, null, 2);
        this.logger.debug('同步订单结果：\n' + resultStr);
      }
    }
  }

  /*@Cron(CronExpression.EVERY_DAY_AT_6AM, {
    name: 'syncOrders',
    timeZone: Config.Timezone
  })
  async syncOrders() {
    this.logger.debug('同步订单 ...');
    const syncResults = await this.exPriSyncService.syncOrdersDefault();
    const resultStr = JSON.stringify(syncResults, null, 2);
    this.logger.debug('同步订单结果：\n' + resultStr);
  }*/
}
