import { Body, Controller, Get, Param, Post, Query, UseGuards, } from '@nestjs/common';
import {
  CurrentPrices,
  CurrentPriceService,
  PriceRequest,
  PriceResponse
} from '../../services/mar/current-price.service';
import { ExPairsService } from '../../services/mar/pairs.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ListResult, ValueResult } from '../../models/result';


@Controller('mar/prices')
@UseGuards(JwtAuthGuard)
export class PricesController {

  constructor(private pairsService: ExPairsService,
              private currentPriceService: CurrentPriceService) {
  }

  @Post('concern/inquirePrices')
  async inquireConcernedPrices(@Query('preferDS') preferDS: string = null): Promise<ValueResult<CurrentPrices>> {
    const prices = await this.currentPriceService.inquireConcernedPrices(preferDS);
    return ValueResult.value(prices);
  }

  @Post('inquirePrices')
  async inquirePricesEx(@Body() priceRequests: PriceRequest[]): Promise<ListResult<PriceResponse>> {
    if (!priceRequests || priceRequests.length === 0) {
      return ListResult.list([]);
    }
    const res: PriceResponse[] = await this.currentPriceService.inquirePricesEx(priceRequests);
    return ListResult.list(res);
  }

  @Get('ticker/:ex/:symbol')
  async inquirePrice(@Param('ex') ex: string,
                     @Param('symbol') symbol: string): Promise<ValueResult<number | string>> {
    const price = await this.currentPriceService.inquirePrice(ex, symbol);
    return ValueResult.value(price);
  }

}
