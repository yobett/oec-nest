import { Controller, Get, Param, Query, UseGuards, } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Quote } from '../../models/mar/quote';
import { ListResult, ValueResult } from '../../models/result';
import { CurrentPriceService } from '../../services/mar/current-price.service';

@Controller('mar/quotes')
@UseGuards(JwtAuthGuard)
export class CcyQuotesController {
  constructor(private currentPriceService: CurrentPriceService) {
  }

  @Get('ccy/:ccy')
  async quote(@Param('ccy') ccy: string,
              @Query('convert') convert: string): Promise<ValueResult<Quote>> {

    convert = convert || 'USD';
    const quote: Quote = await this.currentPriceService.ccyQuote(ccy, convert);
    return ValueResult.value(quote);
  }

  @Get('latest')
  async quotes(@Query('convert') convert: string): Promise<ListResult<Quote>> {

    convert = convert || 'USD';
    const quotes: Quote[] = await this.currentPriceService.ccyQuotes(convert);

    return ListResult.list(quotes);
  }

}
