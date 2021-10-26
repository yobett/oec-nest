import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
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
  constructor(private oePriSyncService: OePriSyncService,
              private baPriSyncService: BaPriSyncService,
              private hbPriSyncService: HbPriSyncService,
              private exapisService: ExapisService,
              private exPriSyncService: ExPriSyncService) {
  }

  @Post('assets/ex/:ex')
  async exAssets(@Param('ex') ex: string): Promise<ValueResult<SyncResult>> {
    const stat: SyncResult = await this.exPriSyncService.syncExAssets(ex);
    return ValueResult.value(stat);
  }

  @Post('assets')
  async assets(): Promise<ValueResult<SyncResults>> {
    const syncResults = await this.exPriSyncService.syncAssets();
    return ValueResult.value(syncResults);
  }

  @Post('oe-orders')
  async oeOrders(): Promise<ValueResult<SyncResult>> {
    const api: API = await this.exapisService.findExapi(Exch.CODE_OE);
    const stat = await this.oePriSyncService.syncOrders(api);
    return ValueResult.value(stat);
  }

  @Post('ba-orders/concerned')
  async baOrders(): Promise<ValueResult<SyncResult>> {
    const api: API = await this.exapisService.findExapi(Exch.CODE_BA);
    const stat = await this.baPriSyncService.syncOrdersForConcernedPairs(api);
    return ValueResult.value(stat);
  }

  @Post('ba-orders/symbol/:symbol')
  async baOrdersForSymbol(@Param('symbol') symbol: string): Promise<ValueResult<SyncResult>> {
    const api: API = await this.exapisService.findExapi(Exch.CODE_BA);
    const stat = await this.baPriSyncService.syncOrdersForSymbol(api, symbol);
    return ValueResult.value(stat);
  }

  @Post('hb-orders/concerned/:fromDate')
  async hbOrders(@Param('fromDate') fromDate: string): Promise<ValueResult<SyncResult>> {
    const api: API = await this.exapisService.findExapi(Exch.CODE_HB);
    const stat = await this.hbPriSyncService.syncOrdersForConcernedPairs(api, fromDate);
    return ValueResult.value(stat);
  }

  @Post('hb-orders/symbol/:symbol/:fromDate')
  async hbOrdersForSymbol(@Param('symbol') symbol: string,
                          @Param('fromDate') fromDate: string): Promise<ValueResult<SyncResult>> {
    const api: API = await this.exapisService.findExapi(Exch.CODE_HB);
    const stat = await this.hbPriSyncService.syncOrdersForSymbol(api, symbol, fromDate);
    return ValueResult.value(stat);
  }

  @Post('hb-orders/latest2d')
  async syncOrders2d(): Promise<ValueResult<SyncResult>> {
    const api: API = await this.exapisService.findExapi(Exch.CODE_HB);
    const stat = await this.hbPriSyncService.syncOrders2d(api);
    return ValueResult.value(stat);
  }

  @Post('orders')
  async orders(): Promise<ValueResult<SyncResults>> {
    const syncResults = await this.exPriSyncService.syncOrdersDefault();
    return ValueResult.value(syncResults);
  }


  @Post('syncAfterPlacedOrder')
  async trySyncAfterPlacedOrder(@Body() exp: ExchangePair): Promise<ValueResult<boolean>> {
    const updated = await this.exPriSyncService.syncAfterPlacedOrder(exp);
    return ValueResult.value(updated);
  }
}
