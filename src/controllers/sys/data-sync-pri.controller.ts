import { Body, Controller, Logger, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ValueResult } from '../../models/result';
import { Roles } from '../../common/decorators/roles.decorator';
import { OePriSyncService } from '../../services/ex-sync/oe/oe-pri-sync.service';
import { BaPriSyncService } from '../../services/ex-sync/ba/ba-pri-sync.service';
import { SyncResult, SyncResults } from '../../models/sync-result';
import { HbPriSyncService } from '../../services/ex-sync/hb/hb-pri-sync.service';
import { ExapisService } from '../../services/sys/exapis.service';
import { Exch } from '../../models/sys/exch';
import { API } from '../../models/sys/exapi';
import { ExPriSyncService } from '../../services/ex-sync/ex-pri-sync.service';
import { ExchangePair } from '../../models/mar/ex-pair';

@Controller('sys/sync-pri')
@UseGuards(JwtAuthGuard)
@Roles('admin')
export class DataSyncPriController {
  private readonly logger = new Logger(DataSyncPriController.name);

  constructor(private oePriSyncService: OePriSyncService,
              private baPriSyncService: BaPriSyncService,
              private hbPriSyncService: HbPriSyncService,
              private exapisService: ExapisService,
              private exPriSyncService: ExPriSyncService) {
  }

  @Post('assets/ex/:ex')
  async exAssets(@Param('ex') ex: string): Promise<ValueResult<SyncResult>> {
    const syncResult: SyncResult = await this.exPriSyncService.syncExAssets(ex);

    if (syncResult.create > 0 || syncResult.update > 0) {
      this.syncOrdersAfterAsset(ex);
    }

    return ValueResult.value(syncResult);
  }

  @Post('assets')
  async assets(): Promise<ValueResult<SyncResults>> {
    const syncResults = await this.exPriSyncService.syncAssets();

    for (const ex of [Exch.CODE_BA, Exch.CODE_OE, Exch.CODE_HB]) {
      const assetSyncResult: SyncResult = syncResults[ex];
      if (!assetSyncResult) {
        continue;
      }
      if (assetSyncResult.create > 0 || assetSyncResult.update > 0) {
        this.syncOrdersAfterAsset(ex);
      }
    }

    return ValueResult.value(syncResults);
  }

  private syncOrdersAfterAsset(ex: string, api?: API) {
    setTimeout(async () => {
      this.logger.debug(`同步资产后，自动同步订单（${ex}） ...`);
      const orderSyncResult: SyncResult = await this.exPriSyncService.syncOrdersDefaultFor(ex, api);
      // const resultStr = JSON.stringify(orderSyncResult, null, 2);
      // this.logger.debug('同步订单结果：\n' + resultStr);
    }, 100);
  }

  private syncAssetsAfterOrder(ex: string, api?: API) {
    setTimeout(async () => {
      this.logger.debug(`同步订单后，自动同步资产（${ex}） ...`);
      const orderSyncResult: SyncResult = await this.exPriSyncService.syncExAssets(ex, api);
      // const resultStr = JSON.stringify(orderSyncResult, null, 2);
      // this.logger.debug('同步资产结果：\n' + resultStr);
    }, 100);
  }

  @Post('oe-orders')
  async oeOrders(): Promise<ValueResult<SyncResult>> {
    const api: API = await this.exapisService.findExapi(Exch.CODE_OE);
    const syncResult = await this.oePriSyncService.syncOrders(api);

    if (syncResult.create > 0 || syncResult.update > 0) {
      this.syncAssetsAfterOrder(Exch.CODE_OE, api);
    }

    return ValueResult.value(syncResult);
  }

  @Post('ba-orders/concerned')
  async baOrders(): Promise<ValueResult<SyncResult>> {
    const api: API = await this.exapisService.findExapi(Exch.CODE_BA);
    const syncResult = await this.baPriSyncService.syncOrdersForConcernedPairs(api);

    if (syncResult.create > 0 || syncResult.update > 0) {
      this.syncAssetsAfterOrder(Exch.CODE_BA, api);
    }

    return ValueResult.value(syncResult);
  }

  @Post('ba-orders/symbol/:symbol')
  async baOrdersForSymbol(@Param('symbol') symbol: string): Promise<ValueResult<SyncResult>> {
    const api: API = await this.exapisService.findExapi(Exch.CODE_BA);
    const syncResult = await this.baPriSyncService.syncOrdersForSymbol(api, symbol);

    if (syncResult.create > 0 || syncResult.update > 0) {
      this.syncAssetsAfterOrder(Exch.CODE_BA, api);
    }

    return ValueResult.value(syncResult);
  }

  @Post('hb-orders/concerned/:fromDate')
  async hbOrders(@Param('fromDate') fromDate: string): Promise<ValueResult<SyncResult>> {
    const api: API = await this.exapisService.findExapi(Exch.CODE_HB);
    const syncResult = await this.hbPriSyncService.syncOrdersForConcernedPairs(api, fromDate);

    if (syncResult.create > 0 || syncResult.update > 0) {
      this.syncAssetsAfterOrder(Exch.CODE_HB, api);
    }

    return ValueResult.value(syncResult);
  }

  @Post('hb-orders/symbol/:symbol/:fromDate')
  async hbOrdersForSymbol(@Param('symbol') symbol: string,
                          @Param('fromDate') fromDate: string): Promise<ValueResult<SyncResult>> {
    const api: API = await this.exapisService.findExapi(Exch.CODE_HB);
    const syncResult = await this.hbPriSyncService.syncOrdersForSymbol(api, symbol, fromDate);

    if (syncResult.create > 0 || syncResult.update > 0) {
      this.syncAssetsAfterOrder(Exch.CODE_HB, api);
    }

    return ValueResult.value(syncResult);
  }

  @Post('hb-orders/latest2d')
  async syncOrders2d(): Promise<ValueResult<SyncResult>> {
    const api: API = await this.exapisService.findExapi(Exch.CODE_HB);
    const syncResult = await this.hbPriSyncService.syncOrders2d(api);

    if (syncResult.create > 0 || syncResult.update > 0) {
      this.syncAssetsAfterOrder(Exch.CODE_HB, api);
    }

    return ValueResult.value(syncResult);
  }

  @Post('orders')
  async orders(): Promise<ValueResult<SyncResults>> {
    const syncResults = await this.exPriSyncService.syncOrdersDefault();

    for (const ex of [Exch.CODE_BA, Exch.CODE_OE, Exch.CODE_HB]) {
      const assetSyncResult: SyncResult = syncResults[ex];
      if (!assetSyncResult) {
        continue;
      }
      if (assetSyncResult.create > 0 || assetSyncResult.update > 0) {
        this.syncAssetsAfterOrder(ex);
      }
    }

    return ValueResult.value(syncResults);
  }


  @Post('syncAfterPlacedOrder')
  async trySyncAfterPlacedOrder(@Body() exp: ExchangePair): Promise<ValueResult<boolean>> {
    const updated = await this.exPriSyncService.syncAfterPlacedOrder(exp);
    return ValueResult.value(updated);
  }
}
