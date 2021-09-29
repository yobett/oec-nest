import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, } from '@nestjs/common';
import { ArbAnalysing, CurrentPrices } from '../../services/mar/current-price.service';
import { ExPairsService } from '../../services/mar/pairs.service';
import { CreateExPairDto, ExchangePair, ExchangePairsResult, ExPair, UpdateExPairDto } from '../../models/mar/ex-pair';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CountList, CountListResult, ListResult, Result, ValueResult } from '../../models/result';
import { QueryFilter } from '../../common/decorators/query-filter.decorator';
import { QueryParams } from '../../models/query-params';
import { LastTransaction } from '../../models/per/last-transaction';
import { LastTransactionService } from '../../services/per/last-transaction.service';
import { CurrentPriceService } from '../../services/mar/current-price.service';
import { BaPubApiService } from '../../services/ex-api/ba/ba-pub-api.service';
import { OePubApiService } from '../../services/ex-api/oe/oe-pub-api.service';
import { HbPubApiService } from '../../services/ex-api/hb/hb-pub-api.service';
import { Exch } from '../../models/sys/exch';

declare type PnLT = ExPair & { lastTrans: LastTransaction };

@Controller('mar/pairs')
@UseGuards(JwtAuthGuard)
@Roles('admin')
export class PairsController {
  constructor(private pairsService: ExPairsService,
              private currentPriceService: CurrentPriceService,
              private ltService: LastTransactionService,
              private baPubApiService: BaPubApiService,
              private oePubApiService: OePubApiService,
              private hbPubApiService: HbPubApiService) {
  }

  @Get('page')
  async page(@QueryFilter() query: QueryParams): Promise<CountListResult<ExPair>> {
    const {pager, filter, sorter} = query;
    const cl: CountList<ExPair> = await this.pairsService.page(pager, filter, sorter);
    return CountListResult.cl(cl);
  }

  @Get('exchangePairs/ex/:ex/base/:baseCcy')
  async findExchangePairsByBase(@Param('ex') ex: string,
                                @Param('baseCcy') baseCcy: string,
                                @Query('limit') limit: number): Promise<ListResult<ExchangePair>> {
    const list: ExchangePair[] = await this.pairsService.findExchangePairsByBase(ex, baseCcy, limit);
    return ListResult.list(list);
  }

  @Get('exchangePairs/ex/:ex/quote/:quoteCcy')
  async findExchangePairsByQuote(@Param('ex') ex: string,
                                 @Param('quoteCcy') quoteCcy: string,
                                 @Query('limit') limit: number): Promise<ListResult<ExchangePair>> {
    const list: ExchangePair[] = await this.pairsService.findExchangePairsByQuote(ex, quoteCcy, limit);
    return ListResult.list(list);
  }

  @Get('exchangePairs/ebq/:ex/:ccy')
  async findExchangePairs(@Param('ex') ex: string,
                          @Param('ccy') ccy: string,
                          @Query('limit') limit: number): Promise<ValueResult<ExchangePairsResult>> {
    const byBaseList: ExchangePair[] = await this.pairsService.findExchangePairsByBase(ex, ccy, limit);
    const byQuoteList: ExchangePair[] = await this.pairsService.findExchangePairsByQuote(ex, ccy, limit);
    return ValueResult.value({
      ccy,
      asBase: byBaseList,
      asQuote: byQuoteList
    });
  }

  @Get('concern')
  async concern(): Promise<ListResult<ExPair>> {
    const pairs = await this.pairsService.findConcerned();
    return ListResult.list(pairs);
  }

  @Get('concern/withLastTrans')
  async concernWithLastTransaction(): Promise<ListResult<PnLT>> {
    const pairs = await this.pairsService.findConcerned();

    const lts = await this.ltService.findAll();
    const ltsMap = new Map<string, LastTransaction>();
    for (const lt of lts) {
      ltsMap.set(`${lt.baseCcy}-${lt.quoteCcy}`, lt);
      delete lt.baseCcy;
      delete lt.quoteCcy;
      delete lt.createdAt;
    }

    const pnlts = pairs.map(pair => {
      const pnlt = pair as PnLT;
      pnlt.lastTrans = ltsMap.get(`${pnlt.baseCcy}-${pnlt.quoteCcy}`);
      return pnlt;
    });

    return ListResult.list(pnlts);
  }

