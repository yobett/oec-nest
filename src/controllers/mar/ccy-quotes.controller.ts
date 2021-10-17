import { Controller, Get, Query, UseGuards, } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Quote } from '../../models/mar/quote';
import { ListResult } from '../../models/result';
import { CurrentPriceService } from '../../services/mar/current-price.service';

@Controller('mar/quotes')
@UseGuards(JwtAuthGuard)
export class CcyQuotesController {
  constructor(private currentPriceService: CurrentPriceService) {
  }


  @Get('latest')
  async quotes(@Query('convert') convert: string): Promise<ListResult<Quote>> {

    convert = convert || 'USD';
    const quotes: Quote[] = await this.currentPriceService.ccyQuotes(convert);

    return ListResult.list(quotes);
  }

}
