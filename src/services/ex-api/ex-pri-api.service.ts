import { Injectable } from '@nestjs/common';
import { BaPriApiService } from './ba/ba-pri-api.service';
import { OePriApiService } from './oe/oe-pri-api.service';
import { HbPriApiService } from './hb/hb-pri-api.service';
import { CancelOrderForm, OrderForm } from './order-form';
import { API } from '../../models/sys/exapi';
import { Exch } from '../../models/sys/exch';
import { effectDigitsTransform } from '../../common/utils';

@Injectable()
export class ExPriApiService {

  constructor(private baPriService: BaPriApiService,
              private oePriService: OePriApiService,
              private hbPriService: HbPriApiService) {

  }

  async placeOrder(api: API,
                   ex: string,
                   form: OrderForm): Promise<any> {
    if (!api) {
      throw new Error(`API未配置（${ex}）`);
    }
    if (form.quantity) {
      form.quantity = +effectDigitsTransform(form.quantity);
    }
    if (form.quoteQuantity) {
      form.quoteQuantity = +effectDigitsTransform(form.quoteQuantity);
    }
    if (form.price) {
      form.price = +effectDigitsTransform(form.price);
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