  @Post('concern/inquirePrices')
  async inquireConcernedPrices(@Query('preferDS') preferDS: string = null): Promise<ValueResult<CurrentPrices>> {
    const prices = await this.currentPriceService.inquireConcernedPrices(preferDS);
    return ValueResult.value(prices);
  }

  @Get('exchangeInfo/:ex/:symbol')
  async exchangeInfo(@Param('ex') ex: string,
                     @Param('symbol') symbol: string): Promise<ValueResult<any>> {

    if (ex === Exch.CODE_BA) {
      const info = await this.baPubApiService.exchangeInfo(symbol);
      return ValueResult.value(info);
    } else if (ex === Exch.CODE_OE) {
      let info = await this.oePubApiService.instruments(symbol);
      if (info && info.length === 1) {
        info = info[0];
      }
      return ValueResult.value(info);
    } else if (ex === Exch.CODE_HB) {
      // TODO:
      const symbols = await this.hbPubApiService.symbols();
      const symbolInfo = symbols.find(s => s.symbol === symbol);
      return ValueResult.value(symbolInfo || {});
    }
    return ValueResult.value({});
  }

  @Post('arb/check-oe')
  async checkArbOe(): Promise<ValueResult<ArbAnalysing>> {
    const aa = await this.currentPriceService.checkArbOE();
    return ValueResult.value(aa);
  }

  @Post('arb/check-ba')
  async checkArbBa(): Promise<ValueResult<ArbAnalysing>> {
    const aa = await this.currentPriceService.checkArbBA();
    return ValueResult.value(aa);
  }

  // @Post('arb/check1')
  // async arbitrage(): Promise<Result> {
  //   await this.currentPriceService.checkArbitrage();
  //   return Result.success();
  // }

  @Get('ticker/:ex/:symbol')
  async inquirePrice(@Param('ex') ex: string,
                     @Param('symbol') symbol: string): Promise<ValueResult<number | string>> {
    const price = await this.currentPriceService.inquirePrice(ex, symbol);
    return ValueResult.value(price);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<ValueResult<ExPair>> {
    const value: ExPair = await this.pairsService.findOne(+id);
    return ValueResult.value(value);
  }

  @Get('bq/:baseCcy/:quoteCcy')
  async findOneByBaseQuote(@Param('baseCcy') baseCcy: string,
                           @Param('quoteCcy') quoteCcy: string): Promise<ValueResult<ExPair>> {
    const value: ExPair = await this.pairsService.findPair(baseCcy, quoteCcy);
    return ValueResult.value(value);
  }

  @Post()
  async create(@Body() dto: CreateExPairDto): Promise<ValueResult<ExPair>> {
    if (dto.baSymbol === '') {
      dto.baSymbol = null;
    }
    if (dto.oeSymbol === '') {
      dto.oeSymbol = null;
    }
    if (dto.hbSymbol === '') {
      dto.hbSymbol = null;
    }
    const value: ExPair = await this.pairsService.create(dto);
    return ValueResult.value(value);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateExPairDto): Promise<Result> {
    await this.pairsService.update(+id, dto);
    return Result.success();
  }

  @Put(':id/addConcern')
  async addConcern(@Param('id') id: string): Promise<Result> {
    await this.pairsService.updateConcerned(+id, true);
    return Result.success();
  }

  @Put(':id/cancelConcern')
  async cancelConcern(@Param('id') id: string): Promise<Result> {
    await this.pairsService.updateConcerned(+id, false);
    return Result.success();
  }

  @Post('addConcern/quote/:quote')
  async addConcernWithQuote(@Body() baseCodes: string[], @Param('quote') quote: string): Promise<Result> {
    await this.pairsService.addConcernedWithQuote(baseCodes, quote);
    return Result.success();
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<Result> {
    await this.pairsService.remove(+id);
    return Result.success();
  }
}
