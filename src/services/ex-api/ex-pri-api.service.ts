import { Injectable } from '@nestjs/common';
import { BaPriApiService } from './ba/ba-pri-api.service';
import { OePriApiService } from './oe/oe-pri-api.service';
import { HbPriApiService } from './hb/hb-pri-api.service';
import { CancelOrderForm, OrderForm } from './order-form';
import { API } from '../../models/sys/exapi';
import { Exch } from '../../models/sys/exch';
import { roundNumber } from '../../common/utils';
import { BaPubApiService } from './ba/ba-pub-api.service';


type BaExchangeInfo = {
  symbols: {
    filters: {
      filterType: string
    }[]
  }[]
}

@Injectable()
export class ExPriApiService {

  constructor(private baPriService: BaPriApiService,
              private oePriService: OePriApiService,
              private hbPriService: HbPriApiService,
              private baPubApiService: BaPubApiService,) {

  }

  async placeOrder(api: API,
                   ex: string,
                   form: OrderForm): Promise<any> {
    if (!api) {
      throw new Error(`API未配置（${ex}）`);
    }
    let digits = 5;
    let fractionDigits = false;
    const quantityByQuote = !!form.quoteQuantity;

    if (ex === Exch.CODE_BA) {
      try {
        const info: BaExchangeInfo = await this.baPubApiService.exchangeInfo(form.symbol);
        if (info.symbols && info.symbols.length > 0) {
          const params = info.symbols[0];
          const filters: any[] = params.filters;
          const filterType = quantityByQuote ? 'MARKET_LOT_SIZE' : 'LOT_SIZE';
          const filterLotSize = filters.find(f => f.filterType === filterType);
          if (filterLotSize) {
            let stepSize: string = filterLotSize.stepSize;
            if (/^[^0]\./.test(stepSize)) { // 1.00000000
              digits = 0;
              fractionDigits = true;
            } else { // 0.00010000
              stepSize = stepSize.substr(2);
              const oi = stepSize.indexOf('1');
              if (oi >= 0) {
                digits = oi + 1;
                fractionDigits = true;
              }
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    if (quantityByQuote) {
      form.quoteQuantity = +roundNumber(form.quoteQuantity, digits,
        fractionDigits ? 'fraction' : 'effect', true);
    } else {
      form.quantity = +roundNumber(form.quantity, digits,
        fractionDigits ? 'fraction' : 'effect', true);
    }
    if (form.price) {
      form.price = +roundNumber(form.price);
    }
    let value;
    if (ex === Exch.CODE_BA) {
      value = await this.baPriService.placeOrder(api, form);
    } else if (ex === Exch.CODE_OE) {
      value = await this.oePriService.placeOrder(api, form);
    } else if (ex === Exch.CODE_HB) {
      value = await this.hbPriService.placeOrder(api, form);
    } else {
      throw new Error('未知交易所：' + ex);
    }
    return value;
  }

  async cancelOrder(api: API,
                    ex: string,
                    form: CancelOrderForm): Promise<any> {
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
    return value;
  }

}
