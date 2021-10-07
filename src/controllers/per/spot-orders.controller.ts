import { Body, Controller, Delete, Get, Logger, Param, Post, Put, Query, UseGuards, } from '@nestjs/common';
import { OrderTimeLineQueryForm, SpotOrder, UpdateSpotOrderDto } from '../../models/per/spot-order';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CountList, CountListResult, ListResult, Result, ValueResult } from '../../models/result';
import { SpotOrderService } from '../../services/per/spot-order.service';
import { QueryParams } from '../../models/query-params';
import { QueryFilter } from '../../common/decorators/query-filter.decorator';
import { BaPriApiService } from '../../services/ex-api/ba/ba-pri-api.service';
import { OePriApiService } from '../../services/ex-api/oe/oe-pri-api.service';
import { BaPriSyncService } from '../../services/ex-sync/ba/ba-pri-sync.service';
import { OePriSyncService } from '../../services/ex-sync/oe/oe-pri-sync.service';
import { ExPairsService } from '../../services/mar/pairs.service';
import { Exch } from '../../models/sys/exch';
import { HbPriApiService } from '../../services/ex-api/hb/hb-pri-api.service';
import { HbPriSyncService } from '../../services/ex-sync/hb/hb-pri-sync.service';
import { ExapisService } from '../../services/sys/exapis.service';
import { API } from '../../models/sys/exapi';
import { CancelOrderForm, OrderForm } from '../../services/ex-api/order-form';
import { ExPriSyncService } from '../../services/ex-sync/ex-pri-sync.service';
import { ExPlaceOrderService } from '../../services/ex-sync/ex-place-order.service';
import { Config } from '../../common/config';
import { ExchangePair } from '../../models/mar/ex-pair';

@Controller('per/spot-orders')
@UseGuards(JwtAuthGuard)
@Roles('admin')
export class SpotOrdersController {
  private readonly logger = new Logger(SpotOrdersController.name);

  constructor(private spotOrdersService: SpotOrderService,
              private baPriService: BaPriApiService,
              private oePriService: OePriApiService,
              private hbPriService: HbPriApiService,
              private exPriApiService: ExPlaceOrderService,
              private exPriSyncService: ExPriSyncService,
              private pairsService: ExPairsService,
              private exapisService: ExapisService
  ) {
  }

  @Get('page')
  async page(@QueryFilter() query: QueryParams): Promise<CountListResult<SpotOrder>> {
    const {pager, filter, sorter} = query;
    const cl: CountList<SpotOrder> = await this.spotOrdersService.page(pager, filter, sorter);
    return CountListResult.cl(cl);
  }


  @Get('timeLine')
  async timeLine(@Query() queryForm: OrderTimeLineQueryForm): Promise<ListResult<SpotOrder>> {
    queryForm.limit = +queryForm.limit || 20;
    if (queryForm.olderThan) {
      queryForm.olderThan = +queryForm.olderThan;
    }
    const list = await this.spotOrdersService.timeLineQuery(queryForm);
    return ListResult.list(list);
  }

  @Get('pair/:ex/:symbol')
  async findByExPair(@Param('ex') ex: string,
                     @Param('symbol') symbol: string): Promise<ListResult<SpotOrder>> {
    const list: SpotOrder[] = await this.spotOrdersService.findByExPair(ex, symbol);
    return ListResult.list(list);
  }

  @Get('ccy/:ccy')
  async findByCcy(@Param('ccy') ccy: string): Promise<ListResult<SpotOrder>> {
    const list: SpotOrder[] = await this.spotOrdersService.findByCcy(ccy);
    return ListResult.list(list);
  }

  @Get('exCcy/:ex/:ccy')
  async findByExCcy(@Param('ex') ex: string,
                    @Param('ccy') ccy: string): Promise<ListResult<SpotOrder>> {
    const list: SpotOrder[] = await this.spotOrdersService.findByExCcy(ex, ccy);
    return ListResult.list(list);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<ValueResult<SpotOrder>> {
    const value: SpotOrder = await this.spotOrdersService.findOne(+id);
    return ValueResult.value(value);
  }

  @Get('clientOrderId/:clientOrderId')
  async getByClientOrderId(@Param('clientOrderId') clientOrderId: string): Promise<ValueResult<SpotOrder>> {
    const value: SpotOrder = await this.spotOrdersService.findByClientOrderId(clientOrderId);
    return ValueResult.value(value);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateSpotOrderDto): Promise<Result> {
    await this.spotOrdersService.update(+id, dto);
    return Result.success();
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<Result> {
    await this.spotOrdersService.remove(+id);
    return Result.success();
  }

  @Post('pending/ex/:ex')
  async exPendingOrders(@Param('ex') ex: string): Promise<ListResult<SpotOrder>> {
    const api: API = await this.exapisService.findExapi(ex);
    if (!api) {
      throw new Error('API Not Set.');
    }
    const list: SpotOrder[] = [];

    if (ex === Exch.CODE_OE) {
      const oeOdrs = await this.oePriService.pendingOrders(api);
      for (const odr of oeOdrs) {
        const order = new SpotOrder();
        OePriSyncService.setNewOrderProps(order, odr);
        list.push(order);
      }
    } else if (ex === Exch.CODE_BA) {
      const baOdrs = await this.baPriService.openOrders(api);
      for (const odr of baOdrs) {
        const order = new SpotOrder();
        BaPriSyncService.setNewOrderProps(order, odr);
        list.push(order);
      }
    } else if (ex === Exch.CODE_HB) {
      // concerned
      const hbPairs = await this.pairsService.findByExConcerned(Exch.CODE_HB);
      const hbSymbols = hbPairs.map(p => p.hbSymbol);
      const hbOdrs = await this.hbPriService.openOrders(api, hbSymbols);
      for (const odr of hbOdrs) {
        const order = new SpotOrder();
        HbPriSyncService.setNewOrderProps(order, odr);
        list.push(order);
      }
    } else {
      throw new Error('未知交易所：' + ex);
    }

    return ListResult.list(list);
  }

  @Post('pending/all')
  async pendingOrders(): Promise<ListResult<SpotOrder>> {

    const list: SpotOrder[] = await this.exPriSyncService.getPendingOrders();
    return ListResult.list(list);
  }


  @Post('placeOrder/:ex')
  async placeOrder(@Param('ex') ex: string,
                   @Body() form: OrderForm): Promise<ValueResult<any>> {
    const api: API = await this.exapisService.findExapi(ex);

    const ss = form.side === 'buy' ? 'b' : 's';
    form.clientOrderId = SpotOrder.genClientOrderId(ss, Config.ClientOrderIdPrefixes.web);

    const value = await this.exPriApiService.placeOrder(api, ex, form);
    if (form.type === 'market' && form.baseCcy && form.quoteCcy) {
      setTimeout(() => {
        const exp: ExchangePair = {
          ex,
          baseCcy: form.baseCcy,
          quoteCcy: form.quoteCcy,
          symbol: form.symbol
        };
        this.exPriSyncService.syncAfterPlacedOrder(exp)
          .then(updated => {
            this.logger.log('下单后同步，更新：' + updated);
          });
      }, Config.PlaceOrderSyncDelay);
    }
    return ValueResult.value(value);
  }

  @Post('cancelOrder/:ex')
  async cancelOrder(@Param('ex') ex: string,
                    @Body() form: CancelOrderForm): Promise<ValueResult<any>> {
    const api: API = await this.exapisService.findExapi(ex);
    const value = await this.exPriApiService.cancelOrder(api, ex, form);
    return ValueResult.value(value);
  }

}
