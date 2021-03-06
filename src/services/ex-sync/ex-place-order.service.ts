import { Injectable } from '@nestjs/common';
import { BaPriApiService } from '../ex-api/ba/ba-pri-api.service';
import { OePriApiService } from '../ex-api/oe/oe-pri-api.service';
import { HbPriApiService } from '../ex-api/hb/hb-pri-api.service';
import { CancelOrderForm, OrderForm, PlaceOrderResult } from '../ex-api/order-form';
import { API } from '../../models/sys/exapi';
import { Exch } from '../../models/sys/exch';
import { roundNumber, toFixedDown } from '../../common/utils';
import { BaExchangeInfo, BaPubApiService } from '../ex-api/ba/ba-pub-api.service';
import { HbPubSyncService } from './hb/hb-pub-sync.service';
import { OeInstrument, OePubApiService } from '../ex-api/oe/oe-pub-api.service';
import { ExPendingOrdersHolder } from './ex-pending-orders-holder';


@Injectable()
export class ExPlaceOrderService {

  constructor(private baPriService: BaPriApiService,
              private oePriService: OePriApiService,
              private hbPriService: HbPriApiService,
              private baPubApiService: BaPubApiService,
              private oePubApiService: OePubApiService,
              private hbPubSyncService: HbPubSyncService,
              private exPendingOrdersHolder: ExPendingOrdersHolder) {

  }

  private detectFractionDigits(stepSize: string): number {
    if (/^[^0]\./.test(stepSize)) { // 1.00000000
      return 0;
    }
    // TODO: 0.00020000
    // 0.00010000
    stepSize = stepSize.substr(2);
    const oi = stepSize.indexOf('1');
    if (oi >= 0) {
      return oi + 1;
    }
    return -1;
  }

  async placeOrder(api: API,
                   form: OrderForm): Promise<PlaceOrderResult> {
    const ex = form.ex;
    if (!api) {
      throw new Error(`API未配置（${ex}）`);
    }

    let fractionDigits = 2;
    const quantityByQuote = !!form.quoteQuantity;
    let priceProcessed = false;

    try {
      if (ex === Exch.CODE_BA) {
        const symbolInfo: BaExchangeInfo = await this.baPubApiService.exchangeInfo(form.symbol);
        if (symbolInfo) {
          const filters: any[] = symbolInfo.filters;
          const filterType = quantityByQuote ? 'MARKET_LOT_SIZE' : 'LOT_SIZE';
          const filterLotSize = filters.find(f => f.filterType === filterType);
          if (filterLotSize) {
            const stepSize = filterLotSize.stepSize;
            const fd = this.detectFractionDigits(stepSize);
            if (fd >= 0) {
              fractionDigits = fd;
            }
          }
          if (form.type === 'limit') {
            const filterPrice = filters.find(f => f.filterType === 'PRICE_FILTER');
            if (filterPrice) {
              const tickSize = filterPrice.tickSize;
              const fd = this.detectFractionDigits(tickSize);
              if (fd >= 0) {
                form.priceStr = form.price.toFixed(fd);
                priceProcessed = true;
              }
            }
          }
        }
      } else if (ex === Exch.CODE_OE) {
        if (!quantityByQuote || form.type === 'limit') {
          const symbolInfo: OeInstrument = await this.oePubApiService.instrument(form.symbol);
          if (!quantityByQuote) {
            const lotSz = symbolInfo.lotSz;
            const fd = this.detectFractionDigits(lotSz);
            if (fd >= 0) {
              fractionDigits = fd;
            }
          }
          if (form.type === 'limit') {
            const tickSize = symbolInfo.tickSz;
            const fd = this.detectFractionDigits(tickSize);
            if (fd >= 0) {
              form.priceStr = form.price.toFixed(fd);
              priceProcessed = true;
            }
          }
        }
      } else if (ex === Exch.CODE_HB) {
        if (!quantityByQuote || form.type === 'limit') {
          const symbolInfo = await this.hbPubSyncService.getSymbolInfo(form.symbol);
          if (!quantityByQuote) {
            const ap: number = symbolInfo['amount-precision'];
            if (typeof ap === 'number') {
              fractionDigits = ap;
            }
          }
          if (form.type === 'limit') {
            const pp = symbolInfo['price-precision'];
            const fd = this.detectFractionDigits(pp);
            if (fd >= 0) {
              form.priceStr = form.price.toFixed(fd);
              priceProcessed = true;
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    }

    if (quantityByQuote) {
      form.quoteQuantity = +toFixedDown(form.quoteQuantity, fractionDigits);
    } else {
      form.quantity = +toFixedDown(form.quantity, fractionDigits);
    }
    if (form.price && !priceProcessed) {
      form.priceStr = roundNumber(form.price);
    }

    let orderId: string;
    if (ex === Exch.CODE_BA) {
      const result = await this.baPriService.placeOrder(api, form);
      orderId = result.orderId;
    } else if (ex === Exch.CODE_OE) {
      const {ordId} = await this.oePriService.placeOrder(api, form);
      orderId = ordId;
    } else if (ex === Exch.CODE_HB) {
      orderId = await this.hbPriService.placeOrder(api, form);
    } else {
      throw new Error('未知交易所：' + ex);
    }
    if (orderId) {
      this.exPendingOrdersHolder.notifyNewOrderPlaced(orderId, form);
    }

    return {orderId};
  }

  async cancelOrder(api: API,
                    form: CancelOrderForm): Promise<any> {
    const ex = form.ex;
    if (!api) {
      throw new Error(`API未配置（${ex}）`);
    }
    let value;
    if (ex === Exch.CODE_BA) {
      value = await this.baPriService.cancelOrder(api, form);
    } else if (ex === Exch.CODE_OE) {
      value = await this.oePriService.cancelOrder(api, form);
    } else if (ex === Exch.CODE_HB) {
      value = await this.hbPriService.cancelOrder(api, form);
    } else {
      throw new Error('未知交易所：' + ex);
    }
    this.exPendingOrdersHolder.notifyOrderCanceled(form);
    return value;
  }

}
