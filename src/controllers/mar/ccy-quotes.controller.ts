import { Controller, Get, Query, UseGuards, } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CmcApiService } from '../../services/ex-api/cmc/cmc-api.service';
import { CcysService } from '../../services/mar/ccys.service';
import { Ccy } from '../../models/mar/ccy';
import { Quote } from '../../models/mar/quote';
import { ListResult } from '../../models/result';
import { ExapisService } from '../../services/sys/exapis.service';
import { API, Exapi } from '../../models/sys/exapi';

@Controller('mar/quotes')
@UseGuards(JwtAuthGuard)
export class CcyQuotesController {
  constructor(private ccysService: CcysService,
              private cmcApiService: CmcApiService,
              private exapisService: ExapisService) {
  }


  @Get('latest')
  async quotes(@Query('convert') convert: string): Promise<ListResult<Quote>> {

    const list: Ccy[] = await this.ccysService.findConcerned();
    if (list.length === 0) {
      return ListResult.list([]);
    }
    const symbols = list.map(c => c.code);

    convert = convert || 'USD';
    const api: API = await this.exapisService.findExapi(Exapi.EX_CMC);
    const quoteRes = await this.cmcApiService.quotes(api, symbols, convert);

    const quotes: Quote[] = [];
    const hasOwnProperty = Object.prototype.hasOwnProperty;
    for (const c in quoteRes) {
      if (!hasOwnProperty.call(quoteRes, c)) {
        continue;
      }
      const cq = quoteRes[c];
      const symbol = cq.symbol;
      const quote: Quote = cq.quote[convert];
      if (symbol && quote) {
        quote.symbol = symbol;
        quotes.push(quote);
      }
    }

    return ListResult.list(quotes);
  }

}
