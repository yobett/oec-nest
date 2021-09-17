import { Controller, Get, Logger, Param, Query, UseGuards, } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Kline } from '../../models/mar/kline';
import { BaPubApiService } from '../../services/ex-api/ba/ba-pub-api.service';
import { OePubApiService } from '../../services/ex-api/oe/oe-pub-api.service';
import { HbPubApiService } from '../../services/ex-api/hb/hb-pub-api.service';
import { Exch } from '../../models/sys/exch';
import { ListResult } from '../../models/result';

@Controller('mar/klines')
@UseGuards(JwtAuthGuard)
export class KlinesController {
  constructor(private baPubApiService: BaPubApiService,
              private oePubApiService: OePubApiService,
              private hbPubApiService: HbPubApiService) {
  }

  private readonly logger = new Logger(KlinesController.name);

  @Get(':ex/:symbol/:interval')
  async klines(@Param('ex') ex: string,
               @Param('symbol') symbol: string,
               @Param('interval') interval: string,
               @Query('olderThan') olderThan: number,
               @Query('newerThan') newerThan: number,
               @Query('limit') limit: number): Promise<ListResult<Kline>> {
    if (ex === Exch.CODE_BA) {
      // interval: 1m/3m/5m/15m/30m/1h/2h/4h/6h/8h/12h/1d/3d/1w/1M
      // limit: default 500, max 1000
      if (olderThan) {
        olderThan--;
      }
      if (newerThan) {
        newerThan++;
      }
      const klines = await this.baPubApiService.klines(symbol, interval, {
        endTime: olderThan,
        startTime: newerThan,
        limit
      });
      return ListResult.list(klines);
    }
    if (ex === Exch.CODE_OE) {
      // bar: 1m/3m/5m/15m/30m/1H/2H/4H/6H/12H/1D/1W/1M/3M/6M/1Y, default 1m
      // limit: default 100, max 100
      // max: 1440
      const klines = await this.oePubApiService.candles(symbol, interval, {olderThan, newerThan, limit});
      return ListResult.list(klines);
    }
    if (ex === Exch.CODE_HB) {
      // period: 1min, 5min, 15min, 30min, 60min, 4hour, 1day, 1mon, 1week, 1year
      // limit: default 150, max 2000
      const klines = await this.hbPubApiService.klines(symbol, interval, limit);
      return ListResult.list(klines);
    }
    throw new Error('未知交易所：' + ex);
  }

}
