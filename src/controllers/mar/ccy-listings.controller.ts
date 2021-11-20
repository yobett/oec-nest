import { Controller, Get, UseGuards, } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BaPubApiService } from '../../services/ex-api/ba/ba-pub-api.service';
import { OePubApiService } from '../../services/ex-api/oe/oe-pub-api.service';
import { HbPubApiService } from '../../services/ex-api/hb/hb-pub-api.service';
import { CountList, CountListResult } from '../../models/result';
import { CcyListingService } from '../../services/mar/ccy-listing.service';
import { ListingOptions } from '../../services/ex-api/cmc/cmc-api.service';
import { QueryFilter } from '../../common/decorators/query-filter.decorator';
import { QueryParams } from '../../models/query-params';
import { CcyListingItem } from '../../models/mar/ccy-listing-item';

@Controller('mar/ccy-listings')
@UseGuards(JwtAuthGuard)
export class CcyListingsController {

  constructor(private baPubApiService: BaPubApiService,
              private oePubApiService: OePubApiService,
              private hbPubApiService: HbPubApiService,
              private ccyListingService: CcyListingService) {
  }

  @Get('page')
  async page(@QueryFilter() query: QueryParams): Promise<CountListResult<CcyListingItem>> {
    const {pager, sorter, filter} = query;
    const opts: ListingOptions = filter;
    opts.sort = sorter.sort;
    opts.start = pager.skip + 1;
    opts.limit = pager.pageSize;
    const cl: CountList<CcyListingItem> = await this.ccyListingService.listing(opts);
    return CountListResult.cl(cl);
  }

}
