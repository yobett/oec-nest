import { Body, Controller, Delete, Get, Logger, Param, Post, Put, Query, UseGuards, } from '@nestjs/common';
import { OrderTimeLineQueryForm, SpotOrder, UpdateSpotOrderDto } from '../../models/per/spot-order';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CountList, CountListResult, ListResult, Result, ValueResult } from '../../models/result';
import { SpotOrderService } from '../../services/per/spot-order.service';
import { QueryParams } from '../../models/query-params';
import { QueryFilter } from '../../common/decorators/query-filter.decorator';
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

  constructor(private ordersService: SpotOrderService,
              private exPriApiService: ExPlaceOrderService,
              private exPriSyncService: ExPriSyncService,
              private exapisService: ExapisService
  ) {
  }

  @Get('page')
  async page(@QueryFilter() query: QueryParams): Promise<CountListResult<SpotOrder>> {
    const {pager, filter, sorter} = query;
    const cl: CountList<SpotOrder> = await this.ordersService.page(pager, filter, sorter);
    return CountListResult.cl(cl);
  }


  @Get('timeLine')
  async timeLine(@Query() queryForm: OrderTimeLineQueryForm): Promise<ListResult<SpotOrder>> {
    queryForm.limit = +queryForm.limit || 20;
    if (queryForm.olderThan) {
      queryForm.olderThan = +queryForm.olderThan;
    }
    const list = await this.ordersService.timeLineQuery(queryForm);
    return ListResult.list(list);
  }

  @Get('pair/:ex/:symbol')
  async findByExPair(@Param('ex') ex: string,
                     @Param('symbol') symbol: string): Promise<ListResult<SpotOrder>> {
    const list: SpotOrder[] = await this.ordersService.findByExPair(ex, symbol);
    return ListResult.list(list);
  }

  @Get('ccy/:ccy')
  async findByCcy(@Param('ccy') ccy: string): Promise<ListResult<SpotOrder>> {
    const list: SpotOrder[] = await this.ordersService.findByCcy(ccy);
    return ListResult.list(list);
  }

  @Get('exCcy/:ex/:ccy')
  async findByExCcy(@Param('ex') ex: string,
                    @Param('ccy') ccy: string): Promise<ListResult<SpotOrder>> {
    const list: SpotOrder[] = await this.ordersService.findByExCcy(ex, ccy);
    return ListResult.list(list);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<ValueResult<SpotOrder>> {
    const value: SpotOrder = await this.ordersService.findOne(+id);
    return ValueResult.value(value);
  }

  @Get('clientOrderId/:clientOrderId')
  async getByClientOrderId(@Param('clientOrderId') clientOrderId: string): Promise<ValueResult<SpotOrder>> {
    const value: SpotOrder = await this.ordersService.findByClientOrderId(clientOrderId);
    return ValueResult.value(value);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateSpotOrderDto): Promise<Result> {
    await this.ordersService.update(+id, dto);
    return Result.success();
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<Result> {
    await this.ordersService.remove(+id);
    return Result.success();
  }

  @Post('pending/ex/:ex')
  async exPendingOrders(@Param('ex') ex: string): Promise<ListResult<SpotOrder>> {

    const list: SpotOrder[] = await this.exPriSyncService.getPendingOrdersFor(ex);
    return ListResult.list(list);
  }

  @Post('pending/all')
  async pendingOrders(): Promise<ListResult<SpotOrder>> {

    const list: SpotOrder[] = await this.exPriSyncService.getPendingOrders();
    return ListResult.list(list);
  }


  @Post('placeOrder')
  async placeOrder(@Body() form: OrderForm): Promise<ValueResult<any>> {
    const ex = form.ex;
    const api: API = await this.exapisService.findExapi(ex);

    const ss = form.side === 'buy' ? 'b' : 's';
    form.clientOrderId = SpotOrder.genClientOrderId(ss, Config.ClientOrderIdPrefixes.web);

    const value = await this.exPriApiService.placeOrder(api, form);

    if (form.type === 'market') {
      if (form.baseCcy && form.quoteCcy) {
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
    } else {
      setTimeout(() => {
        this.exPriSyncService.syncExAssets(ex).then(result => {
          this.logger.log('下限价单后同步资产');
        });
      }, Config.PlaceOrderSyncDelay);
    }
    return ValueResult.value(value);
  }


  @Post('cancelOrder')
  async cancelOrder(@Body() form: CancelOrderForm): Promise<ValueResult<any>> {
    const ex = form.ex;
    const api: API = await this.exapisService.findExapi(ex);
    const value = await this.exPriApiService.cancelOrder(api, form);

    await this.exPriSyncService.syncExAssets(ex).catch(console.error);

    return ValueResult.value(value);
  }

}
