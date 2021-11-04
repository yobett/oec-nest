import { Controller, Get, UseGuards, } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PairKline } from '../../models/mar/kline';
import { BaPubApiService } from '../../services/ex-api/ba/ba-pub-api.service';
import { OePubApiService } from '../../services/ex-api/oe/oe-pub-api.service';
import { HbPubApiService } from '../../services/ex-api/hb/hb-pub-api.service';
import { CountList, CountListResult } from '../../models/result';
import { QueryFilter } from '../../common/decorators/query-filter.decorator';
import { QueryParams } from '../../models/query-params';
import { RollingPriceService } from '../../services/mar/rolling-price.service';

@Controller('mar/rolling24h')
@UseGuards(JwtAuthGuard)
export class RollingPricesController {

  constructor(private baPubApiService: BaPubApiService,
              private oePubApiService: OePubApiService,
              private hbPubApiService: HbPubApiService,
              private rollingPriceService: RollingPriceService) {
  }

  @Get('page')
  async page(@QueryFilter() query: QueryParams): Promise<CountListResult<PairKline>> {
    const {pager, filter} = query;
    const cl: CountList<PairKline> = await this.rollingPriceService.query(pager, filter);
    return CountListResult.cl(cl);
  }

}
