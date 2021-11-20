import { Controller, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OePubSyncService } from '../../services/ex-sync/oe/oe-pub-sync.service';
import { ValueResult } from '../../models/result';
import { BaPubSyncService } from '../../services/ex-sync/ba/ba-pub-sync.service';
import { SyncResult, SyncResults } from '../../models/sync-result';
import { HbPubSyncService } from '../../services/ex-sync/hb/hb-pub-sync.service';
import { CmcSyncService } from '../../services/ex-sync/cmc/cmc-sync.service';
import { QueryParams } from '../../models/query-params';
import { CcysService } from '../../services/mar/ccys.service';
import { ExPairsService } from '../../services/mar/pairs.service';
import { API, Exapi } from '../../models/sys/exapi';
import { ExapisService } from '../../services/sys/exapis.service';
import { Exch } from '../../models/sys/exch';
import { ExPubSyncService } from '../../services/ex-sync/ex-pub-sync.service';


@Controller('sys/sync')
@UseGuards(JwtAuthGuard)
export class DataSyncPubController {
  constructor(private oePubSyncService: OePubSyncService,
              private baPubSyncService: BaPubSyncService,
              private hbPubSyncService: HbPubSyncService,
              private cmcSyncService: CmcSyncService,
              private ccysService: CcysService,
              private pairsService: ExPairsService,
              private exapisService: ExapisService,
              private exPubSyncService: ExPubSyncService
  ) {
  }


  @Post('currencies')
  async syncCurrencies(@Query('start') start: number,
                       @Query('limit') limit: number,
                       @Query('updateRank') updateRank: string): Promise<ValueResult<SyncResult>> {
    limit = +limit || 100;
    const api: API = await this.exapisService.findExapi(Exapi.EX_CMC);
    const stat = await this.cmcSyncService.syncCurrencies(
      api,
      {start, limit},
      QueryParams.parseBoolean(updateRank, true));
    return ValueResult.value(stat);
  }

  @Post('currencies/from-pairs')
  async syncCurrenciesFromPairs(@Query('newOnly') newOnly: string
  ): Promise<ValueResult<SyncResult>> {

    const stat = await this.cmcSyncService
      .syncNewCurrenciesForPairs(QueryParams.parseBoolean(newOnly));
    return ValueResult.value(stat);
  }

  @Post('pairs/ex/:ex')
  async syncNewExPairs(@Param('ex') ex: string): Promise<ValueResult<SyncResult>> {
    let stat: SyncResult;
    if (ex === Exch.CODE_OE) {
      stat = await this.oePubSyncService.syncPairs();
    } else if (ex === Exch.CODE_BA) {
      stat = await this.baPubSyncService.syncPairs();
    } else if (ex === Exch.CODE_HB) {
      stat = await this.hbPubSyncService.syncPairs();
    } else {
      throw new Error('未知交易所：' + ex);
    }

    const api: API = await this.exapisService.findExapi(Exapi.EX_CMC);

    const codes: string[] = stat.payload;
    delete stat.payload;
    if (!codes || codes.length === 0) {
      return ValueResult.value(stat);
    }

    // const newCodes = await this.ccysService.checkNewCodes(codes);
    // if (newCodes.length === 0) {
    //   return;
    // }
    await this.cmcSyncService.syncCurrenciesForSymbols(api, codes, {newOnly: true});

    return ValueResult.value(stat);
  }

  @Post('pairs')
  async syncNewPairs(): Promise<ValueResult<SyncResults>> {

    const syncResults = await this.exPubSyncService.syncPairsAndNewCurrencies();
    return ValueResult.value(syncResults);
  }
}
